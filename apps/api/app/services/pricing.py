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
Size = Literal["tiny", "small", "medium", "large"]
SIZES: tuple[Size, ...] = ("tiny", "small", "medium", "large")


def as_size(value: object) -> Size | None:
    """A known project size, or None."""
    for size in SIZES:
        if value == size:
            return size
    return None


DEFAULT_CONFIG_PATH = Path(__file__).resolve().parents[2] / "pricing.yaml"


class SizeConfig(BaseModel):
    label: str
    base_hours: float
    buffer: float
    team_size: PositiveFloat
    must_hours: tuple[int, int]


class PricingConfig(BaseModel):
    currency: str
    hourly_rate: PositiveFloat
    buffer: float
    spread: float
    price_round_to: PositiveInt
    base_hours: float
    hours_per_week: PositiveFloat
    hours_per_day: PositiveFloat
    team_size: PositiveFloat
    min_weeks: int
    complexity_hours: dict[Complexity, int]
    sizes: dict[Size, SizeConfig]


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
    days: int  # working days, for jobs too short to count in weeks


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
        size: Size | None = None,
    ) -> Estimate:
        """Hours, price range and duration. `size` picks the base hours, buffer and team; an
        explicit `buffer` (a plan's own) still wins."""
        c = self.config
        tier = c.sizes.get(size) if size else None
        rate = c.hourly_rate if hourly_rate is None else hourly_rate
        buf = buffer if buffer is not None else (tier.buffer if tier else c.buffer)
        base = tier.base_hours if tier else c.base_hours
        team = tier.team_size if tier else c.team_size

        feature_hours = sum(self.feature_hours(f) for f in features if f.included)
        hours = _round_half_up((feature_hours + base) * (1 + buf))
        mid = hours * rate
        return Estimate(
            hours=hours,
            price_min=_round_to(mid * (1 - c.spread), c.price_round_to),
            price_max=_round_to(mid * (1 + c.spread), c.price_round_to),
            weeks=max(c.min_weeks, math.ceil(hours / (c.hours_per_week * team))),
            days=max(1, math.ceil(hours / (c.hours_per_day * team))),
        )


def duration_label(weeks: int, days: int) -> str:
    """ "4 days" for short jobs (a week or less of work), otherwise "6 weeks"."""
    if days <= 5:
        return f"{days} day" if days == 1 else f"{days} days"
    return f"{weeks} week" if weeks == 1 else f"{weeks} weeks"
