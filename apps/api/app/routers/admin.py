"""Admin panel API: leads, plans, AI models, provider keys, pricing. Admins only."""

from datetime import datetime
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends
from pydantic import Field, SecretStr, ValidationError
from sqlalchemy.orm import Session

from app.agents.interviewer.schemas import CamelModel
from app.agents.llm.catalog import CATALOG_CONFIG_KEY, ModelCatalog, ModelEntry, load_catalog
from app.agents.llm.chat_models import build_chat_model
from app.agents.llm.keys import ENV_VAR_BY_PROVIDER, KeyCipher, provider_environ, resolve_api_key
from app.agents.planner.graph import PLANNER_AGENTS
from app.core.config import Settings, get_settings
from app.core.errors import AppError
from app.core.owner import AdminUser
from app.db.models import AppConfig, ProviderKey
from app.db.session import get_session
from app.services import admin as admin_service
from app.services.pricing import load_pricing_config

router = APIRouter(prefix="/admin", tags=["admin"])

SessionDep = Annotated[Session, Depends(get_session)]
SettingsDep = Annotated[Settings, Depends(get_settings)]
Json = dict[str, Any]

AGENTS = ["interviewer", *PLANNER_AGENTS]
PROVIDER_LABELS = {
    "anthropic": "Anthropic",
    "openai": "OpenAI",
    "google_genai": "Google Gemini",
    "groq": "Groq",
    "mistralai": "Mistral",
    "openrouter": "OpenRouter",
    "deepseek": "DeepSeek",
    "xai": "xAI",
}


# ---------- overview & leads ----------


@router.get("/overview")
def get_overview(_: AdminUser, session: SessionDep) -> Json:
    return admin_service.overview(session)


@router.get("/leads")
def get_leads(_: AdminUser, session: SessionDep) -> list[Json]:
    return admin_service.leads(session)


class LeadUpdate(CamelModel):
    status: Literal["new", "booked", "contacted", "won", "lost"] | None = None
    notes: str | None = Field(default=None, max_length=5000)


@router.patch("/leads/{lead_id}")
def patch_lead(lead_id: str, body: LeadUpdate, _: AdminUser, session: SessionDep) -> Json:
    if not admin_service.user_exists(session, lead_id):
        raise AppError("not_found", status_code=404)
    admin_service.update_lead(session, lead_id, status=body.status, notes=body.notes)
    session.commit()
    return admin_service.leads(session, only_id=lead_id)[0]


# ---------- models ----------


def _models_payload(session: Session) -> Json:
    return {
        "catalog": load_catalog(session).model_dump(mode="json"),
        "agents": AGENTS,
        "isDefault": session.get(AppConfig, CATALOG_CONFIG_KEY) is None,
    }


@router.get("/models")
def get_models(_: AdminUser, session: SessionDep) -> Json:
    return _models_payload(session)


@router.put("/models")
def put_models(body: Json, _: AdminUser, session: SessionDep) -> Json:
    try:
        catalog = ModelCatalog.model_validate(body)
    except ValidationError as exc:
        first = exc.errors()[0]
        raise AppError(
            "invalid_catalog",
            status_code=400,
            title="These model settings can't be saved",
            message=str(first.get("msg", "Something in the settings isn't valid.")).removeprefix(
                "Value error, "
            ),
            action="Pick models that exist in the list, then save again.",
        ) from exc
    row = session.get(AppConfig, CATALOG_CONFIG_KEY)
    value = catalog.model_dump(mode="json")
    if row is None:
        session.add(AppConfig(key=CATALOG_CONFIG_KEY, value=value))
    else:
        row.value = value
    session.commit()
    return _models_payload(session)


# ---------- provider keys ----------


def _check_provider(provider: str) -> str:
    if provider not in ENV_VAR_BY_PROVIDER:
        raise AppError("not_found", status_code=404)
    return provider


