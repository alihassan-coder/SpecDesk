"""`ModelGateway`: the real `AskModel`.

For one agent it walks the catalog's chain (chosen model, then fallbacks): find the key, build
the LangChain chat model, ask for a structured result, record tokens and cost, and return the
first valid answer. Founders only ever see a humanized error if every model fails.
"""

import logging
import time
from collections.abc import Callable
from dataclasses import dataclass
from decimal import Decimal
from typing import TypeVar

from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage
from langchain_core.runnables import Runnable
from pydantic import BaseModel, SecretStr

from app.agents.llm.catalog import Effort, ModelCatalog, ModelEntry
from app.agents.llm.chat_models import build_chat_model, structured
from app.agents.llm.usage import Usage
from app.core.errors import AppError

logger = logging.getLogger("specdesk.agents.llm")

T = TypeVar("T", bound=BaseModel)

KeyLookup = Callable[[str], SecretStr | None]
# Builds the runnable that asks one model for one schema and returns (raw_message, parsed_or_None).
RunnerFactory = Callable[
    [ModelEntry, SecretStr, Effort, type[BaseModel]],
    Runnable[list[BaseMessage], tuple[object, object]],
]


def langchain_runner(
    entry: ModelEntry, key: SecretStr, effort: Effort, schema: type[BaseModel]
) -> Runnable[list[BaseMessage], tuple[object, object]]:
    return structured(build_chat_model(entry, key, effort), schema)


@dataclass(frozen=True, slots=True)
class CallRecord:
    """One model call, for the `agent_run` table and the admin's cost view."""

    agent: str
    model_id: str
    ok: bool
    usage: Usage
    cost_usd: Decimal
    duration_ms: int
    error: str | None = None


RecordCall = Callable[[CallRecord], None]


def _ignore(_: CallRecord) -> None:
    return None


class ModelGateway:
    def __init__(
        self,
        catalog: ModelCatalog,
        *,
        keys: KeyLookup,
        runner: RunnerFactory = langchain_runner,
        record: RecordCall = _ignore,
    ) -> None:
        self._catalog = catalog
        self._keys = keys
        self._runner = runner
        self._record = record

    def __call__(self, agent: str, schema: type[T], *, system: str, user: str) -> T:
        messages: list[BaseMessage] = [SystemMessage(content=system), HumanMessage(content=user)]
        missing_keys: list[str] = []
        tried = 0

        for entry in self._catalog.chain_for(agent):
            key = self._keys(entry.provider)
            if key is None:
                missing_keys.append(entry.provider)
                continue
            tried += 1
            result = self._try(agent, entry, key, schema, messages)
            if result is not None:
                return result

        if tried == 0:
            providers = ", ".join(sorted(set(missing_keys)))
            raise AppError(
                "model_not_configured",
                status_code=503,
                title="No AI provider is set up yet",
                message=f"There's no API key for {providers}.",
                action="Add a key in Admin → API keys, or set it in apps/api/.env.",
            )
        raise AppError("model_unavailable", status_code=503)

    def _try(
        self,
        agent: str,
        entry: ModelEntry,
        key: SecretStr,
        schema: type[T],
        messages: list[BaseMessage],
    ) -> T | None:
        started = time.perf_counter()
        try:
            runnable = self._runner(entry, key, self._catalog.effort_for(agent), schema)
            raw, parsed = runnable.invoke(messages)
        except Exception as exc:  # each provider package raises its own types; record and fall back
            logger.warning("Model %s failed for %s: %s", entry.id, agent, exc.__class__.__name__)
            self._record(
                CallRecord(
                    agent,
                    entry.id,
                    False,
                    Usage(),
                    Decimal(0),
                    _ms(started),
                    exc.__class__.__name__,
                )
            )
            return None

        usage = Usage.from_langchain(getattr(raw, "usage_metadata", None))
        ok = isinstance(parsed, schema)
        self._record(
            CallRecord(
                agent,
                entry.id,
                ok,
                usage,
                usage.cost_usd(entry.price),
                _ms(started),
                None if ok else "unparseable",
            )
        )
        return parsed if isinstance(parsed, schema) else None


def _ms(started: float) -> int:
    return int((time.perf_counter() - started) * 1000)
