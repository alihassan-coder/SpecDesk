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

    # (328 included + 24 base) * 1.15 = 404.8 → 405h; $14,175 mid → 12,000 / 16,300; 405/45 → 9.
    assert result.hours == 405
    assert result.price_min == 12_000
    assert result.price_max == 16_300
    assert result.weeks == 9


def test_feature_without_hours_uses_complexity_default() -> None:
    # (S=8 + base 24) * 1.15 = 36.8 → 37h → $1,295 mid → 1,100 / 1,500; 37/45 → 1 week, floor 2.
    result = engine().estimate([FeatureInput(complexity="S")])
    assert result.hours == 37
    assert (result.price_min, result.price_max) == (1_100, 1_500)
    assert result.weeks == 2


def test_plan_rate_and_buffer_override_defaults() -> None:
    # (100 + 24) * 1.0 = 124h at $50 → 6,200 mid → 5,300 / 7,100; 124/45 → 3 weeks.
    result = engine().estimate([FeatureInput("M", hours=100)], hourly_rate=50, buffer=0)
    assert result.hours == 124
    assert (result.price_min, result.price_max) == (5_300, 7_100)
    assert result.weeks == 3


def test_halves_round_up_like_javascript() -> None:
    # (3 + 24) * 1.5 = 40.5h: JS Math.round gives 41, Python's banker's round() would give 40.
    result = engine().estimate([FeatureInput("S", hours=3)], buffer=0.5)
    assert result.hours == 41