def _cipher(settings: Settings) -> KeyCipher:
    cipher = KeyCipher.from_settings(settings)
    if cipher is None:
        raise AppError(
            "encryption_not_configured",
            status_code=503,
            title="Keys can't be saved yet",
            message="The server has no encryption key, so it can't store API keys safely.",
            action="Set SECRETS_ENCRYPTION_KEY in apps/api/.env and restart the API.",
        )
    return cipher


def _key_row(session: Session, provider: str, environ: dict[str, str]) -> Json:
    row = session.get(ProviderKey, provider)
    env_var = ENV_VAR_BY_PROVIDER[provider]
    env_value = environ.get(env_var, "").strip()
    updated: datetime | None = row.updated_at if row else None
    return {
        "provider": provider,
        "label": PROVIDER_LABELS.get(provider, provider),
        "envVar": env_var,
        "source": "db" if row else ("env" if env_value else "missing"),
        "last4": row.last4 if row else (env_value[-4:] if env_value else None),
        "lastTestOk": row.last_test_ok if row else None,
        "updatedAt": updated.isoformat() if updated else None,
    }


@router.get("/keys")
def get_keys(_: AdminUser, session: SessionDep) -> list[Json]:
    environ = provider_environ()
    return [_key_row(session, p, environ) for p in ENV_VAR_BY_PROVIDER]


class KeyBody(CamelModel):
    key: SecretStr = Field(min_length=8, max_length=500)


@router.put("/keys/{provider}")
def put_key(
    provider: str, body: KeyBody, admin: AdminUser, session: SessionDep, settings: SettingsDep
) -> Json:
    _check_provider(provider)
    plain = body.key.get_secret_value().strip()
    token = _cipher(settings).encrypt(plain)
    row = session.get(ProviderKey, provider)
    if row is None:
        session.add(
            ProviderKey(provider=provider, ciphertext=token, last4=plain[-4:], updated_by=admin.id)
        )
    else:
        row.ciphertext, row.last4, row.updated_by, row.last_test_ok = (
            token,
            plain[-4:],
            admin.id,
            None,
        )
    session.commit()
    return _key_row(session, provider, provider_environ())


@router.delete("/keys/{provider}")
def delete_key(provider: str, _: AdminUser, session: SessionDep) -> Json:
    _check_provider(provider)
    if (row := session.get(ProviderKey, provider)) is not None:
        session.delete(row)
        session.commit()
    return _key_row(session, provider, provider_environ())


@router.post("/keys/{provider}/test")
def test_key(provider: str, _: AdminUser, session: SessionDep, settings: SettingsDep) -> Json:
    """Send one tiny request with the key that would be used right now."""
    _check_provider(provider)
    key = resolve_api_key(
        provider,
        session=session,
        cipher=KeyCipher.from_settings(settings),
        environ=provider_environ(),
    )
    if key is None:
        return {"ok": False, "message": "There's no key for this provider yet."}
    entry = next((m for m in load_catalog(session).models if m.provider == provider), None)
    if entry is None:
        return {"ok": False, "message": "No model from this provider is in the model list."}
    ok, message = _ping(entry, key)
    if (row := session.get(ProviderKey, provider)) is not None:
        row.last_test_ok = ok
        session.commit()
    return {"ok": ok, "message": message}


def _ping(entry: ModelEntry, key: SecretStr) -> tuple[bool, str]:
    try:
        model = build_chat_model(entry, key, "low")
        model.invoke("Reply with the single word OK.")
    except Exception as exc:  # the provider's own error class varies by package
        name = type(exc).__name__
        if "Auth" in name or "Permission" in name:
            return False, "The provider rejected this key. Check it was copied in full."
        if "RateLimit" in name:
            return True, "The key works, but the provider is rate-limiting right now."
        return False, f"The provider didn't answer ({name}). Try again in a moment."
    return True, f"The key works — {entry.label} answered."


# ---------- pricing ----------


@router.get("/pricing")
def get_pricing(_: AdminUser) -> Json:
    return load_pricing_config().model_dump(mode="json")
