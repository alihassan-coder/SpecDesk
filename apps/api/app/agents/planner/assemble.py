"""Merge the agents' parts into one plan. Plain code: price and weeks come from the pricing engine.

Output is camelCase JSON matching the web `Plan` type (apps/web/src/mocks/types.ts), plus a few
extra keys the file generators use (`spec`, `flow`, `backlog`, `goals`, `constraints`, `estimate`).
"""

from collections.abc import Mapping
from typing import Any
from urllib.parse import quote_plus

from app.services.pricing import FeatureInput, PricingEngine, load_pricing_config

Json = dict[str, Any]

# Only `must` features are in the quoted price; `should` ones are offered as add-ons (toggle on).
IN_FIRST_VERSION = {"must"}

# Total hours for the must features, by project size — freelance-market ranges (DECISIONS.md).
HOUR_BUDGETS: dict[str, tuple[int, int]] = {
    "small": (40, 150),
    "medium": (150, 400),
    "large": (400, 900),
}
# The estimator's must hours may exceed the budget by this much before they're scaled down.
BUDGET_SLACK = 1.2


def assemble_plan(state: Mapping[str, Any], engine: PricingEngine | None = None) -> Json:
    engine = engine or PricingEngine(load_pricing_config())
    analysis: Json = state.get("analysis") or {}
    product: Json = state.get("product") or {}
    stack: Json = state.get("stack") or {}
    ux: Json = state.get("ux") or {}
    estimate: Json = state.get("estimate") or {}
    backlog: Json = state.get("backlog") or {}
    critique: Json = state.get("critique") or {}

    features = _features(product.get("features", []), estimate.get("features", []), engine)
    size = str(analysis.get("size") or "medium")
    trimmed = _fit_budget(features, HOUR_BUDGETS.get(size, HOUR_BUDGETS["medium"])[1])
    totals = engine.estimate(
        [FeatureInput(f["complexity"], f["hours"], f["included"]) for f in features]
    )
    config = engine.config

    return {
        "id": "",  # filled in when the plan is read
        "title": analysis.get("title") or "Your app",
        "oneLiner": analysis.get("one_liner", ""),
        "problem": analysis.get("problem", ""),
        "audience": analysis.get("audience", []),
        "goals": analysis.get("goals", []),
        "constraints": analysis.get("constraints", []),
        "size": size,
        "assumptions": [
            *analysis.get("assumptions", []),
            *(
                [
                    f"Hours were trimmed to the usual range for a {size} project; "
                    "we'll confirm the exact scope on a call."
                ]
                if trimmed
                else []
            ),
        ],
        "readiness": int(critique.get("readiness", 50)),
        "readinessNotes": critique.get("readiness_notes", []),
        "features": features,
        "screens": [_screen(s) for s in ux.get("screens", [])],
        "flow": [
            {"from": f["from_screen"], "to": f["to_screen"], "action": f["action"]}
            for f in ux.get("flow", [])
        ],
        "stack": stack.get("stack", []),
        "phases": fit_phases(estimate.get("phases", []), totals.weeks),
        "team": estimate.get("team", []),
        "hourlyRate": config.hourly_rate,
        "buffer": config.buffer,
        "risks": critique.get("risks", []),
        "competitors": [
            {
                "name": c["name"],
                "note": c["note"],
                # A search link never breaks; a guessed homepage might.
                "url": f"https://www.google.com/search?q={quote_plus(c['name'])}",
            }
            for c in critique.get("competitors", [])
        ],
        "spec": {
            "implementationDecisions": product.get("implementation_decisions", []),
            "testingDecisions": product.get("testing_decisions", []),
            "outOfScope": product.get("out_of_scope", []),
        },
        "backlog": [
            {
                "id": t["id"],
                "title": t["title"],
                "featureId": t["feature_id"],
                "description": t["description"],
                "acceptance": t["acceptance"],
                "blockedBy": t["blocked_by"],
            }
            for t in backlog.get("tickets", [])
        ],
        "estimate": {
            "hours": totals.hours,
            "priceMin": totals.price_min,
            "priceMax": totals.price_max,
            "weeks": totals.weeks,
            "currency": config.currency,
        },
        "versions": [],
        "files": [],
    }


def _features(drafts: list[Json], hours: list[Json], engine: PricingEngine) -> list[Json]:
    hours_by_id = {h["id"]: int(h["hours"]) for h in hours}
    out: list[Json] = []
    seen: set[str] = set()
    for f in drafts:
        if f["id"] in seen:
            continue
        seen.add(f["id"])
        default = engine.feature_hours(FeatureInput(f["complexity"]))
        out.append(
            {
                "id": f["id"],
                "name": f["name"],
                "description": f["description"],
                "complexity": f["complexity"],
                "moscow": f["moscow"],
                "hours": hours_by_id.get(f["id"], default),
                "included": f["moscow"] in IN_FIRST_VERSION,
                "stories": f.get("user_stories", []),
            }
        )
    return out


def _fit_budget(features: list[Json], budget: int) -> bool:
    """Scale must-feature hours down when they go well past the size budget. True if scaled."""
    must = [f for f in features if f["moscow"] == "must"]
    total = sum(int(f["hours"]) for f in must)
    if total <= budget * BUDGET_SLACK or total == 0:
        return False
    ratio = budget / total
    for f in must:
        f["hours"] = max(4, round(int(f["hours"]) * ratio))
    return True


def _screen(s: Json) -> Json:
    return {
        "id": s["id"],
        "name": s["name"],
        "purpose": s["purpose"],
        "wireframe": [
            {"kind": b["kind"], "span": min(4, max(1, int(b["span"]))), "label": b["label"]}
            for b in s.get("wireframe", [])
        ],
    }


def fit_phases(phases: list[Json], total_weeks: int) -> list[Json]:
    """Scale the estimator's phases so they add up to the engine's weeks."""
    if not phases:
        return []
    asked = sum(max(1, int(p["weeks"])) for p in phases)
    scaled = [max(1, round(max(1, int(p["weeks"])) * total_weeks / asked)) for p in phases]
    scaled[-1] = max(1, scaled[-1] + total_weeks - sum(scaled))
    return [
        {"name": p["name"], "weeks": w, "deliverables": p.get("deliverables", [])}
        for p, w in zip(phases, scaled, strict=True)
    ]
