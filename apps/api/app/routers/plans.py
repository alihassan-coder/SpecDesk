"""Read a plan and download its files. Every route checks the plan belongs to the caller."""

import logging
import uuid
from collections.abc import Iterator
from concurrent.futures import ThreadPoolExecutor
from concurrent.futures import TimeoutError as FutureTimeout
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Response
from fastapi.sse import EventSourceResponse, ServerSentEvent
from pydantic import Field
from sqlalchemy.orm import Session

from app.agents.interviewer.schemas import CamelModel
from app.agents.llm.catalog import load_catalog
from app.agents.llm.keys import KeyCipher, provider_environ, resolve_api_key
from app.agents.researcher import research_competitors
from app.core.config import Settings, get_settings
from app.core.errors import AppError, humanize
from app.core.owner import Owner
from app.db.models import AgentRun, Message, Plan, PlanVersion
from app.db.session import get_session, session_scope
from app.services.plan_files import find_file
from app.services.plans import current_version, plan_payload, save_scope_change, version_card

router = APIRouter(prefix="/plans", tags=["plans"])
logger = logging.getLogger("specdesk.research")

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


@router.post("/{plan_id}/research", response_class=EventSourceResponse)
def research(
    owned: OwnedPlan, session: SessionDep, settings: Annotated[Settings, Depends(get_settings)]
) -> Iterator[ServerSentEvent]:
    """Live web search for competitors. Slow, so the stream sends a note every few seconds."""
    plan, version = owned
    key = resolve_api_key(
        "groq",
        session=session,
        cipher=KeyCipher.from_settings(settings),
        environ=provider_environ(),
    )
    if key is None:
        raise AppError(
            "model_not_configured",
            status_code=503,
            title="Research needs a Groq key",
            message="Web research runs on Groq, and there's no Groq API key yet.",
            action="Add a Groq key in Admin → API keys, or set GROQ_API_KEY in apps/api/.env.",
        )
    data: dict[str, Any] = dict(version.data)
    product = f"{data.get('title', '')}: {data.get('oneLiner', '')}\n{data.get('problem', '')}"
    catalog = load_catalog(session)
    chat_id = plan.chat_id

    yield ServerSentEvent(event="agent.status", data={"agent": "researcher", "status": "working"})
    with ThreadPoolExecutor(max_workers=1) as pool:
        job = pool.submit(research_competitors, product, key, catalog)
        waited = 0
        while True:
            try:
                result = job.result(timeout=8)
                break
            except FutureTimeout:
                waited += 8
                yield ServerSentEvent(
                    event="agent.note",
                    data={"agent": "researcher", "text": f"Still searching the web… {waited}s"},
                )
            except Exception:
                logger.exception("Research failed")
                yield ServerSentEvent(
                    event="error", data=humanize("model_unavailable").model_dump()
                )
                return

    payload = result.research.model_dump()
    with session_scope() as s:
        s.add(Message(chat_id=chat_id, role="assistant", kind="research", content=payload))
        r = result.record
        s.add(
            AgentRun(
                chat_id=chat_id,
                agent=r.agent,
                model=r.model_id,
                status="ok",
                input_tokens=r.usage.input_tokens,
                output_tokens=r.usage.output_tokens,
                cost_usd=r.cost_usd,
                duration_ms=r.duration_ms,
            )
        )
    yield ServerSentEvent(event="agent.status", data={"agent": "researcher", "status": "done"})
    yield ServerSentEvent(event="research.done", data=payload)


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
