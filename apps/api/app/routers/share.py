"""Read-only share links. The owner turns a link on or off; anyone with the token can read.

The public routes take no auth dependency at all: the unguessable token is the only key.
"""

import secrets
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.db.models import Plan, PlanVersion
from app.db.session import get_session
from app.routers.plans import OwnedPlan
from app.services.plan_files import find_file
from app.services.plans import current_version, plan_payload

router = APIRouter(tags=["share"])

SessionDep = Annotated[Session, Depends(get_session)]


@router.post("/plans/{plan_id}/share")
def create_share(owned: OwnedPlan, session: SessionDep) -> dict[str, str]:
    plan, _ = owned
    if not plan.share_token:
        plan.share_token = secrets.token_urlsafe(24)
        session.commit()
    token = plan.share_token
    return {"token": token, "path": f"/share/{token}"}


@router.delete("/plans/{plan_id}/share")
def revoke_share(owned: OwnedPlan, session: SessionDep) -> dict[str, None]:
    plan, _ = owned
    plan.share_token = None
    session.commit()
    return {"token": None}


def _link_not_working() -> AppError:
    return AppError(
        "share_not_found",
        status_code=404,
        title="This share link doesn't work any more",
        message="The owner may have turned sharing off, or the link was copied incompletely.",
        action="Ask the person who sent it for a new link.",
    )


def shared_plan(token: str, session: SessionDep) -> tuple[Plan, PlanVersion]:
    plan = session.scalars(select(Plan).where(Plan.share_token == token)).first() if token else None
    version = current_version(session, plan) if plan is not None else None
    if plan is None or version is None:
        raise _link_not_working()
    return plan, version


SharedPlan = Annotated[tuple[Plan, PlanVersion], Depends(shared_plan)]


@router.get("/share/{token}")
def read_shared(shared: SharedPlan, session: SessionDep) -> dict[str, Any]:
    plan, version = shared
    payload = plan_payload(session, plan, version)
    payload.pop("chatId", None)  # the conversation stays private
    return payload


@router.get("/share/{token}/files/{name}")
def download_shared_file(name: str, shared: SharedPlan) -> Response:
    _, version = shared
    file = find_file(dict(version.data), name)
    if file is None:
        raise AppError(
            "file_not_found",
            status_code=404,
            title="That file isn't part of this plan",
            message=f"There's no file called {name} in this plan.",
            action="Open the shared plan and pick a file from the list.",
        )
    return Response(
        content=file.content,
        media_type=file.media_type,
        headers={"Content-Disposition": f'attachment; filename="{file.name}"'},
    )
