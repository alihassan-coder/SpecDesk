"""ModelGateway: fallback order, missing keys, cost records — with fake runners, no network."""

from decimal import Decimal

import pytest
from langchain_core.messages import AIMessage, BaseMessage
from langchain_core.runnables import Runnable, RunnableLambda
from pydantic import BaseModel, SecretStr

from app.agents.llm.catalog import DEFAULT_CATALOG, Effort, ModelEntry
from app.agents.llm.structured import CallRecord, ModelGateway
from app.core.errors import AppError


class Answer(BaseModel):
    text: str


OPUS, SONNET = "anthropic:claude-opus-5-5", "anthropic:claude-sonnet-5-5"


def runner_that(behaviour: dict[str, object]):
    """Per model id: an exception to raise, or a parsed value to return (None = unparseable)."""

    def factory(
        entry: ModelEntry, key: SecretStr, effort: Effort, schema: type[BaseModel]
    ) -> Runnable[list[BaseMessage], tuple[object, object]]:
        outcome = behaviour[entry.id]

        def run(_: list[BaseMessage]) -> tuple[object, object]:
            if isinstance(outcome, Exception):
                raise outcome
            raw = AIMessage(
                content="",
                usage_metadata={"input_tokens": 1000, "output_tokens": 100, "total_tokens": 1100},
            )
            return raw, outcome

        return RunnableLambda(run)

    return factory


def gateway(
    behaviour: dict[str, object], *, keys: dict[str, str] | None = None
) -> tuple[ModelGateway, list[CallRecord]]:
    records: list[CallRecord] = []
    available = {"anthropic": "sk-test"} if keys is None else keys
    gw = ModelGateway(
        DEFAULT_CATALOG,
        keys=lambda p: SecretStr(available[p]) if p in available else None,
        runner=runner_that(behaviour),
        record=records.append,
    )
    return gw, records


def test_first_model_answers() -> None:
    gw, records = gateway({OPUS: Answer(text="hi"), SONNET: Answer(text="unused")})
    assert gw("interviewer", Answer, system="s", user="u") == Answer(text="hi")
    assert [(r.model_id, r.ok) for r in records] == [(OPUS, True)]
    # 1000 in × $4 + 100 out × $20 per million
    assert records[0].cost_usd == Decimal("0.006000")


def test_falls_back_when_the_first_model_errors_or_returns_garbage() -> None:
    gw, records = gateway({OPUS: TimeoutError("slow"), SONNET: Answer(text="from sonnet")})
    assert gw("interviewer", Answer, system="s", user="u").text == "from sonnet"
    assert [(r.model_id, r.ok, r.error) for r in records] == [
        (OPUS, False, "TimeoutError"),
        (SONNET, True, None),
    ]

    gw, records = gateway({OPUS: None, SONNET: Answer(text="ok")})
    assert gw("interviewer", Answer, system="s", user="u").text == "ok"
    assert records[0].error == "unparseable"


def test_every_model_failing_is_a_humanized_error() -> None:
    gw, _ = gateway({OPUS: RuntimeError("x"), SONNET: RuntimeError("y")})
    with pytest.raises(AppError) as err:
        gw("interviewer", Answer, system="s", user="u")
    assert err.value.error.code == "model_unavailable"


def test_missing_keys_tell_the_admin_what_to_do() -> None:
    gw, records = gateway({OPUS: Answer(text="never")}, keys={})
    with pytest.raises(AppError) as err:
        gw("interviewer", Answer, system="s", user="u")
    assert err.value.error.code == "model_not_configured"
    assert "anthropic" in err.value.error.message
    assert records == []  # no call was attempted
