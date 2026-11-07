"""The chats API over HTTP + SSE: real FastAPI app and DB, fake model, in-memory checkpointer.

Needs the dev database from `apps/api/.env`; skipped cleanly when it isn't reachable.
Every chat created here is deleted afterwards.
"""

import json
import uuid
from collections.abc import Iterator
from typing import Any, TypeVar, cast

import pytest
from fastapi.testclient import TestClient
from langgraph.checkpoint.memory import InMemorySaver
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.exc import OperationalError

from app.agents.interviewer.schemas import InterviewerTurn, Option, Question
from app.agents.runtime.checkpointer import get_checkpointer
from app.agents.service import get_ask_for_chat
from app.core.errors import AppError
from app.db.models import Chat
from app.db.session import get_engine, session_scope
from app.main import create_app

T = TypeVar("T", bound=BaseModel)


class FakeModel:
    def __init__(self, turns: list[InterviewerTurn]) -> None:
        self.turns = list(turns)
        self.calls = 0
        self.fail_with: AppError | None = None  # set to simulate a provider problem

    def __call__(self, agent: str, schema: type[T], *, system: str, user: str) -> T:
        self.calls += 1
        if self.fail_with is not None:
            raise self.fail_with
        return cast(T, self.turns.pop(0))


def _turn_with_question() -> InterviewerTurn:
    q = Question(
        id="platform",
        title="Where will people use it?",
        body="Decides web vs mobile.",
        options=[Option(id="web", label="Web"), Option(id="mobile", label="Mobile")],
        recommended="mobile",
    )
    return InterviewerTurn(ready=False, why="First, the platform.", questions=[q])


def _events(body: str) -> list[tuple[str, Any]]:
    """Parse an SSE body into (event, data) pairs."""
    parsed: list[tuple[str, Any]] = []
    for block in body.strip().split("\n\n"):
        fields = dict(line.split(": ", 1) for line in block.splitlines() if ": " in line)
        if "event" in fields:
            parsed.append((fields["event"], json.loads(fields.get("data", "null"))))
    return parsed


@pytest.fixture
def db_ready() -> None:
    try:
        with get_engine().connect() as conn:
            conn.execute(text("select 1"))
    except (OperationalError, Exception):  # no DB configured or reachable
        pytest.skip("dev database not reachable")


@pytest.fixture
def api(db_ready: None) -> Iterator[tuple[TestClient, FakeModel, list[uuid.UUID]]]:
    model = FakeModel(
        [_turn_with_question(), InterviewerTurn(ready=True, why="All set.", brief="- Mobile app")]
    )
    saver = InMemorySaver()
    app = create_app()
    app.dependency_overrides[get_checkpointer] = lambda: saver

    def ask_for(_chat_id: uuid.UUID) -> FakeModel:
        return model

    app.dependency_overrides[get_ask_for_chat] = lambda: ask_for
    created: list[uuid.UUID] = []
    yield TestClient(app), model, created
    with session_scope() as s:
        for chat_id in created:
            if (chat := s.get(Chat, chat_id)) is not None:
                s.delete(chat)


def test_full_interview_over_sse(api: tuple[TestClient, FakeModel, list[uuid.UUID]]) -> None:
    client, model, created = api

    res = client.post(
        "/api/v1/chats", json={"idea": "A booking app for physiotherapists", "platform": "both"}
    )
    assert res.status_code == 201
    chat = res.json()
    created.append(uuid.UUID(chat["id"]))
    assert chat["status"] == "interviewing"

    start = client.post(f"/api/v1/chats/{chat['id']}/interview")
    assert start.headers["content-type"].startswith("text/event-stream")
    events = _events(start.text)
    names = [e for e, _ in events]
    assert names == ["agent.status", "agent.note", "question.round"]
    round_one = events[-1][1]["round"]
    assert round_one["questions"][0]["id"] == "r1_platform"
    assert round_one["questions"][0]["recommended"] == "mobile"

    # Refreshing the page re-sends the waiting round without calling the model again.
    again = _events(client.post(f"/api/v1/chats/{chat['id']}/interview").text)
    assert [e for e, _ in again] == ["question.round"]
    assert model.calls == 1

    done = _events(
        client.post(
            f"/api/v1/chats/{chat['id']}/answers",
            json={"answers": {"r1_platform": {"optionId": "web"}}},
        ).text
    )
    assert done[-1] == ("interview.done", {"brief": "- Mobile app"})

    detail = client.get(f"/api/v1/chats/{chat['id']}").json()
    assert detail["brief"] == "- Mobile app"
    assert detail["rounds"][0]["answers"]["r1_platform"]["optionId"] == "web"
    assert detail["pending"] is None


def test_answering_when_nothing_is_waiting_is_a_friendly_409(
    api: tuple[TestClient, FakeModel, list[uuid.UUID]],
) -> None:
    client, _, created = api
    chat = client.post("/api/v1/chats", json={"idea": "An inventory app for bakeries"}).json()
    created.append(uuid.UUID(chat["id"]))

    res = client.post(f"/api/v1/chats/{chat['id']}/answers", json={"answers": {}})
    assert res.status_code == 409
    assert res.json()["error"]["title"] == "There's no question waiting"


def test_unknown_chat_and_bad_input_are_humanized(
    api: tuple[TestClient, FakeModel, list[uuid.UUID]],
) -> None:
    client, _, _ = api
    missing = client.post(f"/api/v1/chats/{uuid.uuid4()}/interview")
    assert missing.status_code == 404
    assert missing.json()["error"]["code"] == "not_found"

    short = client.post("/api/v1/chats", json={"idea": "app"})
    assert short.status_code == 422
    assert "error" in short.json()


def test_a_failed_step_is_retried_on_the_next_call(
    api: tuple[TestClient, FakeModel, list[uuid.UUID]],
) -> None:
    client, model, created = api
    chat = client.post("/api/v1/chats", json={"idea": "A tutoring marketplace for maths"}).json()
    created.append(uuid.UUID(chat["id"]))

    model.fail_with = AppError("model_not_configured", status_code=503)  # e.g. no API key yet
    failed = _events(client.post(f"/api/v1/chats/{chat['id']}/interview").text)
    assert failed[-1][0] == "error"
    assert failed[-1][1]["code"] == "model_not_configured"

    model.fail_with = None  # the admin added a key
    retried = _events(client.post(f"/api/v1/chats/{chat['id']}/interview").text)
    assert retried[-1][0] == "question.round"  # not stuck: the failed step ran again
