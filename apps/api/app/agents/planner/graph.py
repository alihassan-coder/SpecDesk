"""The planning graph.

    START → analyst ─┬→ product ─┬→ ux ────────┐
                     │           ├→ estimator ─┼→ critic → assemble → END
                     │           └→ backlog ───┤
                     └→ architect ─────────────┘

Nodes on the same level run in parallel. `critic` waits for all four branches.
A checkpointer lets a failed run continue from the last finished step instead of starting over.
"""

# Same LangGraph typing gaps as interviewer/graph.py; relaxed only in this file.
# pyright: reportMissingTypeStubs=false, reportUnknownMemberType=false

from langgraph.checkpoint.base import BaseCheckpointSaver
from langgraph.graph import END, START, StateGraph
from langgraph.graph.state import CompiledStateGraph

from app.agents.planner import nodes
from app.agents.planner.nodes import PlanContext, PlanState

PlanGraph = CompiledStateGraph[PlanState, PlanContext, PlanState, PlanState]

PLANNER_AGENTS = ["analyst", "product", "architect", "ux", "estimator", "backlog", "critic"]


def build_plan_graph(checkpointer: BaseCheckpointSaver[str] | None = None) -> PlanGraph:
    builder: StateGraph[PlanState, PlanContext, PlanState, PlanState] = StateGraph(
        PlanState, context_schema=PlanContext
    )
    for name in PLANNER_AGENTS:
        builder.add_node(name, getattr(nodes, name))
    builder.add_node("assemble", nodes.assemble)

    builder.add_edge(START, "analyst")
    builder.add_edge("analyst", "product")
    builder.add_edge("analyst", "architect")
    for name in ("ux", "estimator", "backlog"):
        builder.add_edge("product", name)
    builder.add_edge(["architect", "ux", "estimator", "backlog"], "critic")
    builder.add_edge("critic", "assemble")
    builder.add_edge("assemble", END)
    return builder.compile(checkpointer=checkpointer)


def plan_thread_id(chat_id: str) -> str:
    """Separate from the interview's thread (which uses the bare chat id)."""
    return f"plan:{chat_id}"
