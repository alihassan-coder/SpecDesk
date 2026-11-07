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


PRIMARY, FALLBACK = "groq:openai/gpt-oss-120b", "groq:openai/gpt-oss-20b"


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
    available = {"groq": "gsk-test"} if keys is None else keys
    gw = ModelGateway(
        DEFAULT_CATALOG,
        keys=lambda p: SecretStr(available[p]) if p in available else None,
        runner=runner_that(behaviour),
        record=records.append,
    )
    return gw, records


def test_first_model_answers() -> None:
    gw, records = gateway({PRIMARY: Answer(text="hi"), FALLBACK: Answer(text="unused")})
    assert gw("interviewer", Answer, system="s", user="u") == Answer(text="hi")
    assert [(r.model_id, r.ok) for r in records] == [(PRIMARY, True)]
    # 1000 in × $0.15 + 100 out × $0.60 per million
    assert records[0].cost_usd == Decimal("0.000210")


def test_falls_back_when_the_first_model_errors_or_returns_garbage() -> None:
    gw, records = gateway({PRIMARY: TimeoutError("slow"), FALLBACK: Answer(text="from fallback")})
    assert gw("interviewer", Answer, system="s", user="u").text == "from fallback"
    assert [(r.model_id, r.ok, r.error) for r in records] == [
        (PRIMARY, False, "TimeoutError"),
        (FALLBACK, True, None),
    ]

    gw, records = gateway({PRIMARY: None, FALLBACK: Answer(text="ok")})
    assert gw("interviewer", Answer, system="s", user="u").text == "ok"
    assert records[0].error == "unparseable"


def test_every_model_failing_is_a_humanized_error() -> None:
    gw, _ = gateway({PRIMARY: RuntimeError("x"), FALLBACK: RuntimeError("y")})
    with pytest.raises(AppError) as err:
        gw("interviewer", Answer, system="s", user="u")
    assert err.value.error.code == "model_unavailable"


def test_missing_keys_tell_the_admin_what_to_do() -> None:
    gw, records = gateway({PRIMARY: Answer(text="never")}, keys={})
    with pytest.raises(AppError) as err:
        gw("interviewer", Answer, system="s", user="u")
    assert err.value.error.code == "model_not_configured"
    assert "groq" in err.value.error.message
    assert records == []  # no call was attempted


class RateLimitError(Exception):
    """Same class name the provider SDKs use for HTTP 429."""


def test_rate_limits_wait_and_retry_the_chain_instead_of_failing() -> None:
    calls = {"n": 0}

    def flaky(entry: ModelEntry, key: SecretStr, effort: Effort, schema: type[BaseModel]):
        def run(_: list[BaseMessage]) -> tuple[object, object]:
            calls["n"] += 1
            if calls["n"] <= 3:  # all three models limited on the first pass
                raise RateLimitError("429")
            return AIMessage(content=""), Answer(text="after waiting")

        return RunnableLambda(run)

    waits: list[float] = []
    gw = ModelGateway(
        DEFAULT_CATALOG,
        keys=lambda _p: SecretStr("gsk-test"),
        runner=flaky,
        sleep=waits.append,
        rate_limit_waits=(1.0, 2.0),
    )
    assert gw("interviewer", Answer, system="s", user="u") == Answer(text="after waiting")
    assert waits == [1.0]


def test_real_errors_do_not_wait() -> None:
    waits: list[float] = []
    gw = ModelGateway(
        DEFAULT_CATALOG,
        keys=lambda _p: SecretStr("gsk-test"),
        runner=runner_that({PRIMARY: TimeoutError("x"), FALLBACK: TimeoutError("x")}),
        sleep=waits.append,
    )
    with pytest.raises(AppError):
        gw("interviewer", Answer, system="s", user="u")
    assert waits == []
