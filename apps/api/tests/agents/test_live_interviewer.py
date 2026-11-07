"""One real round against the configured model. Costs a few cents, so it only runs on request:

SPECDESK_LIVE_TESTS=1 uv run pytest tests/agents/test_live_interviewer.py -s
"""

import os
from typing import Any

import pytest
from langgraph.checkpoint.memory import InMemorySaver

from app.agents.interviewer.graph import build_interview_graph
from app.agents.interviewer.nodes import InterviewContext
from app.agents.llm.catalog import DEFAULT_CATALOG
from app.agents.llm.keys import provider_environ, resolve_api_key
from app.agents.llm.structured import CallRecord, ModelGateway

pytestmark = pytest.mark.skipif(
    os.environ.get("SPECDESK_LIVE_TESTS") != "1",
    reason="live model test; set SPECDESK_LIVE_TESTS=1",
)


def test_real_model_asks_a_valid_first_round() -> None:
    environ = provider_environ()
    provider = DEFAULT_CATALOG.chain_for("interviewer")[0].provider
    if resolve_api_key(provider, session=None, cipher=None, environ=environ) is None:
        pytest.skip(f"No API key for {provider} in apps/api/.env")
    calls: list[CallRecord] = []
    gateway = ModelGateway(
        DEFAULT_CATALOG,
        keys=lambda p: resolve_api_key(p, session=None, cipher=None, environ=environ),
        record=calls.append,
    )
    graph = build_interview_graph(InMemorySaver())
    result: dict[str, Any] = graph.invoke(  # pyright: ignore[reportUnknownMemberType]
        {"idea": "A booking and home-exercise app for independent physiotherapists"},
        {"configurable": {"thread_id": "live-1"}},
        context=InterviewContext(ask=gateway),
    )

    round_one = result["__interrupt__"][0].value
    print(
        "\nModel:",
        calls[-1].model_id,
        "| tokens:",
        calls[-1].usage,
        "| cost: $",
        calls[-1].cost_usd,
    )
    for q in round_one["questions"]:
        print("-", q["title"], "→ recommended:", q["recommended"])
        assert q["recommended"] in {o["id"] for o in q["options"]}
        assert 2 <= len(q["options"]) <= 5
    assert 1 <= len(round_one["questions"]) <= 5
    assert calls[-1].ok and calls[-1].cost_usd > 0
