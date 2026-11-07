"""All planning agents against the configured model. Costs a little, so opt-in:

SPECDESK_LIVE_TESTS=1 uv run pytest tests/agents/test_live_planner.py -s
"""

import os
import time
from typing import Any, cast

import pytest
from langgraph.checkpoint.memory import InMemorySaver

from app.agents.llm.catalog import DEFAULT_CATALOG
from app.agents.llm.keys import provider_environ, resolve_api_key
from app.agents.llm.structured import CallRecord, ModelGateway
from app.agents.planner.graph import build_plan_graph
from app.agents.planner.nodes import PlanContext

pytestmark = pytest.mark.skipif(
    os.environ.get("SPECDESK_LIVE_TESTS") != "1",
    reason="live model test; set SPECDESK_LIVE_TESTS=1",
)

BRIEF = """- Booking and home-exercise app for independent physiotherapists
- Web for physios, mobile app for patients
- Physios pay a monthly subscription through Stripe
- Physios upload their own exercise videos
- Google and Apple calendar sync
- Email and push reminders
- GDPR (EU) compliance"""


def test_real_models_build_a_full_plan() -> None:
    environ = provider_environ()
    provider = DEFAULT_CATALOG.chain_for("analyst")[0].provider
    if resolve_api_key(provider, session=None, cipher=None, environ=environ) is None:
        pytest.skip(f"No API key for {provider} in apps/api/.env")
    calls: list[CallRecord] = []
    gateway = ModelGateway(
        DEFAULT_CATALOG,
        keys=lambda p: resolve_api_key(p, session=None, cipher=None, environ=environ),
        record=calls.append,
    )
    graph = build_plan_graph(InMemorySaver())
    config: Any = {"configurable": {"thread_id": "live-plan"}}
    started = time.monotonic()
    for event in graph.stream(  # pyright: ignore[reportUnknownMemberType]
        {"idea": "A booking and home-exercise app for physiotherapists", "brief": BRIEF},
        config,
        context=PlanContext(ask=gateway),
        stream_mode="custom",
    ):
        data = cast(dict[str, Any], event) if isinstance(event, dict) else {}
        if data.get("type") == "agent.note":
            print(f"  [{data['agent']}] {data['text']}")
    plan: dict[str, Any] = dict(graph.get_state(config).values["plan"])
    took = time.monotonic() - started

    print(f"\nTook {took:.0f}s, {len(calls)} calls, ${sum(c.cost_usd for c in calls)}")
    for c in calls:
        print(f"  {c.agent:10} {c.model_id:28} ok={c.ok} {c.duration_ms}ms {c.error or ''}")
    est = plan["estimate"]
    print(f"\n{plan['title']}: ${est['priceMin']}-{est['priceMax']}, {est['weeks']} weeks")
    print(
        f"{len(plan['features'])} features, {len(plan['screens'])} screens, "
        f"{len(plan['backlog'])} tickets, readiness {plan['readiness']}"
    )
    assert plan["features"] and plan["screens"] and plan["stack"] and plan["backlog"]
