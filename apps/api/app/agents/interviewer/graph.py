"""The interview graph: START → triage → interviewer ⇄ ask_founder → END.

triage ends the run early (status "needs_idea") when the message isn't an app idea yet.
"""

# LangGraph's builder API is only partly typed (e.g. `CachePolicy[Unknown]` in add_node's
# signature, no stub for `langgraph.graph`). Our own types stay strict; only these two library
# gaps are relaxed, and only in this file.
# pyright: reportMissingTypeStubs=false, reportUnknownMemberType=false

from langgraph.checkpoint.base import BaseCheckpointSaver
from langgraph.graph import START, StateGraph
from langgraph.graph.state import CompiledStateGraph

from app.agents.interviewer.nodes import (
    InterviewContext,
    InterviewState,
    ask_founder,
    interviewer,
    triage,
)

InterviewGraph = CompiledStateGraph[
    InterviewState, InterviewContext, InterviewState, InterviewState
]


def build_interview_graph(checkpointer: BaseCheckpointSaver[str]) -> InterviewGraph:
    """A checkpointer is required: `interrupt()` needs somewhere to save the paused state."""
    builder: StateGraph[InterviewState, InterviewContext, InterviewState, InterviewState] = (
        StateGraph(InterviewState, context_schema=InterviewContext)
    )
    builder.add_node("triage", triage)
    builder.add_node("interviewer", interviewer)
    builder.add_node("ask_founder", ask_founder)
    builder.add_edge(START, "triage")
    builder.add_edge("ask_founder", "interviewer")
    # interviewer routes itself with Command(goto=...): to ask_founder, or to END when ready.
    return builder.compile(checkpointer=checkpointer)
