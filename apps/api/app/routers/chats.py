"""Planning chats: create one from an idea, run the interview over SSE, send answers.

Flow for the browser:
1. `POST /chats` with the idea → `{id}`.
2. `POST /chats/{id}/interview` → SSE stream until the first `question.round` (or `interview.done`).
   Calling it again later re-sends where the chat stands, without another model call.
3. `POST /chats/{id}/answers` → SSE stream until the next round or `interview.done`.
4. `POST /chats/{id}/plan` → SSE stream of the planning agents, then `file.ready` events and
   `done` with the plan id. Calling it again after it finished just re-sends `done`.
"""

import uuid
from collections.abc import Callable, Iterator
from datetime import datetime
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends
from fastapi.sse import EventSourceResponse, ServerSentEvent
from langchain_core.runnables import RunnableConfig
from langgraph.checkpoint.base import BaseCheckpointSaver
from langgraph.types import Command
from pydantic import Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.agents.interviewer.graph import InterviewGraph, build_interview_graph
from app.agents.interviewer.nodes import InterviewContext, InterviewState, resume_payload
from app.agents.interviewer.schemas import Answer, CamelModel
from app.agents.llm.ask import AskModel
from app.agents.planner.graph import build_plan_graph, plan_thread_id
from app.agents.planner.nodes import PlanContext, PlanState
from app.agents.runtime.checkpointer import get_checkpointer
from app.agents.runtime.events import current_state_events, interview_events, planning_events
from app.agents.service import get_ask_for_chat
from app.core.errors import AppError
from app.core.owner import Owner
from app.db.models import Chat, Message, Plan
from app.db.session import get_session, session_scope
from app.services.plans import current_version, file_cards, plan_for_chat, save_first_version

router = APIRouter(prefix="/chats", tags=["chats"])

Depth = Literal["quick", "balanced", "thorough"]
MAX_ROUNDS: dict[Depth, int] = {"quick": 2, "balanced": 3, "thorough": 4}


# ---------- request / response shapes ----------


class StartChat(CamelModel):
    idea: str = Field(min_length=10, max_length=4000)
    platform: str | None = Field(default=None, max_length=40)
    budget: str | None = Field(default=None, max_length=40)
    depth: Depth = "balanced"


class ChatSummary(CamelModel):
    id: uuid.UUID
    title: str
    status: str
    updated_at: datetime | None = None
    plan_id: uuid.UUID | None = None


class ChatDetail(ChatSummary):
    idea: str
    rounds: list[dict[str, Any]] = []
    pending: dict[str, Any] | None = None
    brief: str | None = None


class SendAnswers(CamelModel):
    answers: dict[str, Answer]


# ---------- dependencies ----------
# They run before any streaming starts, so their errors are still proper HTTP errors.

SessionDep = Annotated[Session, Depends(get_session)]
CheckpointerDep = Annotated[BaseCheckpointSaver[str], Depends(get_checkpointer)]
AskFactory = Callable[[uuid.UUID], AskModel]
AskFactoryDep = Annotated[AskFactory, Depends(get_ask_for_chat)]


def owned_chat(chat_id: uuid.UUID, owner: Owner, session: SessionDep) -> Chat:
    chat = session.get(Chat, chat_id)
    if chat is None or chat.owner_id != owner:
        raise AppError("not_found", status_code=404)  # never reveal that someone else's chat exists
    return chat


OwnedChat = Annotated[Chat, Depends(owned_chat)]


def chat_waiting_for_answers(chat: OwnedChat, checkpointer: CheckpointerDep) -> Chat:
    if not build_interview_graph(checkpointer).get_state(_thread(chat)).values.get("pending"):
        raise AppError(
            "nothing_to_answer",
            status_code=409,
            title="There's no question waiting",
            message="This plan isn't waiting for answers right now.",
            action="Refresh the page to see where the plan stands.",
        )
    return chat


def _thread(chat: Chat) -> RunnableConfig:
    return {"configurable": {"thread_id": str(chat.id)}}


def _start_settings(session: Session, chat: Chat) -> tuple[InterviewState, Depth]:
    """The idea plus the founder's prompt-box choices, saved when the chat was created."""
    first = (
        session.query(Message)
        .filter_by(chat_id=chat.id, kind="idea")
        .order_by(Message.created_at)
        .first()
    )
    content: dict[str, Any] = dict(first.content) if first else {}
    hints = {k: str(v) for k, v in content.get("hints", {}).items() if v}
    depth: Depth = content.get("depth", "balanced")
    state: InterviewState = {"idea": chat.idea, "hints": hints} if hints else {"idea": chat.idea}
    return state, depth


# ---------- routes ----------


@router.post("", status_code=201)
def start_chat(body: StartChat, owner: Owner, session: SessionDep) -> ChatSummary:
    idea = body.idea.strip()
    chat = Chat(owner_id=owner, title=_title(idea), idea=idea, status="interviewing")
    session.add(chat)
    session.flush()
    hints = {"platform": body.platform, "budget": body.budget}
    session.add(
        Message(
            chat_id=chat.id,
            role="user",
            kind="idea",
            content={"idea": idea, "hints": hints, "depth": body.depth},
        )
    )
    session.commit()
    return ChatSummary(id=chat.id, title=chat.title, status=chat.status)


