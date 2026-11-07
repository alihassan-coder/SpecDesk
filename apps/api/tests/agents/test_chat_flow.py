"""Front desk (triage), "generate now", editing earlier answers, regenerating a round, feedback.

Real FastAPI app and dev DB, fake model, in-memory checkpointer. Chats are deleted afterwards.
"""

import uuid
from collections.abc import Iterator
from typing import TypeVar, cast

import pytest
from fastapi.testclient import TestClient
from langgraph.checkpoint.memory import InMemorySaver
from pydantic import BaseModel
from sqlalchemy import select, text

from app.agents.interviewer.schemas import InterviewerTurn, Option, Question, Triage
from app.agents.runtime.checkpointer import get_checkpointer
from app.agents.service import get_ask_for_chat
from app.db.models import Chat, Message
from app.db.session import get_engine, session_scope
from app.main import create_app

from .planner_fakes import FakePlanner
from .sse import parse_events

T = TypeVar("T", bound=BaseModel)


def _question(qid: str) -> Question:
    return Question(
        id=qid,
        title=f"Question {qid}?",
        body="Matters for the plan.",
        options=[Option(id="a", label="Option A"), Option(id="b", label="Option B")],
        recommended="a",
    )


class ScriptedModel:
    """Triage: anything with "app" in it is an idea. Interviewer: asks until told to finish."""

    def __init__(self) -> None:
        self.calls: list[str] = []
        self.planner = FakePlanner()
        self.round = 0

    def __call__(self, agent: str, schema: type[T], *, system: str, user: str) -> T:
        self.calls.append(agent)
        if agent == "triage":
            idea = "app" in user.lower().split("</founder_messages>")[0]
            if idea:
                return cast(T, Triage(kind="app_idea", title="Dog walking app"))
            return cast(T, Triage(kind="greeting", reply="Hi! What app would you like to build?"))
        if agent == "interviewer":
            if "last turn" in user.lower():
                return cast(T, InterviewerTurn(ready=True, why="Done.", brief="- Settled"))
            self.round += 1
            return cast(
                T,
                InterviewerTurn(
                    ready=False, why=f"Round {self.round}.", questions=[_question(f"q{self.round}")]
                ),
            )
        return self.planner(agent, schema, system=system, user=user)


Api = tuple[TestClient, ScriptedModel, list[uuid.UUID]]


@pytest.fixture
def api() -> Iterator[Api]:
    try:
        with get_engine().connect() as conn:
            conn.execute(text("select 1"))
    except Exception:
        pytest.skip("dev database not reachable")
    model = ScriptedModel()
    saver = InMemorySaver()
    app = create_app()
    app.dependency_overrides[get_checkpointer] = lambda: saver

    def ask_for(_chat_id: uuid.UUID) -> ScriptedModel:
        return model

    app.dependency_overrides[get_ask_for_chat] = lambda: ask_for
    created: list[uuid.UUID] = []
    yield TestClient(app), model, created
    with session_scope() as s:
        for chat_id in created:
            if (chat := s.get(Chat, chat_id)) is not None:
                s.delete(chat)


def _chat(client: TestClient, created: list[uuid.UUID], idea: str) -> str:
    res = client.post("/api/v1/chats", json={"idea": idea, "depth": "thorough"})
    assert res.status_code == 201
    created.append(uuid.UUID(res.json()["id"]))
    return str(res.json()["id"])


def test_hi_gets_a_reply_not_an_interview(api: Api) -> None:
    client, model, created = api
    chat_id = _chat(client, created, "hi")

    events = parse_events(client.post(f"/api/v1/chats/{chat_id}/interview").text)
    assert ("assistant.message", {"text": "Hi! What app would you like to build?"}) in events
    assert "question.round" not in [e for e, _ in events]
    assert model.calls == ["triage"]  # the interviewer never ran

    detail = client.get(f"/api/v1/chats/{chat_id}").json()
    assert detail["stage"] == "needs_idea"
    assert detail["conversation"][-1]["role"] == "assistant"

    # Refreshing doesn't call the model again.
    assert parse_events(client.post(f"/api/v1/chats/{chat_id}/interview").text) == []
    assert model.calls == ["triage"]

    # Now a real idea: triage accepts it and the interview starts in the same stream.
    events = parse_events(
        client.post(
            f"/api/v1/chats/{chat_id}/messages",
            json={"text": "An app where dog owners book walkers"},
        ).text
    )
    assert "question.round" in [e for e, _ in events]
    detail = client.get(f"/api/v1/chats/{chat_id}").json()
    assert detail["stage"] == "interviewing"
    assert detail["title"] == "Dog walking app"
    assert "dog owners" in detail["idea"]

    # Messages are only for before the interview.
    late = client.post(f"/api/v1/chats/{chat_id}/messages", json={"text": "more"})
    assert late.status_code == 409


def test_generate_now_finishes_the_interview(api: Api) -> None:
    client, _, created = api
    chat_id = _chat(client, created, "A dog walking app")
    client.post(f"/api/v1/chats/{chat_id}/interview")
    events = parse_events(
        client.post(
            f"/api/v1/chats/{chat_id}/answers",
            json={"answers": {"r1_q1": {"optionId": "a"}}, "finish": True},
        ).text
    )
    assert events[-1] == ("interview.done", {"brief": "- Settled"})


def test_edit_earlier_answers_and_regenerate_a_round(api: Api) -> None:
    client, model, created = api
    chat_id = _chat(client, created, "A dog walking app")
    client.post(f"/api/v1/chats/{chat_id}/interview")
    client.post(f"/api/v1/chats/{chat_id}/answers", json={"answers": {"r1_q1": {"optionId": "a"}}})
    detail = client.get(f"/api/v1/chats/{chat_id}").json()
    assert len(detail["rounds"]) == 1 and detail["pending"]["round"] == 2

    # Change round 1's answer: round 2 is asked again from the new answers.
    events = parse_events(
        client.post(
            f"/api/v1/chats/{chat_id}/rounds/1/answers",
            json={"answers": {"r1_q1": {"optionId": "b"}}},
        ).text
    )
    assert "question.round" in [e for e, _ in events]
    detail = client.get(f"/api/v1/chats/{chat_id}").json()
    assert len(detail["rounds"]) == 1
    assert detail["rounds"][0]["answers"]["r1_q1"]["optionId"] == "b"
    assert detail["pending"]["round"] == 2

    # Regenerate round 2: the interviewer runs again for that round only.
    before = model.calls.count("interviewer")
    events = parse_events(client.post(f"/api/v1/chats/{chat_id}/rounds/2/regenerate").text)
    assert "question.round" in [e for e, _ in events]
    assert model.calls.count("interviewer") == before + 1
    assert client.get(f"/api/v1/chats/{chat_id}").json()["pending"]["round"] == 2

    missing = client.post(f"/api/v1/chats/{chat_id}/rounds/9/regenerate")
    assert missing.status_code == 404


def test_feedback_is_saved(api: Api) -> None:
    client, _, created = api
    chat_id = _chat(client, created, "A dog walking app")
    res = client.post(f"/api/v1/chats/{chat_id}/feedback", json={"target": "plan", "rating": "up"})
    assert res.status_code == 201
    with session_scope() as s:
        rows = s.scalars(
            select(Message).where(Message.chat_id == uuid.UUID(chat_id), Message.kind == "feedback")
        ).all()
        assert [r.content for r in rows] == [{"target": "plan", "rating": "up"}]
    bad = client.post(f"/api/v1/chats/{chat_id}/feedback", json={"target": "plan", "rating": "meh"})
    assert bad.status_code == 422
