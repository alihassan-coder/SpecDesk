"""The planning agents. Each node asks one model for one part of the plan.

Order (see graph.py): analyst → product ∥ architect → ux ∥ estimator ∥ backlog → critic → assemble.
Every node only writes its own state key, so nodes running in parallel never collide.
"""

import json
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any, Required, TypedDict

from langgraph.config import get_stream_writer
from langgraph.runtime import Runtime
from pydantic import BaseModel

from app.agents.llm.ask import AskModel
from app.agents.planner.assemble import HOUR_BUDGETS, assemble_plan
from app.agents.planner.schemas import (
    Analysis,
    Backlog,
    Critique,
    EstimatePlan,
    ProductSpec,
    StackPlan,
    UxPlan,
)
from app.agents.prompts import load_prompt

Json = dict[str, Any]


class PlanState(TypedDict, total=False):
    idea: Required[str]
    brief: Required[str]
    analysis: Json
    product: Json
    stack: Json
    ux: Json
    estimate: Json
    backlog: Json
    critique: Json
    plan: Json  # the assembled plan, camelCase, matches the web `Plan` type


@dataclass(frozen=True, slots=True)
class PlanContext:
    ask: AskModel


def _section(name: str, value: object) -> str:
    body = value if isinstance(value, str) else json.dumps(value, ensure_ascii=False, indent=1)
    return f"<{name}>\n{body}\n</{name}>"


def _run[T: BaseModel](
    agent: str,
    schema: type[T],
    state: PlanState,
    runtime: Runtime[PlanContext],
    *,
    uses: list[str],
    task: str,
    note: Callable[[T], str],
) -> T:
    """Shared steps: tell the UI it started, ask the model, tell the UI what it found."""
    emit = get_stream_writer()
    emit({"type": "agent.status", "agent": agent, "status": "working"})
    parts = [_section("idea", state["idea"]), _section("brief", state["brief"])]
    parts += [_section(key, state.get(key)) for key in uses if state.get(key) is not None]
    parts.append(task)
    result = runtime.context.ask(
        agent,
        schema,
        system=load_prompt(agent),
        user="\n\n".join(parts),
    )
    emit({"type": "agent.note", "agent": agent, "text": note(result)})
    emit({"type": "agent.status", "agent": agent, "status": "done"})
    return result


def analyst(state: PlanState, runtime: Runtime[PlanContext]) -> Json:
    out = _run(
        "analyst",
        Analysis,
        state,
        runtime,
        uses=[],
        task="Write the analysis for this product.",
        note=lambda a: a.one_liner,
    )
    return {"analysis": out.model_dump()}


def _budget(state: PlanState) -> str:
    size = str((state.get("analysis") or {}).get("size") or "medium")
    low, high = HOUR_BUDGETS.get(size, HOUR_BUDGETS["medium"])
    return f"Project size: {size}. Budget for the must features: {low}-{high} hours in total."


def product(state: PlanState, runtime: Runtime[PlanContext]) -> Json:
    def note(p: ProductSpec) -> str:
        mvp = sum(1 for f in p.features if f.moscow in ("must", "should"))
        return f"{len(p.features)} features, {mvp} in the first version."

    out = _run(
        "product",
        ProductSpec,
        state,
        runtime,
        uses=["analysis"],
        task=f"Write the product spec. {_budget(state)}",
        note=note,
    )
    return {"product": out.model_dump()}


def architect(state: PlanState, runtime: Runtime[PlanContext]) -> Json:
    out = _run(
        "architect",
        StackPlan,
        state,
        runtime,
        uses=["analysis"],
        task="Choose the technology stack.",
        note=lambda s: ", ".join(c.choice for c in s.stack[:4]),
    )
    return {"stack": out.model_dump()}


def _features_only(state: PlanState) -> Json:
    """Later agents need the feature list, not the whole spec."""
    features = (state.get("product") or {}).get("features", [])
    return {
        "features": [
            {k: f[k] for k in ("id", "name", "description", "moscow", "complexity")}
            for f in features
        ]
    }


def ux(state: PlanState, runtime: Runtime[PlanContext]) -> Json:
    scoped: PlanState = {**state, "product": _features_only(state)}
    out = _run(
        "ux",
        UxPlan,
        scoped,
        runtime,
        uses=["analysis", "product"],
        task="Design the main screens and the user flow.",
        note=lambda u: f"{len(u.screens)} screens: " + ", ".join(s.name for s in u.screens[:5]),
    )
    return {"ux": out.model_dump()}


def estimator(state: PlanState, runtime: Runtime[PlanContext]) -> Json:
    scoped: PlanState = {**state, "product": _features_only(state)}
    out = _run(
        "estimator",
        EstimatePlan,
        scoped,
        runtime,
        uses=["analysis", "product"],
        task=f"Estimate hours for every feature id, then the phases and the team. {_budget(state)}",
        note=lambda e: f"About {sum(f.hours for f in e.features)} hours of feature work.",
    )
    return {"estimate": out.model_dump()}


def backlog(state: PlanState, runtime: Runtime[PlanContext]) -> Json:
    scoped: PlanState = {**state, "product": _features_only(state)}
    out = _run(
        "backlog",
        Backlog,
        scoped,
        runtime,
        uses=["product"],
        task="Write the backlog tickets.",
        note=lambda b: f"{len(b.tickets)} tickets in build order.",
    )
    return {"backlog": out.model_dump()}


def critic(state: PlanState, runtime: Runtime[PlanContext]) -> Json:
    scoped: PlanState = {**state, "product": _features_only(state)}
    out = _run(
        "critic",
        Critique,
        scoped,
        runtime,
        uses=["analysis", "product", "stack", "estimate"],
        task="Review the plan: readiness, risks and competitors.",
        note=lambda c: (
            f"Readiness {c.readiness}/100. Biggest risk: "
            + (c.risks[0].title if c.risks else "none found")
        ),
    )
    return {"critique": out.model_dump()}


def assemble(state: PlanState) -> Json:
    """Plain code: merge every part and compute price and weeks with the pricing engine."""
    return {"plan": assemble_plan(state)}
