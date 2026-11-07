"""Planning chats: create one from an idea, run the interview over SSE, send answers.

Flow for the browser:
1. `POST /chats` with the idea → `{id}`.
2. `POST /chats/{id}/interview` → SSE stream until the first `question.round` (or `interview.done`).
   Calling it again later re-sends where the chat stands, without another model call.
3. `POST /chats/{id}/answers` → SSE stream until the next round or `interview.done`.
4. `POST /chats/{id}/plan` → SSE stream of the planning agents, then `file.ready` events and
   `done` with the plan id. Calling it again after it finished just re-sends `done`.
"""

import threading
import uuid
from collections.abc import Callable, Iterator
from datetime import datetime
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends
from fastapi.sse import EventSourceResponse, ServerSentEvent
from langchain_core.runnables import RunnableConfig
from langgraph.checkpoint.base import BaseCheckpointSaver
from langgraph.types import Command, StateSnapshot
from pydantic import Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.agents.interviewer.graph import InterviewGraph, build_interview_graph
from app.agents.interviewer.nodes import (
    AnsweredRound,
    InterviewContext,
    InterviewState,
    clean_answers,
    resume_payload,
)
from app.agents.interviewer.schemas import Answer, CamelModel
from app.agents.llm.ask import AskModel
from app.agents.planner.graph import build_plan_graph, plan_thread_id
from app.agents.planner.nodes import PlanContext, PlanState
from app.agents.runtime.checkpointer import get_checkpointer
from app.agents.runtime.events import current_state_events, interview_events, planning_events
from app.agents.service import get_ask_for_chat
from app.core.config import get_settings
from app.core.errors import AppError
from app.core.owner import CurrentUser, Owner
from app.db.models import Chat, Message, Plan
from app.db.session import get_session, session_scope
from app.services.email import send_plan_ready
from app.services.plans import current_version, file_cards, plan_for_chat, save_first_version

router = APIRouter(prefix="/chats", tags=["chats"])

Depth = Literal["quick", "balanced", "thorough"]
MAX_ROUNDS: dict[Depth, int] = {"quick": 2, "balanced": 3, "thorough": 4}


# ---------- request / response shapes ----------


class StartChat(CamelModel):
    # Anything goes here — "hi" included; the triage step decides when a real idea has arrived.
    idea: str = Field(min_length=1, max_length=4000)
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
    # needs_idea (still chatting) | interviewing | ready — where the interview stands
    stage: str = "interviewing"
    conversation: list[dict[str, Any]] = []
    rounds: list[dict[str, Any]] = []
    pending: dict[str, Any] | None = None
    brief: str | None = None


class SendAnswers(CamelModel):
    answers: dict[str, Answer]
    # "Generate plan now": these answers are the last; the interviewer writes the brief.
    finish: bool = False


class SendMessage(CamelModel):
    text: str = Field(min_length=1, max_length=4000)


class Feedback(CamelModel):
    target: str = Field(min_length=1, max_length=50, description='e.g. "round:2" or "plan"')
    rating: Literal["up", "down"]


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
        stage=str(values.get("status") or "interviewing"),
        conversation=values.get("conversation", []),
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
    if values.get("status") == "needs_idea" and not snapshot.next:
        return  # waiting for the founder to describe their app (see POST /messages)
    state, depth = _start_settings(session, chat)
    context = InterviewContext(ask=ask_for(chat.id), max_rounds=MAX_ROUNDS[depth])
    # `snapshot.next` is set when a step failed part-way (e.g. no API key yet): passing `None`
    # retries that step from the saved checkpoint instead of starting a second interview.
    yield from _run(graph, None if snapshot.next else state, config, context, chat_id=chat.id)


def chat_needs_idea(chat: OwnedChat, checkpointer: CheckpointerDep) -> Chat:
    values = build_interview_graph(checkpointer).get_state(_thread(chat)).values
    if values.get("status") != "needs_idea":
        raise AppError(
            "interview_started",
            status_code=409,
            title="The interview has already started",
            message="Your idea is in. Answer the questions above to shape the plan.",
            action="Refresh the page to see the latest questions.",
        )
    return chat


