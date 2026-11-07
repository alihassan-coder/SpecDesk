"""Read a plan and download its files. Every route checks the plan belongs to the caller."""

import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Response
from pydantic import Field
from sqlalchemy.orm import Session

from app.agents.interviewer.schemas import CamelModel
from app.core.errors import AppError
from app.core.owner import Owner
from app.db.models import Plan, PlanVersion
from app.db.session import get_session
from app.services.plan_files import find_file
from app.services.plans import current_version, plan_payload, save_scope_change, version_card

router = APIRouter(prefix="/plans", tags=["plans"])

SessionDep = Annotated[Session, Depends(get_session)]


def owned_plan(plan_id: uuid.UUID, owner: Owner, session: SessionDep) -> tuple[Plan, PlanVersion]:
    plan = session.get(Plan, plan_id)
    version = current_version(session, plan) if plan is not None else None
    if plan is None or plan.owner_id != owner or version is None:
        raise AppError("not_found", status_code=404)  # never reveal that it exists
    return plan, version


OwnedPlan = Annotated[tuple[Plan, PlanVersion], Depends(owned_plan)]


@router.get("/{plan_id}")
def get_plan(owned: OwnedPlan, session: SessionDep) -> dict[str, Any]:
    plan, version = owned
    return plan_payload(session, plan, version)


class ScopeChange(CamelModel):
    included: dict[str, bool] = Field(description="feature id → in the first version or not")
    change: str = Field(default="", max_length=500)


@router.post("/{plan_id}/versions", status_code=201)
def save_version(body: ScopeChange, owned: OwnedPlan, session: SessionDep) -> dict[str, Any]:
    plan, base = owned
    version = save_scope_change(session, plan, base, body.included, body.change)
    session.commit()
    return version_card(version)


@router.get("/{plan_id}/files/{name}")
def download_file(name: str, owned: OwnedPlan) -> Response:
    _, version = owned
    file = find_file(dict(version.data), name)
    if file is None:
        raise AppError(
            "file_not_found",
            status_code=404,
            title="That file isn't part of this plan",
            message=f"There's no file called {name} in this plan.",
            action="Open the plan and pick a file from the list.",
        )
    return Response(
        content=file.content,
        media_type=file.media_type,
        headers={"Content-Disposition": f'attachment; filename="{file.name}"'},
    )
