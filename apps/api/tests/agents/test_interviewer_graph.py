"""The interview loop end to end, with a scripted fake model (no API key, no network)."""

from typing import Any, TypeVar, cast

from langgraph.checkpoint.memory import InMemorySaver
from langgraph.types import Command
from pydantic import BaseModel

from app.agents.interviewer.graph import build_interview_graph
from app.agents.interviewer.nodes import InterviewContext, resume_payload
from app.agents.interviewer.schemas import InterviewerTurn, Option, Question, Triage

T = TypeVar("T", bound=BaseModel)


def _question(qid: str, title: str) -> Question:
    return Question(
        id=qid,
        title=title,
        body="Why it matters.",
        options=[Option(id="yes", label="Yes"), Option(id="no", label="No")],
        recommended="yes",
    )


class ScriptedModel:
    """Returns the next scripted turn and records every prompt it was given."""

    def __init__(self, turns: list[InterviewerTurn]) -> None:
        self._turns = list(turns)
        self.prompts: list[str] = []

    def __call__(self, agent: str, schema: type[T], *, system: str, user: str) -> T:
        if agent == "triage":  # the front desk accepts every test idea
            return cast(T, Triage(kind="app_idea", title="Test plan"))
        assert agent == "interviewer"
        assert "frontier" in system  # the real prompt file is loaded
        self.prompts.append(user)
        return cast(T, self._turns.pop(0))


def _run(model: ScriptedModel, **ctx: Any) -> tuple[Any, dict[str, Any], InterviewContext]:
    graph = build_interview_graph(InMemorySaver())
    config: dict[str, Any] = {"configurable": {"thread_id": "chat-1"}}
    return graph, config, InterviewContext(ask=model, **ctx)


def test_rounds_pause_resume_and_finish_with_a_brief() -> None:
    model = ScriptedModel(
        [
            InterviewerTurn(
                ready=False,
                why="Settle the platform first.",
                questions=[_question("platform", "Web or mobile?")],
            ),
            InterviewerTurn(
                ready=False,
                why="Now payments.",
                questions=[_question("payments", "Pay in the app?")],
            ),
            InterviewerTurn(
                ready=True, why="That's everything.", brief="- Mobile app\n- Payments at booking"
            ),
        ]
    )
    graph, config, ctx = _run(model)

    first = graph.invoke({"idea": "A booking app for physios"}, config, context=ctx)
    round_one = first["__interrupt__"][0].value
    assert round_one["round"] == 1
    assert [q["id"] for q in round_one["questions"]] == [
        "r1_platform"
    ]  # ids are prefixed per round

    second = graph.invoke(
        Command(resume=resume_payload({"r1_platform": {"optionId": "no"}})), config, context=ctx
    )
    round_two = second["__interrupt__"][0].value
    assert round_two["round"] == 2
    assert "Web or mobile? → No" in model.prompts[1]  # earlier answers reach the model

    final = graph.invoke(
        Command(resume=resume_payload({"r2_payments": {"skipped": True}})), config, context=ctx
    )
    assert final["status"] == "ready"
    assert final["brief"].startswith("- Mobile app")
    assert final.get("pending") is None
    assert len(final["rounds"]) == 2  # reducer appended both rounds
    assert "skipped (assume recommended: Yes)" in model.prompts[2]
    assert len(model.prompts) == 3  # answering never caused an extra model call


def test_last_allowed_round_forces_a_finish() -> None:
    model = ScriptedModel(
        [
            InterviewerTurn(ready=False, why="One thing.", questions=[_question("a", "A?")]),
            # The model wants to keep going, but max_rounds=1 has been reached.
            InterviewerTurn(ready=False, why="More.", questions=[_question("b", "B?")]),
        ]
    )
    graph, config, ctx = _run(model, max_rounds=1)

    graph.invoke({"idea": "An app for dog walkers"}, config, context=ctx)
    final = graph.invoke(
        Command(resume=resume_payload({})), config, context=ctx
    )  # skipped everything

    assert final["status"] == "ready"
    assert "last turn" in model.prompts[1]
    assert final["brief"]  # falls back to the recorded answers when the model wrote none


def test_question_count_is_capped() -> None:
    many = [_question(f"q{i}", f"Q{i}?") for i in range(8)]
    model = ScriptedModel([InterviewerTurn(ready=False, why="Lots.", questions=many)])
    graph, config, ctx = _run(model, max_questions=3)

    result = graph.invoke({"idea": "A CRM for florists"}, config, context=ctx)

    assert len(result["__interrupt__"][0].value["questions"]) == 3
