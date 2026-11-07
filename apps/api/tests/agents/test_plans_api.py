"""Idea → interview → plan → read plan → download files, over HTTP with fake models.

Needs the dev database; skipped when it isn't reachable. Chats created here are deleted
(plans and versions go with them through ON DELETE CASCADE).
"""

import uuid
from collections.abc import Iterator
from typing import TypeVar, cast

import pytest
from fastapi.testclient import TestClient
from langgraph.checkpoint.memory import InMemorySaver
from pydantic import BaseModel
from sqlalchemy import text

from app.agents.interviewer.schemas import InterviewerTurn
from app.agents.runtime.checkpointer import get_checkpointer
from app.agents.service import get_ask_for_chat
from app.db.models import Chat
from app.db.session import get_engine, session_scope
from app.main import create_app

from .planner_fakes import FakePlanner
from .sse import parse_events as _events

T = TypeVar("T", bound=BaseModel)


class FakeEverything:
    """Interviewer finishes at once; planners get canned outputs."""

    def __init__(self) -> None:
        self.planner = FakePlanner()

    def __call__(self, agent: str, schema: type[T], *, system: str, user: str) -> T:
        if agent == "interviewer":
            return cast(T, InterviewerTurn(ready=True, why="Clear enough.", brief="- Web app"))
        return self.planner(agent, schema, system=system, user=user)


Api = tuple[TestClient, FakeEverything, list[uuid.UUID]]


@pytest.fixture
def db_ready() -> None:
    try:
        with get_engine().connect() as conn:
            conn.execute(text("select 1"))
    except Exception:  # no DB configured or reachable
        pytest.skip("dev database not reachable")


@pytest.fixture
def api(db_ready: None) -> Iterator[Api]:
    model = FakeEverything()
    saver = InMemorySaver()
    app = create_app()
    app.dependency_overrides[get_checkpointer] = lambda: saver

    def ask_for(_chat_id: uuid.UUID) -> FakeEverything:
        return model

    app.dependency_overrides[get_ask_for_chat] = lambda: ask_for
    created: list[uuid.UUID] = []
    yield TestClient(app), model, created
    with session_scope() as s:
        for chat_id in created:
            if (chat := s.get(Chat, chat_id)) is not None:
                s.delete(chat)


def _new_chat(client: TestClient, created: list[uuid.UUID]) -> str:
    chat = client.post("/api/v1/chats", json={"idea": "A booking app for physiotherapists"}).json()
    created.append(uuid.UUID(chat["id"]))
    return str(chat["id"])


def test_planning_before_the_interview_is_done_is_a_friendly_409(api: Api) -> None:
    client, _, created = api
    chat_id = _new_chat(client, created)
    res = client.post(f"/api/v1/chats/{chat_id}/plan")
    assert res.status_code == 409
    assert res.json()["error"]["code"] == "interview_not_finished"


def test_idea_to_plan_to_files(api: Api) -> None:
    client, model, created = api
    chat_id = _new_chat(client, created)
    interview = _events(client.post(f"/api/v1/chats/{chat_id}/interview").text)
    assert interview[-1][0] == "interview.done"

    events = _events(client.post(f"/api/v1/chats/{chat_id}/plan").text)
    names = [e for e, _ in events]
    assert names.count("agent.status") == 14  # 7 agents × working + done
    assert names.count("file.ready") == 6
    assert names[-1] == "done"
    plan_id = events[-1][1]["planId"]

    # Calling again doesn't re-run the agents.
    calls = len(model.planner.agents)
    again = [e for e, _ in _events(client.post(f"/api/v1/chats/{chat_id}/plan").text)]
    assert again == ["file.ready"] * 6 + ["done"]
    assert len(model.planner.agents) == calls

    chat = client.get(f"/api/v1/chats/{chat_id}").json()
    assert chat["status"] == "ready"
    assert chat["planId"] == plan_id
    listed = client.get("/api/v1/chats").json()
    assert any(c["id"] == chat_id and c["planId"] == plan_id for c in listed)

    plan = client.get(f"/api/v1/plans/{plan_id}").json()
    assert plan["id"] == plan_id
    assert plan["title"] == "PhysioFlow"
    assert plan["versions"][0]["label"] == "v1"
    assert plan["versions"][0]["priceMin"] == plan["estimate"]["priceMin"]
    assert {f["name"] for f in plan["files"]} >= {"spec.md", "backlog.csv"}

    spec = client.get(f"/api/v1/plans/{plan_id}/files/spec.md")
    assert spec.status_code == 200
    assert spec.headers["content-type"].startswith("text/markdown")
    assert "attachment" in spec.headers["content-disposition"]
    assert "# PhysioFlow" in spec.text

    missing = client.get(f"/api/v1/plans/{plan_id}/files/secrets.txt")
    assert missing.status_code == 404
    assert client.get(f"/api/v1/plans/{uuid.uuid4()}").status_code == 404


def test_scope_change_saves_a_new_version_priced_on_the_server(api: Api) -> None:
    client, _, created = api
    chat_id = _new_chat(client, created)
    client.post(f"/api/v1/chats/{chat_id}/interview")
    plan_id = _events(client.post(f"/api/v1/chats/{chat_id}/plan").text)[-1][1]["planId"]
    before = client.get(f"/api/v1/plans/{plan_id}").json()

    res = client.post(
        f"/api/v1/plans/{plan_id}/versions",
        json={"included": {"exercises": False}, "change": "Moved exercises to later."},
    )
    assert res.status_code == 201
    v2 = res.json()
    assert v2["label"] == "v2 · Your edit"
    assert v2["priceMax"] < before["estimate"]["priceMax"]

    after = client.get(f"/api/v1/plans/{plan_id}").json()
    assert [v["label"] for v in after["versions"]] == ["v1", "v2 · Your edit"]
    assert next(f for f in after["features"] if f["id"] == "exercises")["included"] is False
    assert after["estimate"]["priceMax"] == v2["priceMax"]
