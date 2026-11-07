"""Rule-based estimate: AI gives complexity/hours, this turns them into money and time.

Mirrors apps/web/src/lib/pricing.ts exactly (including JS `Math.round` half-up rounding).
"""

import math
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Literal

import yaml
from pydantic import BaseModel, PositiveFloat, PositiveInt

Complexity = Literal["S", "M", "L", "XL"]

DEFAULT_CONFIG_PATH = Path(__file__).resolve().parents[2] / "pricing.yaml"


class PricingConfig(BaseModel):
    currency: str
    hourly_rate: PositiveFloat
    buffer: float
    spread: float
    price_round_to: PositiveInt
    base_hours: float
    hours_per_week: PositiveFloat
    team_size: PositiveFloat
    min_weeks: int
    complexity_hours: dict[Complexity, int]


@dataclass(frozen=True)
class FeatureInput:
    complexity: Complexity
    hours: int | None = None  # None → default hours for the complexity
    included: bool = True


@dataclass(frozen=True)
class Estimate:
    hours: int
    price_min: int
    price_max: int
    weeks: int


def _round_half_up(n: float) -> int:
    return math.floor(n + 0.5)


def _round_to(n: float, step: int) -> int:
    return _round_half_up(n / step) * step


@lru_cache
def load_pricing_config(path: Path = DEFAULT_CONFIG_PATH) -> PricingConfig:
    with path.open(encoding="utf-8") as f:
        return PricingConfig.model_validate(yaml.safe_load(f))


class PricingEngine:
    def __init__(self, config: PricingConfig) -> None:
        self.config = config

    def feature_hours(self, feature: FeatureInput) -> int:
        if feature.hours is not None:
            return feature.hours
        return self.config.complexity_hours[feature.complexity]

    def estimate(
        self,
        features: list[FeatureInput],
        *,
        hourly_rate: float | None = None,
        buffer: float | None = None,
    ) -> Estimate:
        c = self.config
        rate = c.hourly_rate if hourly_rate is None else hourly_rate
        buf = c.buffer if buffer is None else buffer

        feature_hours = sum(self.feature_hours(f) for f in features if f.included)
        hours = _round_half_up((feature_hours + c.base_hours) * (1 + buf))
        mid = hours * rate
        return Estimate(
            hours=hours,
            price_min=_round_to(mid * (1 - c.spread), c.price_round_to),
            price_max=_round_to(mid * (1 + c.spread), c.price_round_to),
            weeks=max(c.min_weeks, math.ceil(hours / (c.hours_per_week * c.team_size))),
        )
