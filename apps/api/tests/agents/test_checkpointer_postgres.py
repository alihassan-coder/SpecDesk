"""Pausing on the real Postgres checkpointer survives a 'restart' (a brand-new graph instance)."""

# LangGraph types its invoke() input as Command[Unknown]; silence that one library gap here.
# pyright: reportUnknownMemberType=false

import uuid
from typing import TypeVar, cast

import pytest
from langchain_core.runnables import RunnableConfig
from langgraph.types import Command
from pydantic import BaseModel

from app.agents.interviewer.graph import build_interview_graph
from app.agents.interviewer.nodes import InterviewContext, resume_payload
from app.agents.interviewer.schemas import InterviewerTurn, Option, Question
from app.agents.runtime.checkpointer import get_checkpointer
from app.core.config import get_settings

T = TypeVar("T", bound=BaseModel)


class Script:
    def __init__(self, turns: list[InterviewerTurn]) -> None:
        self.turns = turns

    def __call__(self, agent: str, schema: type[T], *, system: str, user: str) -> T:
        return cast(T, self.turns.pop(0))


@pytest.mark.skipif(get_settings().database_url is None, reason="no dev database configured")
def test_paused_interview_resumes_in_a_new_graph_instance() -> None:
    question = Question(
        id="q",
        title="Q?",
        body=".",
        options=[Option(id="a", label="A"), Option(id="b", label="B")],
        recommended="a",
    )
    script = Script(
        [
            InterviewerTurn(ready=False, why=".", questions=[question]),
            InterviewerTurn(ready=True, why=".", brief="done"),
        ]
    )
    ctx = InterviewContext(ask=script)
    thread_id = f"test-{uuid.uuid4()}"
    config: RunnableConfig = {"configurable": {"thread_id": thread_id}}
    saver = get_checkpointer()
    try:
        paused = build_interview_graph(saver).invoke(
            {"idea": "An app for tutors"}, config, context=ctx
        )
        assert paused["__interrupt__"][0].value["round"] == 1

        fresh = build_interview_graph(get_checkpointer())  # simulates a new server process
        final = fresh.invoke(
            Command(resume=resume_payload({"r1_q": {"optionId": "b"}})), config, context=ctx
        )
        assert final["status"] == "ready"
        assert final["rounds"][0]["answers"]["r1_q"]["optionId"] == "b"
    finally:
        saver.delete_thread(thread_id)
