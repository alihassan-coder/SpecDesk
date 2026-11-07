"""The two interview nodes.

`interviewer` calls the model and decides: ask another round, or finish.
`ask_founder` only pauses the graph with `interrupt()` and records the answers.
They are separate because LangGraph re-runs a paused node from the top on resume — keeping the
model call out of the paused node means answering never triggers a second (paid) model call.
"""

import json
import operator
from dataclasses import dataclass
from typing import Annotated, Any, Literal, Required, TypedDict, cast

from langgraph.config import get_stream_writer
from langgraph.runtime import Runtime
from langgraph.types import Command, interrupt
from pydantic import ValidationError

from app.agents.interviewer.schemas import Answer, InterviewerTurn, Question, QuestionRound
from app.agents.llm.ask import AskModel
from app.agents.prompts import load_prompt

AGENT = "interviewer"


class AnsweredRound(TypedDict):
    round: dict[str, Any]  # QuestionRound, camelCase JSON
    answers: dict[str, dict[str, Any]]  # question id -> Answer, camelCase JSON


class InterviewState(TypedDict, total=False):
    idea: Required[str]
    hints: dict[str, str]  # optional founder hints from the prompt box: platform, budget …
    rounds: Annotated[list[AnsweredRound], operator.add]  # reducer: each round is appended
    pending: dict[str, Any] | None  # the round currently waiting for answers
    brief: str
    status: Literal["interviewing", "ready"]


@dataclass(frozen=True, slots=True)
class InterviewContext:
    """Passed at run time (not saved in checkpoints)."""

    ask: AskModel
    max_rounds: int = 3
    max_questions: int = 5


# ---------- interviewer ----------


def interviewer(
    state: InterviewState, runtime: Runtime[InterviewContext]
) -> Command[Literal["ask_founder", "__end__"]]:
    ctx = runtime.context
    rounds = state.get("rounds", [])
    must_finish = len(rounds) >= ctx.max_rounds
    emit = get_stream_writer()
    emit({"type": "agent.status", "agent": AGENT, "status": "working"})

    turn = ctx.ask(
        AGENT,
        InterviewerTurn,
        system=load_prompt(AGENT),
        user=_describe_situation(
            state,
            round_number=len(rounds) + 1,
            must_finish=must_finish,
            max_questions=ctx.max_questions,
        ),
    )

    if turn.ready or must_finish or not turn.questions:
        brief = turn.brief.strip() or _fallback_brief(state)
        emit({"type": "agent.note", "agent": AGENT, "text": turn.why})
        emit({"type": "agent.status", "agent": AGENT, "status": "done"})
        return Command(
            update={"brief": brief, "status": "ready", "pending": None}, goto="__end__"
        )  # == langgraph END; a literal keeps the return type exact

    next_round = _number_round(len(rounds) + 1, turn.questions[: ctx.max_questions])
    emit({"type": "agent.note", "agent": AGENT, "text": turn.why})
    return Command(
        update={
            "pending": next_round.model_dump(by_alias=True, exclude_none=True),
            "status": "interviewing",
        },
        goto="ask_founder",
    )


def _number_round(number: int, questions: list[Question]) -> QuestionRound:
    """Prefix ids with the round number so answers from different rounds never collide."""
    renamed = [q.model_copy(update={"id": f"r{number}_{q.id}"}) for q in questions]
    unique = list({q.id: q for q in renamed}.values())
    return QuestionRound(round=number, questions=unique)


def _describe_situation(
    state: InterviewState, *, round_number: int, must_finish: bool, max_questions: int
) -> str:
    parts = [f"<idea>\n{state['idea'].strip()}\n</idea>"]
    if hints := state.get("hints"):
        parts.append(
            "<founder_hints>\n"
            + "\n".join(f"- {k}: {v}" for k, v in hints.items())
            + "\n</founder_hints>"
        )
    if rounds := state.get("rounds"):
        parts.append(
            "<earlier_rounds>\n"
            + "\n\n".join(_describe_round(r) for r in rounds)
            + "\n</earlier_rounds>"
        )
    if must_finish:
        parts.append(
            "This is the last turn: set ready to true and write the brief. "
            "Assume your recommendations for anything still open."
        )
    else:
        parts.append(
            f"This is round {round_number}. Ask at most {max_questions} questions, "
            "or finish if nothing important is open."
        )
    return "\n\n".join(parts)


def _describe_round(answered: AnsweredRound) -> str:
    lines: list[str] = [f"Round {answered['round'].get('round')}:"]
    for q in answered["round"].get("questions", []):
        answer = answered["answers"].get(q["id"], {"skipped": True})
        lines.append(f"- {q['title']} → {_answer_text(q, answer)}")
    return "\n".join(lines)


def _answer_text(question: dict[str, Any], answer: dict[str, Any]) -> str:
    if text := (answer.get("text") or "").strip():
        return f'"{text}" (in their own words)'
    labels = {o["id"]: o["label"] for o in question.get("options", [])}
    option = answer.get("optionId")
    if answer.get("skipped") or option not in labels:
        recommended = labels.get(question.get("recommended", ""), "")
        return f"skipped (assume recommended: {recommended})" if recommended else "skipped"
    return labels[option]


def _fallback_brief(state: InterviewState) -> str:
    return "\n".join(_describe_round(r) for r in state.get("rounds", [])) or state["idea"]


# ---------- ask_founder ----------


def ask_founder(state: InterviewState) -> dict[str, Any]:
    pending = state.get("pending")
    if (
        not pending
    ):  # nothing to ask (defensive; the interviewer always sets it before routing here)
        return {}
    resumed: object = interrupt(pending)  # pauses here until Command(resume=resume_payload(...))
    raw: object = (
        cast(dict[str, object], resumed).get("answers") if isinstance(resumed, dict) else resumed
    )
    return {
        "rounds": [AnsweredRound(round=pending, answers=clean_answers(pending, raw))],
        "pending": None,
    }


def resume_payload(answers: dict[str, Any]) -> dict[str, Any]:
    """Wrap answers for `Command(resume=...)`.

    LangGraph reads a bare dict as a map of interrupt ids → values, so an empty answers dict
    (the founder skipped everything) would resume nothing. The `answers` key keeps it a value.
    """
    return {"answers": answers}


def clean_answers(pending: dict[str, Any], raw: object) -> dict[str, dict[str, Any]]:
    """Keep only answers to this round's questions; anything unreadable counts as skipped."""
    if isinstance(raw, str):
        try:
            raw = json.loads(raw)
        except json.JSONDecodeError:
            raw = {}
    given: dict[str, Any] = raw if isinstance(raw, dict) else {}  # pyright: ignore[reportUnknownVariableType]
    cleaned: dict[str, dict[str, Any]] = {}
    for question in pending.get("questions", []):
        qid: str = question["id"]
        option_ids = {o["id"] for o in question.get("options", [])}
        try:
            answer = Answer.model_validate(given.get(qid) or {"skipped": True})
        except ValidationError:
            answer = Answer(skipped=True)
        if answer.option_id is not None and answer.option_id not in option_ids:
            answer = Answer(skipped=True)
        cleaned[qid] = answer.model_dump(by_alias=True, exclude_none=True)
    return cleaned
