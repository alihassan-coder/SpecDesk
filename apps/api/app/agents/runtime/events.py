"""Turn a LangGraph run into Server-Sent Events for the browser.

Event names follow the contract in docs/ARCHITECTURE.md:
`agent.status`, `agent.note`, `question.round`, `interview.done`, `error`.
"""

import logging
from collections.abc import Generator, Iterator
from typing import Any

from fastapi.sse import ServerSentEvent
from langchain_core.runnables import RunnableConfig
from langgraph.types import Command, Interrupt

from app.agents.interviewer.graph import InterviewGraph
from app.agents.interviewer.nodes import InterviewContext, InterviewState
from app.agents.planner.graph import PlanGraph
from app.agents.planner.nodes import PlanContext, PlanState
from app.core.errors import AppError, humanize

logger = logging.getLogger("specdesk.agents")


def interview_events(
    graph: InterviewGraph,
    payload: InterviewState | Command[Any] | None,
    *,
    config: RunnableConfig,
    context: InterviewContext,
) -> Iterator[ServerSentEvent]:
    """Run the graph until it pauses or finishes, yielding events as they happen."""
    try:
        # LangGraph types its Command input as Command[Unknown], hence the ignore below.
        for mode, chunk in graph.stream(  # pyright: ignore[reportUnknownMemberType]
            payload, config, context=context, stream_mode=["custom", "updates"]
        ):
            if mode == "custom" and isinstance(chunk, dict):
                data: dict[str, Any] = dict(chunk)  # pyright: ignore[reportUnknownArgumentType]
                yield ServerSentEvent(event=str(data.pop("type", "agent.note")), data=data)
            elif mode == "updates" and isinstance(chunk, dict) and "__interrupt__" in chunk:
                for pause in _interrupts(chunk["__interrupt__"]):  # pyright: ignore[reportUnknownArgumentType]
                    yield ServerSentEvent(event="question.round", data={"round": pause.value})
        yield from current_state_events(graph, config, include_pending=False)
    except AppError as exc:
        yield ServerSentEvent(event="error", data=exc.error.model_dump())
    except Exception:
        logger.exception("Interview run failed")
        yield ServerSentEvent(event="error", data=humanize("model_unavailable").model_dump())


def current_state_events(
    graph: InterviewGraph, config: RunnableConfig, *, include_pending: bool
) -> Iterator[ServerSentEvent]:
    """Re-send where a thread stands — used after a page refresh, so no model call is repeated."""
    values: dict[str, Any] = dict(graph.get_state(config).values)
    if include_pending and (pending := values.get("pending")):
        yield ServerSentEvent(event="question.round", data={"round": pending})
    if values.get("status") == "ready":
        yield ServerSentEvent(event="interview.done", data={"brief": values.get("brief", "")})


def planning_events(
    graph: PlanGraph,
    payload: PlanState | None,
    *,
    config: RunnableConfig,
    context: PlanContext,
) -> Generator[ServerSentEvent, None, bool]:
    """Run the planners, yielding their status and notes. Returns True when the plan is built."""
    try:
        for chunk in graph.stream(  # pyright: ignore[reportUnknownMemberType]
            payload, config, context=context, stream_mode="custom"
        ):
            if isinstance(chunk, dict):
                data: dict[str, Any] = dict(chunk)  # pyright: ignore[reportUnknownArgumentType]
                yield ServerSentEvent(event=str(data.pop("type", "agent.note")), data=data)
        return True
    except AppError as exc:
        yield ServerSentEvent(event="error", data=exc.error.model_dump())
    except Exception:
        logger.exception("Planning run failed")
        yield ServerSentEvent(event="error", data=humanize("model_unavailable").model_dump())
    return False


def _interrupts(value: object) -> list[Interrupt]:
    items: list[object] = list(value) if isinstance(value, (list, tuple)) else [value]  # pyright: ignore[reportUnknownArgumentType]
    return [item for item in items if isinstance(item, Interrupt)]