@router.get("")
def list_chats(owner: Owner, session: SessionDep) -> list[ChatSummary]:
    """The owner's chats, newest first, for the sidebar."""
    rows = session.execute(
        select(Chat, Plan.id)
        .outerjoin(Plan, Plan.chat_id == Chat.id)
        .where(Chat.owner_id == owner)
        .order_by(Chat.updated_at.desc())
        .limit(100)
    ).all()
    return [
        ChatSummary(
            id=c.id, title=c.title, status=c.status, updated_at=c.updated_at, plan_id=plan_id
        )
        for c, plan_id in rows
    ]


@router.get("/{chat_id}")
def get_chat(chat: OwnedChat, session: SessionDep, checkpointer: CheckpointerDep) -> ChatDetail:
    values: dict[str, Any] = dict(
        build_interview_graph(checkpointer).get_state(_thread(chat)).values
    )
    plan = plan_for_chat(session, chat.id)
    return ChatDetail(
        id=chat.id,
        title=chat.title,
        status=chat.status,
        updated_at=chat.updated_at,
        plan_id=plan.id if plan else None,
        idea=chat.idea,
        rounds=values.get("rounds", []),
        pending=values.get("pending"),
        brief=values.get("brief"),
    )


@router.post("/{chat_id}/interview", response_class=EventSourceResponse)
def run_interview(
    chat: OwnedChat, session: SessionDep, checkpointer: CheckpointerDep, ask_for: AskFactoryDep
) -> Iterator[ServerSentEvent]:
    graph = build_interview_graph(checkpointer)
    config = _thread(chat)
    snapshot = graph.get_state(config)
    values: dict[str, Any] = dict(snapshot.values)
    if values.get("pending") or values.get("status") == "ready":
        # Waiting for answers or finished: just say where it stands (no model call).
        yield from current_state_events(graph, config, include_pending=True)
        return
    state, depth = _start_settings(session, chat)
    context = InterviewContext(ask=ask_for(chat.id), max_rounds=MAX_ROUNDS[depth])
    # `snapshot.next` is set when a step failed part-way (e.g. no API key yet): passing `None`
    # retries that step from the saved checkpoint instead of starting a second interview.
    yield from _run(graph, None if snapshot.next else state, config, context)


@router.post("/{chat_id}/answers", response_class=EventSourceResponse)
def send_answers(
    body: SendAnswers,
    chat: Annotated[Chat, Depends(chat_waiting_for_answers)],
    session: SessionDep,
    checkpointer: CheckpointerDep,
    ask_for: AskFactoryDep,
) -> Iterator[ServerSentEvent]:
    graph = build_interview_graph(checkpointer)
    config = _thread(chat)
    _, depth = _start_settings(session, chat)
    context = InterviewContext(ask=ask_for(chat.id), max_rounds=MAX_ROUNDS[depth])
    answers = {
        qid: a.model_dump(by_alias=True, exclude_none=True) for qid, a in body.answers.items()
    }
    yield from _run(graph, Command(resume=resume_payload(answers)), config, context)


def interview_finished(chat: OwnedChat, checkpointer: CheckpointerDep) -> str:
    """The interview's brief. Planning can only start once the interview has one."""
    values = build_interview_graph(checkpointer).get_state(_thread(chat)).values
    brief = values.get("brief")
    if values.get("status") != "ready" or not brief:
        raise AppError(
            "interview_not_finished",
            status_code=409,
            title="A few questions are still open",
            message="The plan is built from your answers, and some questions aren't answered yet.",
            action="Answer the questions above, then the plan starts on its own.",
        )
    return str(brief)


@router.post("/{chat_id}/plan", response_class=EventSourceResponse)
def build_plan(
    chat: OwnedChat,
    brief: Annotated[str, Depends(interview_finished)],
    session: SessionDep,
    checkpointer: CheckpointerDep,
    ask_for: AskFactoryDep,
) -> Iterator[ServerSentEvent]:
    existing = plan_for_chat(session, chat.id)
    if existing is None:
        graph = build_plan_graph(checkpointer)
        config: RunnableConfig = {"configurable": {"thread_id": plan_thread_id(str(chat.id))}}
        snapshot = graph.get_state(config)
        if "plan" not in snapshot.values:
            chat.status = "generating"
            session.commit()
            start: PlanState = {"idea": chat.idea, "brief": brief}
            ok = yield from planning_events(
                graph,
                None if snapshot.next else start,  # retry continues from the failed step
                config=config,
                context=PlanContext(ask=ask_for(chat.id)),
            )
            if not ok:
                with session_scope() as s:
                    if (row := s.get(Chat, chat.id)) is not None:
                        row.status = "failed"
                return
        data: dict[str, Any] = dict(graph.get_state(config).values["plan"])
        with session_scope() as s:
            row = s.get(Chat, chat.id)
            assert row is not None
            existing = save_first_version(s, row, data)
            s.flush()
            plan_id = existing.id
    else:
        plan_id = existing.id
        version = current_version(session, existing)
        data = dict(version.data) if version else {}

    for card in file_cards(plan_id, data):
        yield ServerSentEvent(event="file.ready", data={"file": card})
    yield ServerSentEvent(event="done", data={"planId": str(plan_id)})


def _run(
    graph: InterviewGraph,
    payload: InterviewState | Command[Any] | None,
    config: RunnableConfig,
    context: InterviewContext,
) -> Iterator[ServerSentEvent]:
    # Chat status moves on (interviewing → generating) when the planning pipeline lands; the
    # interview itself only adds rounds and the brief to the thread state.
    yield from interview_events(graph, payload, config=config, context=context)


def _title(idea: str) -> str:
    first_line = idea.splitlines()[0].strip()
    return first_line if len(first_line) <= 80 else first_line[:77].rstrip() + "…"