@router.post("/{chat_id}/messages", response_class=EventSourceResponse)
def send_message(
    body: SendMessage,
    chat: Annotated[Chat, Depends(chat_needs_idea)],
    session: SessionDep,
    checkpointer: CheckpointerDep,
    ask_for: AskFactoryDep,
) -> Iterator[ServerSentEvent]:
    """A message before the interview starts. Triage decides whether it's an app idea yet."""
    graph = build_interview_graph(checkpointer)
    _, depth = _start_settings(session, chat)
    context = InterviewContext(ask=ask_for(chat.id), max_rounds=MAX_ROUNDS[depth])
    turn: InterviewState = {
        "idea": chat.idea,
        "conversation": [{"role": "user", "text": body.text.strip()}],
    }
    yield from _run(graph, turn, _thread(chat), context, chat_id=chat.id)


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
    payload = Command(resume=resume_payload(answers, finish=body.finish))
    yield from _run(graph, payload, config, context, chat_id=chat.id)


def no_plan_yet(chat: OwnedChat, session: SessionDep) -> Chat:
    if plan_for_chat(session, chat.id) is not None:
        raise AppError(
            "plan_exists",
            status_code=409,
            title="The plan is already built",
            message="Answers can't change after the plan is made.",
            action="Change features in the plan, or start a new plan.",
        )
    return chat


def _checkpoint(
    graph: InterviewGraph, chat: Chat, match: Callable[[StateSnapshot], bool]
) -> RunnableConfig:
    """The newest saved step that `match` accepts — the point to rewind to."""
    for snap in graph.get_state_history(_thread(chat)):
        if match(snap):
            return snap.config
    raise AppError(
        "round_not_found",
        status_code=404,
        title="That question round isn't here",
        message="It may have been replaced when answers were edited.",
        action="Refresh the page to see the latest questions.",
    )


def round_asked(
    number: int, chat: Annotated[Chat, Depends(no_plan_yet)], checkpointer: CheckpointerDep
) -> RunnableConfig:
    """The saved step where round `number` was waiting for answers (404 if there isn't one)."""

    def waiting_on_round(snap: StateSnapshot) -> bool:
        pending: dict[str, Any] = dict(snap.values.get("pending") or {})
        return snap.next == ("ask_founder",) and pending.get("round") == number

    return _checkpoint(build_interview_graph(checkpointer), chat, waiting_on_round)


def before_round(
    number: int, chat: Annotated[Chat, Depends(no_plan_yet)], checkpointer: CheckpointerDep
) -> RunnableConfig:
    """The saved step just before the interviewer wrote round `number`."""

    def is_before(snap: StateSnapshot) -> bool:
        rounds: list[Any] = list(snap.values.get("rounds", []))
        return snap.next == ("interviewer",) and len(rounds) == number - 1

    return _checkpoint(build_interview_graph(checkpointer), chat, is_before)


@router.post("/{chat_id}/rounds/{number}/answers", response_class=EventSourceResponse)
def edit_answers(
    body: SendAnswers,
    chat: Annotated[Chat, Depends(no_plan_yet)],
    at: Annotated[RunnableConfig, Depends(round_asked)],
    session: SessionDep,
    checkpointer: CheckpointerDep,
    ask_for: AskFactoryDep,
) -> Iterator[ServerSentEvent]:
    """Change the answers of an earlier round; later rounds are dropped and asked again."""
    graph = build_interview_graph(checkpointer)
    pending: dict[str, Any] = dict(graph.get_state(at).values["pending"])
    answers = {
        qid: a.model_dump(by_alias=True, exclude_none=True) for qid, a in body.answers.items()
    }
    # Fork the thread at that round as if `ask_founder` had just received these answers.
    # (Resuming the old interrupt would replay the answers saved with it.)
    update: dict[str, Any] = {
        "rounds": [AnsweredRound(round=pending, answers=clean_answers(pending, answers))],
        "pending": None,
    }
    if body.finish:
        update["finish"] = True
    forked = graph.update_state(at, update, as_node="ask_founder")
    _, depth = _start_settings(session, chat)
    context = InterviewContext(ask=ask_for(chat.id), max_rounds=MAX_ROUNDS[depth])
    yield from _run(graph, None, forked, context, chat_id=chat.id)


