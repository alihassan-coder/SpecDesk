"""Save plans and shape them for the browser."""

import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.agents.planner.assemble import fit_phases
from app.db.models import Chat, Message, Plan, PlanVersion
from app.services.plan_files import build_files, human_size, preview
from app.services.pricing import FeatureInput, PricingEngine, load_pricing_config

Json = dict[str, Any]


def plan_for_chat(session: Session, chat_id: uuid.UUID) -> Plan | None:
    return session.scalars(select(Plan).where(Plan.chat_id == chat_id)).first()


def save_first_version(session: Session, chat: Chat, data: Json) -> Plan:
    """Create the plan and its v1. Safe to call twice: an existing plan is returned as is."""
    if existing := plan_for_chat(session, chat.id):
        return existing
    plan = Plan(chat_id=chat.id, owner_id=chat.owner_id)
    session.add(plan)
    session.flush()
    est: Json = data.get("estimate", {})
    version = PlanVersion(
        plan_id=plan.id,
        number=1,
        label="v1",
        data=data,
        price_min=int(est.get("priceMin", 0)),
        price_max=int(est.get("priceMax", 0)),
        weeks=int(est.get("weeks", 0)),
        change_summary="First plan from the interview",
    )
    session.add(version)
    session.flush()
    plan.current_version_id = version.id
    chat.status = "ready"
    return plan


def save_scope_change(
    session: Session, plan: Plan, base: PlanVersion, included: dict[str, bool], change: str
) -> PlanVersion:
    """A new version with features switched in or out. Price and weeks are recomputed here,
    never taken from the browser."""
    data: Json = dict(base.data)
    features: list[Json] = [
        {**f, "included": included.get(f["id"], f["included"])} for f in data.get("features", [])
    ]
    engine = PricingEngine(load_pricing_config())
    totals = engine.estimate(
        [FeatureInput(f["complexity"], int(f["hours"]), bool(f["included"])) for f in features]
    )
    data["features"] = features
    data["phases"] = fit_phases(data.get("phases", []), totals.weeks)
    data["estimate"] = {
        **data.get("estimate", {}),
        "hours": totals.hours,
        "priceMin": totals.price_min,
        "priceMax": totals.price_max,
        "weeks": totals.weeks,
    }
    last = session.scalars(
        select(PlanVersion.number)
        .where(PlanVersion.plan_id == plan.id)
        .order_by(PlanVersion.number.desc())
    ).first()
    number = (last or 0) + 1
    version = PlanVersion(
        plan_id=plan.id,
        number=number,
        label=f"v{number} · Your edit",
        data=data,
        price_min=totals.price_min,
        price_max=totals.price_max,
        weeks=totals.weeks,
        change_summary=change[:500] or "Scope changed",
    )
    session.add(version)
    session.flush()
    plan.current_version_id = version.id
    return version


def version_card(v: PlanVersion) -> Json:
    return {
        "id": str(v.id),
        "label": v.label,
        "createdAt": v.created_at.isoformat(),
        "priceMin": v.price_min,
        "priceMax": v.price_max,
        "weeks": v.weeks,
        "change": v.change_summary or "",
    }


def current_version(session: Session, plan: Plan) -> PlanVersion | None:
    if plan.current_version_id is None:
        return None
    return session.get(PlanVersion, plan.current_version_id)


def file_cards(plan_id: uuid.UUID, data: Json) -> list[Json]:
    """The web `PlanFile` shape: id, name, kind, size, preview."""
    return [
        {
            "id": f"{plan_id}:{f.name}",
            "name": f.name,
            "kind": f.kind,
            "size": human_size(len(f.content)),
            "preview": preview(f),
        }
        for f in build_files(data)
    ]


def plan_payload(session: Session, plan: Plan, version: PlanVersion) -> Json:
    versions = session.scalars(
        select(PlanVersion).where(PlanVersion.plan_id == plan.id).order_by(PlanVersion.number)
    ).all()
    data: Json = dict(version.data)
    return {
        **data,
        "id": str(plan.id),
        "chatId": str(plan.chat_id),
        "version": version.label,
        "versions": [version_card(v) for v in versions],
        "files": file_cards(plan.id, data),
        "research": latest_research(session, plan.chat_id),
    }


def latest_research(session: Session, chat_id: uuid.UUID) -> Json | None:
    """The newest web research for this plan's chat, if the founder asked for one."""
    row = session.scalars(
        select(Message)
        .where(Message.chat_id == chat_id, Message.kind == "research")
        .order_by(Message.created_at.desc())
        .limit(1)
    ).first()
    return dict(row.content) if row else None
