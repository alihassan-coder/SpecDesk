"""Read models for the admin panel: leads, plans across users, usage.

Users live in Better Auth's `user` table (same database, not managed by Alembic); it is only
ever read here, with plain SQL.
"""

import uuid
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Any

from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from app.db.models import AgentRun, Chat, Lead, Message, Plan, PlanVersion

Json = dict[str, Any]


def _users(session: Session) -> list[Json]:
    rows = session.execute(
        text('select id, name, email, "createdAt" from "user" order by "createdAt" desc limit 500')
    ).mappings()
    return [dict(r) for r in rows]


def _iso(value: datetime | None) -> str | None:
    return value.isoformat() if value else None


def overview(session: Session) -> Json:
    since = datetime.now(UTC) - timedelta(days=30)
    cost = session.scalar(
        select(func.coalesce(func.sum(AgentRun.cost_usd), 0)).where(AgentRun.created_at >= since)
    )
    emails = {u["id"]: u["email"] for u in _users(session)}
    rows = session.execute(
        select(Chat, Plan.id, PlanVersion.price_min, PlanVersion.price_max, PlanVersion.weeks)
        .outerjoin(Plan, Plan.chat_id == Chat.id)
        .outerjoin(PlanVersion, PlanVersion.id == Plan.current_version_id)
        .order_by(Chat.updated_at.desc())
        .limit(50)
    ).all()
    return {
        "stats": {
            "users": session.scalar(text('select count(*) from "user"')) or 0,
            "chats": session.scalar(select(func.count()).select_from(Chat)) or 0,
            "plans": session.scalar(select(func.count()).select_from(Plan)) or 0,
            "agentRuns": session.scalar(select(func.count()).select_from(AgentRun)) or 0,
            "costUsd30d": str(Decimal(cost or 0).quantize(Decimal("0.000001"))),
        },
        "plans": [
            {
                "chatId": str(chat.id),
                "planId": str(plan_id) if plan_id else None,
                "title": chat.title,
                "ownerEmail": emails.get(chat.owner_id),
                "status": chat.status,
                "priceMin": price_min,
                "priceMax": price_max,
                "weeks": weeks,
                "updatedAt": chat.updated_at.isoformat(),
            }
            for chat, plan_id, price_min, price_max, weeks in rows
        ],
    }


def leads(session: Session, only_id: str | None = None) -> list[Json]:
    users = [u for u in _users(session) if only_id is None or u["id"] == only_id]
    ids = [u["id"] for u in users]
    if not ids:
        return []

    chats = session.scalars(
        select(Chat).where(Chat.owner_id.in_(ids)).order_by(Chat.updated_at.desc())
    ).all()
    by_owner: dict[str, list[Chat]] = {}
    for c in chats:
        by_owner.setdefault(c.owner_id, []).append(c)

    plan_rows = session.execute(
        select(Plan.owner_id, Plan.id, Chat.title, PlanVersion)
        .join(Chat, Chat.id == Plan.chat_id)
        .join(PlanVersion, PlanVersion.id == Plan.current_version_id)
        .where(Plan.owner_id.in_(ids))
        .order_by(PlanVersion.created_at.desc())
    ).all()
    plans: dict[str, list[Json]] = {}
    for owner_id, plan_id, chat_title, version in plan_rows:
        plans.setdefault(owner_id, []).append(
            {
                "id": str(plan_id),
                "title": str(version.data.get("title") or chat_title),
                "version": version.label,
                "priceMin": version.price_min,
                "priceMax": version.price_max,
                "weeks": version.weeks,
            }
        )

    costs: dict[str, Decimal | None] = {
        owner_id: total
        for owner_id, total in session.execute(
            select(Chat.owner_id, func.sum(AgentRun.cost_usd))
            .join(AgentRun, AgentRun.chat_id == Chat.id)
            .where(Chat.owner_id.in_(ids))
            .group_by(Chat.owner_id)
        ).all()
    }
    lead_rows = {
        lead.owner_id: lead
        for lead in session.scalars(select(Lead).where(Lead.owner_id.in_(ids))).all()
    }

    out: list[Json] = []
    for u in users:
        own = by_owner.get(u["id"], [])
        lead = lead_rows.get(u["id"])
        out.append(
            {
                "id": u["id"],
                "name": u["name"] or None,
                "email": u["email"],
                "signedUpAt": _iso(u["createdAt"]),
                "lastActiveAt": _iso(own[0].updated_at) if own else None,
                "status": lead.status if lead else "new",
                "notes": lead.notes if lead else None,
                "idea": own[0].idea if own else None,
                "budget": (lead.budget_range if lead and lead.budget_range else None)
                or _budget_hint(session, own),
                "chats": len(own),
                "costUsd": str(Decimal(costs.get(u["id"]) or 0).quantize(Decimal("0.000001"))),
                "plans": plans.get(u["id"], []),
            }
        )
    return out


def _budget_hint(session: Session, chats: list[Chat]) -> str | None:
    """The budget the founder picked in the prompt box, from their latest chat."""
    for chat in chats:
        first = session.scalars(
            select(Message).where(Message.chat_id == chat.id, Message.kind == "idea").limit(1)
        ).first()
        content: Json = dict(first.content) if first else {}
        hints: Json = dict(content.get("hints") or {})
        budget = hints.get("budget")
        if budget:
            return str(budget)
    return None


def user_exists(session: Session, owner_id: str) -> bool:
    return bool(session.scalar(text('select 1 from "user" where id = :id'), {"id": owner_id}))


def update_lead(session: Session, owner_id: str, *, status: str | None, notes: str | None) -> None:
    lead = session.scalars(select(Lead).where(Lead.owner_id == owner_id)).first()
    if lead is None:
        lead = Lead(id=uuid.uuid4(), owner_id=owner_id, status="new")
        session.add(lead)
    if status is not None:
        lead.status = status
    if notes is not None:
        lead.notes = notes
    session.flush()