@router.post("/{chat_id}/rounds/{number}/regenerate", response_class=EventSourceResponse)
def regenerate_round(
    chat: Annotated[Chat, Depends(no_plan_yet)],
    at: Annotated[RunnableConfig, Depends(before_round)],
    session: SessionDep,
    checkpointer: CheckpointerDep,
    ask_for: AskFactoryDep,
) -> Iterator[ServerSentEvent]:
    """Ask round `number` again with fresh questions (and drop anything after it)."""
    graph = build_interview_graph(checkpointer)
    _, depth = _start_settings(session, chat)
    context = InterviewContext(ask=ask_for(chat.id), max_rounds=MAX_ROUNDS[depth])
    yield from _run(graph, None, at, context, chat_id=chat.id)


@router.post("/{chat_id}/feedback", status_code=201)
def send_feedback(body: Feedback, chat: OwnedChat, session: SessionDep) -> dict[str, str]:
    """Thumbs up/down on a question round or the plan. The admin sees these per lead."""
    session.add(
        Message(
            chat_id=chat.id,
            role="user",
            kind="feedback",
            content={"target": body.target, "rating": body.rating},
        )
    )
    session.commit()
    return {"status": "saved"}


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
    user: CurrentUser,
    session: SessionDep,
    checkpointer: CheckpointerDep,
    ask_for: AskFactoryDep,
) -> Iterator[ServerSentEvent]:
    existing = plan_for_chat(session, chat.id)
    if existing is None:
        graph = build_plan_graph(checkpointer)
        # Two agents at a time: faster than one by one, gentler on per-minute token limits.
        config: RunnableConfig = {
            "configurable": {"thread_id": plan_thread_id(str(chat.id))},
            "max_concurrency": 2,
        }
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
        if user.email:
            _email_plan_ready(user.email, plan_id, data)
    else:
        plan_id = existing.id
        version = current_version(session, existing)
        data = dict(version.data) if version else {}

    for card in file_cards(plan_id, data):
        yield ServerSentEvent(event="file.ready", data={"file": card})
    yield ServerSentEvent(event="done", data={"planId": str(plan_id)})


def _email_plan_ready(to: str, plan_id: uuid.UUID, data: dict[str, Any]) -> None:
    """Sent in the background so the stream isn't held up; failures are only logged."""
    est: dict[str, Any] = dict(data.get("estimate") or {})
    price = f"${int(est.get('priceMin', 0)):,} – ${int(est.get('priceMax', 0)):,}"
    url = f"{get_settings().web_url.rstrip('/')}/plan/{plan_id}"
    threading.Thread(
        target=send_plan_ready,
        args=(to, str(data.get("title") or "Your plan"), url, price, int(est.get("weeks", 0))),
        daemon=True,
    ).start()


def _run(
    graph: InterviewGraph,
    payload: InterviewState | Command[Any] | None,
    config: RunnableConfig,
    context: InterviewContext,
    *,
    chat_id: uuid.UUID,
) -> Iterator[ServerSentEvent]:
    # Chat status moves on (interviewing → generating) when the planning pipeline lands; the
    # interview itself only adds rounds and the brief to the thread state.
    yield from interview_events(graph, payload, config=config, context=context)
    _sync_idea(graph, chat_id)


def _sync_idea(graph: InterviewGraph, chat_id: uuid.UUID) -> None:
    """Once triage accepts an idea, the chat's idea and title follow the founder's words."""
    values = graph.get_state({"configurable": {"thread_id": str(chat_id)}}).values
    if values.get("status") != "interviewing" or not values.get("title"):
        return
    with session_scope() as s:
        row = s.get(Chat, chat_id)
        if row is not None and row.idea != values["idea"]:
            row.idea = str(values["idea"])
            row.title = _title(str(values["title"]))


def _title(idea: str) -> str:
    first_line = idea.splitlines()[0].strip()
    return first_line if len(first_line) <= 80 else first_line[:77].rstrip() + "…"
