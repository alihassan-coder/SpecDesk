"""Pricing engine — must match apps/web/src/lib/pricing.ts number for number."""

from app.services.pricing import FeatureInput, PricingEngine, duration_label, load_pricing_config

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
    # (S=8 + base 24) * 1.15 = 36.8 → 37h → $1,295 mid → 1,100 / 1,500; 37/45 → 1 week;
    # 37 / (6 h/day × 1.5) → 5 days.
    result = engine().estimate([FeatureInput(complexity="S")])
    assert result.hours == 37
    assert (result.price_min, result.price_max) == (1_100, 1_500)
    assert (result.weeks, result.days) == (1, 5)


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


def test_a_tiny_job_is_priced_in_days_not_weeks() -> None:
    # A Basic (tiny) job: 12h of features + 2h setup, 10% buffer → 15.4 → 15h at $35 = $525 mid
    # → 400 / 600; one developer at 6 h/day → 3 days.
    result = engine().estimate([FeatureInput("S", hours=12)], size="tiny")
    assert result.hours == 15
    assert (result.price_min, result.price_max) == (400, 600)
    assert result.days == 3
    assert duration_label(result.weeks, result.days) == "3 days"


def test_bigger_sizes_add_setup_buffer_and_team() -> None:
    features = [FeatureInput("L", hours=300)]
    small, large = (
        engine().estimate(features, size="small"),
        engine().estimate(features, size="large"),
    )
    assert large.hours > small.hours  # more setup and a bigger buffer
    # small: (300 + 12) * 1.15 = 359h, 1 dev → 12 weeks; large: (300 + 40) * 1.2 = 408h, 2 devs → 7
    assert (small.hours, small.weeks) == (359, 12)
    assert (large.hours, large.weeks) == (408, 7)
    assert duration_label(large.weeks, large.days) == "7 weeks"
