"""Rename and delete a chat, over HTTP with fake models and an in-memory checkpointer.

Needs the dev database; skipped when it isn't reachable. Chats left behind are deleted.
"""

import uuid
from collections.abc import Iterator
from typing import TypeVar, cast

import pytest
from fastapi.testclient import TestClient
from langchain_core.runnables import RunnableConfig
from langgraph.checkpoint.memory import InMemorySaver
from pydantic import BaseModel
from sqlalchemy import select, text

from app.agents.interviewer.schemas import InterviewerTurn, Triage
from app.agents.planner.graph import plan_thread_id
from app.agents.runtime.checkpointer import get_checkpointer
from app.agents.service import get_ask_for_chat
from app.core.owner import AuthUser, current_user
from app.db.models import Chat, Plan, PlanVersion
from app.db.session import get_engine, session_scope
from app.main import create_app

from .agents.planner_fakes import FakePlanner
from .agents.sse import parse_events

T = TypeVar("T", bound=BaseModel)

FOUNDER = AuthUser(id="test-manage-founder", email="founder@example.com", is_admin=False)
STRANGER = AuthUser(id="test-manage-stranger", email="stranger@example.com", is_admin=False)


class FakeEverything:
    """Interviewer finishes at once; planners get canned outputs."""

    def __init__(self) -> None:
        self.planner = FakePlanner()

    def __call__(self, agent: str, schema: type[T], *, system: str, user: str) -> T:
        if agent == "triage":  # the front desk accepts every test idea
            return cast(T, Triage(kind="app_idea", title="Test plan"))
        if agent == "interviewer":
            return cast(T, InterviewerTurn(ready=True, why="Clear enough.", brief="- Web app"))
        return self.planner(agent, schema, system=system, user=user)


class Api:
    def __init__(self) -> None:
        self.saver = InMemorySaver()
        self.model = FakeEverything()
        self.created: list[uuid.UUID] = []

    def client(self, user: AuthUser) -> TestClient:
        app = create_app()
        app.dependency_overrides[get_checkpointer] = lambda: self.saver
        app.dependency_overrides[current_user] = lambda: user

        def ask_for(_chat_id: uuid.UUID) -> FakeEverything:
            return self.model

        app.dependency_overrides[get_ask_for_chat] = lambda: ask_for
        return TestClient(app)

    def new_chat(self, client: TestClient) -> str:
        res = client.post("/api/v1/chats", json={"idea": "A booking app for physiotherapists"})
        chat_id = str(res.json()["id"])
        self.created.append(uuid.UUID(chat_id))
        return chat_id

    def has_thread(self, thread_id: str) -> bool:
        config: RunnableConfig = {"configurable": {"thread_id": thread_id}}
        return self.saver.get_tuple(config) is not None


@pytest.fixture
def api() -> Iterator[Api]:
    try:
        with get_engine().connect() as conn:
            conn.execute(text("select 1"))
    except Exception:  # no DB configured or reachable
        pytest.skip("dev database not reachable")
    state = Api()
    yield state
    with session_scope() as s:
        for chat_id in state.created:
            if (chat := s.get(Chat, chat_id)) is not None:
                s.delete(chat)


def test_rename_trims_the_title_and_returns_the_summary(api: Api) -> None:
    client = api.client(FOUNDER)
    chat_id = api.new_chat(client)

    res = client.patch(f"/api/v1/chats/{chat_id}", json={"title": "  PhysioFlow MVP  "})

    assert res.status_code == 200
    body = res.json()
    assert body["id"] == chat_id
    assert body["title"] == "PhysioFlow MVP"
    assert body["status"] == "interviewing"
    assert body["planId"] is None
    assert "updatedAt" in body
    assert client.get(f"/api/v1/chats/{chat_id}").json()["title"] == "PhysioFlow MVP"


@pytest.mark.parametrize("title", ["", "   ", "x" * 201])
def test_rename_rejects_empty_or_too_long_titles(api: Api, title: str) -> None:
    client = api.client(FOUNDER)
    chat_id = api.new_chat(client)

    res = client.patch(f"/api/v1/chats/{chat_id}", json={"title": title})

    assert res.status_code == 422
    assert {"code", "title", "message", "action"} <= set(res.json()["error"])


def test_delete_removes_the_chat_its_plan_and_both_threads(api: Api) -> None:
    client = api.client(FOUNDER)
    chat_id = api.new_chat(client)
    client.post(f"/api/v1/chats/{chat_id}/interview")
    plan_id = parse_events(client.post(f"/api/v1/chats/{chat_id}/plan").text)[-1][1]["planId"]
    assert api.has_thread(chat_id)
    assert api.has_thread(plan_thread_id(chat_id))

    res = client.delete(f"/api/v1/chats/{chat_id}")

    assert res.status_code == 204
    assert res.content == b""
    with session_scope() as s:
        assert s.get(Chat, uuid.UUID(chat_id)) is None
        assert s.get(Plan, uuid.UUID(plan_id)) is None
        versions = s.scalars(select(PlanVersion).where(PlanVersion.plan_id == plan_id)).all()
        assert versions == []
    assert not api.has_thread(chat_id)
    assert not api.has_thread(plan_thread_id(chat_id))
    assert client.get(f"/api/v1/chats/{chat_id}").status_code == 404
    assert client.get(f"/api/v1/plans/{plan_id}").status_code == 404


def test_someone_elses_chat_is_a_friendly_404(api: Api) -> None:
    owner = api.client(FOUNDER)
    chat_id = api.new_chat(owner)
    stranger = api.client(STRANGER)

    renamed = stranger.patch(f"/api/v1/chats/{chat_id}", json={"title": "Mine now"})
    deleted = stranger.delete(f"/api/v1/chats/{chat_id}")

    for res in (renamed, deleted):
        assert res.status_code == 404
        assert res.json()["error"]["code"] == "not_found"
    assert owner.get(f"/api/v1/chats/{chat_id}").json()["title"] != "Mine now"


def test_unknown_chat_is_a_404(api: Api) -> None:
    client = api.client(FOUNDER)
    assert client.delete(f"/api/v1/chats/{uuid.uuid4()}").status_code == 404
    assert client.patch(f"/api/v1/chats/{uuid.uuid4()}", json={"title": "x"}).status_code == 404
