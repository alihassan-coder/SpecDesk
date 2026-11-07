"""The planning pipeline with a fake model: order, assembly, pricing, retry, files."""

import csv
import io
import json
import zipfile
from typing import Any

import pytest
from langchain_core.runnables import RunnableConfig
from langgraph.checkpoint.memory import InMemorySaver

from app.agents.planner.assemble import assemble_plan
from app.agents.planner.graph import PLANNER_AGENTS, build_plan_graph
from app.agents.planner.nodes import PlanContext, PlanState
from app.services.plan_files import backlog_csv, build_files, find_file, flow_mermaid
from app.services.pricing import FeatureInput, PricingEngine, load_pricing_config

from .planner_fakes import FakePlanner

START: PlanState = {"idea": "A physio booking app", "brief": "- Web and mobile"}
CONFIG: RunnableConfig = {"configurable": {"thread_id": "plan:test"}}


def _run(
    model: FakePlanner, saver: InMemorySaver | None = None
) -> tuple[dict[str, Any], list[Any]]:
    graph = build_plan_graph(saver or InMemorySaver())
    events: list[Any] = list(
        graph.stream(START, CONFIG, context=PlanContext(ask=model), stream_mode="custom")  # pyright: ignore[reportUnknownMemberType]
    )
    return dict(graph.get_state(CONFIG).values), events


def test_every_agent_runs_once_and_critic_comes_after_all_branches() -> None:
    model = FakePlanner()
    values, events = _run(model)
    assert sorted(model.agents) == sorted(PLANNER_AGENTS)
    assert model.agents[0] == "analyst"
    assert model.agents[-1] == "critic"
    done = [e["agent"] for e in events if e.get("type") == "agent.status" and e["status"] == "done"]
    assert sorted(done) == sorted(PLANNER_AGENTS)
    assert "plan" in values


def test_assembled_plan_matches_the_web_shape_and_is_priced_in_code() -> None:
    values, _ = _run(FakePlanner())
    plan = values["plan"]
    engine = PricingEngine(load_pricing_config())

    features = {f["id"]: f for f in plan["features"]}
    assert features["booking"]["hours"] == 50  # from the estimator
    assert features["exercises"]["hours"] == engine.config.complexity_hours["L"]  # default
    # Only must features are in the price; should ones are add-ons the founder can switch on.
    assert [f["included"] for f in plan["features"]] == [True, False, False]  # must, should, wont

    expected = engine.estimate(
        [FeatureInput(f["complexity"], f["hours"], f["included"]) for f in plan["features"]]
    )
    assert plan["estimate"]["priceMin"] == expected.price_min
    assert plan["estimate"]["weeks"] == expected.weeks
    assert sum(p["weeks"] for p in plan["phases"]) == expected.weeks  # phases rescaled to fit

    assert plan["screens"][1]["wireframe"][0]["span"] == 4  # clamped
    assert plan["competitors"][0]["url"].startswith("https://www.google.com/search?q=")
    for key in ("title", "oneLiner", "problem", "audience", "readiness", "stack", "risks"):
        assert key in plan


def test_a_failed_agent_is_retried_without_redoing_finished_ones() -> None:
    saver = InMemorySaver()
    failing = FakePlanner(fail_agent="critic")
    with pytest.raises(TimeoutError):
        _run(failing, saver)

    retry = FakePlanner()
    graph = build_plan_graph(saver)
    assert graph.get_state(CONFIG).next  # stopped part-way
    list(graph.stream(None, CONFIG, context=PlanContext(ask=retry), stream_mode="custom"))  # pyright: ignore[reportUnknownMemberType]
    assert retry.agents == ["critic"]
    assert "plan" in graph.get_state(CONFIG).values


def test_assemble_tolerates_missing_parts() -> None:
    plan = assemble_plan({"idea": "x", "brief": "y"})
    assert plan["title"] == "Your app"
    assert plan["features"] == []
    assert plan["estimate"]["weeks"] >= 1


# ---------- files ----------


def _plan() -> dict[str, Any]:
    values, _ = _run(FakePlanner())
    return values["plan"]


def test_files_are_generated_and_deterministic() -> None:
    plan = _plan()
    first, second = build_files(plan), build_files(plan)
    assert [f.name for f in first] == [
        "spec.md",
        "backlog.csv",
        "backlog.json",
        "flow.mmd",
        "build-prompt.md",
        "specdesk-physioflow.zip",
    ]
    assert [f.content for f in first] == [f.content for f in second]

    spec = first[0].content.decode()
    assert "# PhysioFlow" in spec and "Online booking" in spec and "Health data rules" in spec

    with zipfile.ZipFile(io.BytesIO(first[-1].content)) as z:
        assert sorted(z.namelist()) == sorted(f"specdesk-physioflow/{f.name}" for f in first[:-1])


def test_backlog_csv_has_one_row_per_ticket_with_feature_names() -> None:
    rows = list(csv.reader(io.StringIO(backlog_csv(_plan()))))
    assert rows[0][0] == "ID"
    assert rows[1][:3] == ["T1", "Book a session", "Online booking"]
    assert rows[2][5] == "T1"


def test_flow_is_valid_looking_mermaid_and_json_parses() -> None:
    plan = _plan()
    flow = flow_mermaid(plan)
    assert flow.startswith("flowchart LR")
    assert 'home["Home"] -->|"Book a session"| book["Book"]' in flow
    backlog = find_file(plan, "backlog.json")
    assert backlog is not None
    assert len(json.loads(backlog.content)["tickets"]) == 2
    assert find_file(plan, "nope.txt") is None
