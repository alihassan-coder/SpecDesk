"""Pricing engine — must match apps/web/src/lib/pricing.ts number for number."""

from app.services.pricing import FeatureInput, PricingEngine, load_pricing_config

# Included + excluded features of the demo plan in apps/web/src/mocks/data.ts.
DEMO_FEATURES = [
    FeatureInput(complexity="S", hours=24, included=True),
    FeatureInput(complexity="L", hours=80, included=True),
    FeatureInput(complexity="M", hours=48, included=True),
    FeatureInput(complexity="L", hours=72, included=True),
    FeatureInput(complexity="M", hours=40, included=True),
    FeatureInput(complexity="M", hours=44, included=True),
    FeatureInput(complexity="S", hours=20, included=True),
    FeatureInput(complexity="M", hours=36, included=False),
    FeatureInput(complexity="L", hours=64, included=False),
    FeatureInput(complexity="XL", hours=220, included=False),
]


def engine() -> PricingEngine:
    return PricingEngine(load_pricing_config())


def test_demo_plan_matches_frontend_estimate() -> None:
    result = engine().estimate(DEMO_FEATURES)

    assert result.hours == 466
    assert result.price_min == 13_900
    assert result.price_max == 18_800
    assert result.weeks == 11


def test_feature_without_hours_uses_complexity_default() -> None:
    # (S=20 + base 60) * 1.2 = 96h → $3,360 mid → 2,900 / 3,900; 96/45 → 3 weeks, floor of 4.
    result = engine().estimate([FeatureInput(complexity="S")])
    assert result.hours == 96
    assert (result.price_min, result.price_max) == (2_900, 3_900)
    assert result.weeks == 4


def test_plan_rate_and_buffer_override_defaults() -> None:
    # (100 + 60) * 1.0 = 160h at $50 → 8,000 mid → 6,800 / 9,200; 160/45 → 4 weeks.
    result = engine().estimate([FeatureInput("M", hours=100)], hourly_rate=50, buffer=0)
    assert result.hours == 160
    assert (result.price_min, result.price_max) == (6_800, 9_200)
    assert result.weeks == 4


def test_halves_round_up_like_javascript() -> None:
    # (3 + 60) * 1.5 = 94.5h: JS Math.round gives 95, Python's banker's round() would give 94.
    result = engine().estimate([FeatureInput("S", hours=3)], buffer=0.5)
    assert result.hours == 95
