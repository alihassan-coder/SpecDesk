"""Token usage and cost for one model call."""

from collections.abc import Mapping
from dataclasses import dataclass
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, Field

_MILLION = Decimal(1_000_000)


class ModelPrice(BaseModel):
    """USD per one million tokens. Cache prices default to Anthropic's usual ratios."""

    input: Decimal = Field(ge=0)
    output: Decimal = Field(ge=0)
    cache_read: Decimal | None = Field(default=None, ge=0)
    cache_write: Decimal | None = Field(default=None, ge=0)

    def cache_read_rate(self) -> Decimal:
        return self.cache_read if self.cache_read is not None else self.input / 10

    def cache_write_rate(self) -> Decimal:
        return self.cache_write if self.cache_write is not None else self.input * Decimal("1.25")


@dataclass(frozen=True, slots=True)
class Usage:
    """Tokens for one call. `input_tokens` excludes cached tokens."""

    input_tokens: int = 0
    output_tokens: int = 0
    cache_read_tokens: int = 0
    cache_write_tokens: int = 0

    @classmethod
    def from_langchain(cls, metadata: Mapping[str, Any] | None) -> "Usage":
        """Read LangChain's `AIMessage.usage_metadata`.

        LangChain reports `input_tokens` *including* cache reads/writes and puts the split in
        `input_token_details`; we store uncached input separately so cost maths stays simple.
        """
        if not metadata:
            return cls()
        details: Mapping[str, Any] = metadata.get("input_token_details") or {}
        cache_read = int(details.get("cache_read") or 0)
        cache_write = int(details.get("cache_creation") or 0)
        total_input = int(metadata.get("input_tokens") or 0)
        return cls(
            input_tokens=max(total_input - cache_read - cache_write, 0),
            output_tokens=int(metadata.get("output_tokens") or 0),
            cache_read_tokens=cache_read,
            cache_write_tokens=cache_write,
        )

    def cost_usd(self, price: ModelPrice) -> Decimal:
        total = (
            Decimal(self.input_tokens) * price.input
            + Decimal(self.output_tokens) * price.output
            + Decimal(self.cache_read_tokens) * price.cache_read_rate()
            + Decimal(self.cache_write_tokens) * price.cache_write_rate()
        )
        return (total / _MILLION).quantize(Decimal("0.000001"))
