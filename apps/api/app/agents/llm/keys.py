"""Find the API key for a provider.

Order: a key saved in Admin → API keys (stored encrypted in `provider_key`), then the
environment variable LangChain would read anyway. Keys are only ever held as `SecretStr`.
"""

import os
from collections.abc import Mapping
from pathlib import Path

from cryptography.fernet import Fernet, InvalidToken
from dotenv import dotenv_values
from pydantic import SecretStr
from sqlalchemy.orm import Session

from app.core.config import API_DIR, Settings
from app.core.errors import AppError
from app.db.models import ProviderKey

# The env var each LangChain provider package reads by default.
ENV_VAR_BY_PROVIDER: dict[str, str] = {
    "anthropic": "ANTHROPIC_API_KEY",
    "openai": "OPENAI_API_KEY",
    "google_genai": "GOOGLE_API_KEY",
    "groq": "GROQ_API_KEY",
    "mistralai": "MISTRAL_API_KEY",
    "openrouter": "OPENROUTER_API_KEY",
    "deepseek": "DEEPSEEK_API_KEY",
    "xai": "XAI_API_KEY",
}


def provider_environ(env_file: Path = API_DIR / ".env") -> dict[str, str]:
    """Provider keys from `apps/api/.env` plus the process environment (which wins).

    Our `Settings` only loads the variables it declares, so provider keys such as
    `ANTHROPIC_API_KEY` written in `.env` would otherwise never be seen.
    """
    from_file = {k: v for k, v in dotenv_values(env_file).items() if v} if env_file.exists() else {}
    return {**from_file, **os.environ}


class KeyCipher:
    """Encrypts provider keys for storage. Wraps Fernet so the rest of the code never sees it."""

    def __init__(self, secret: SecretStr) -> None:
        self._fernet = Fernet(secret.get_secret_value().encode())

    @classmethod
    def from_settings(cls, settings: Settings) -> "KeyCipher | None":
        return cls(settings.secrets_encryption_key) if settings.secrets_encryption_key else None

    def encrypt(self, plain: str) -> str:
        return self._fernet.encrypt(plain.encode()).decode()

    def decrypt(self, token: str) -> SecretStr:
        try:
            return SecretStr(self._fernet.decrypt(token.encode()).decode())
        except InvalidToken as exc:
            raise AppError(
                "key_unreadable",
                status_code=500,
                title="A saved API key can't be read",
                message="The encryption key changed since this API key was saved.",
                action="Save the provider's API key again in Admin → API keys.",
            ) from exc


def resolve_api_key(
    provider: str,
    *,
    session: Session | None,
    cipher: KeyCipher | None,
    environ: Mapping[str, str] = os.environ,
) -> SecretStr | None:
    if session is not None and cipher is not None:
        row = session.get(ProviderKey, provider)
        if row is not None:
            return cipher.decrypt(row.ciphertext)
    env_var = ENV_VAR_BY_PROVIDER.get(provider)
    value = environ.get(env_var, "").strip() if env_var else ""
    return SecretStr(value) if value else None
