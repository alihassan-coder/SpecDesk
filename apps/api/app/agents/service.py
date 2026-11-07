"""Wiring for routes: build the `AskModel` a chat uses, with keys and cost tracking."""

import uuid
from collections.abc import Callable
from typing import Annotated

from fastapi import Depends
from pydantic import SecretStr
from sqlalchemy.orm import Session

from app.agents.llm.ask import AskModel
from app.agents.llm.catalog import load_catalog
from app.agents.llm.keys import KeyCipher, provider_environ, resolve_api_key
from app.agents.llm.structured import CallRecord, ModelGateway
from app.core.config import Settings, get_settings
from app.db.models import AgentRun
from app.db.session import get_session, session_scope


def get_ask_for_chat(
    session: Annotated[Session, Depends(get_session)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> Callable[[uuid.UUID], AskModel]:
    """FastAPI dependency. Tests override it with a fake model."""
    catalog = load_catalog(session)
    cipher = KeyCipher.from_settings(settings)
    environ = provider_environ()

    def for_chat(chat_id: uuid.UUID) -> AskModel:
        def keys(provider: str) -> SecretStr | None:
            with session_scope() as s:
                return resolve_api_key(provider, session=s, cipher=cipher, environ=environ)

        def record(call: CallRecord) -> None:
            with session_scope() as s:
                s.add(
                    AgentRun(
                        chat_id=chat_id,
                        agent=call.agent,
                        model=call.model_id,
                        status="ok" if call.ok else "error",
                        input_tokens=call.usage.input_tokens,
                        output_tokens=call.usage.output_tokens,
                        cache_read_tokens=call.usage.cache_read_tokens,
                        cache_write_tokens=call.usage.cache_write_tokens,
                        cost_usd=call.cost_usd,
                        duration_ms=call.duration_ms,
                        error=call.error,
                    )
                )

        return ModelGateway(catalog, keys=keys, record=record)

    return for_chat
