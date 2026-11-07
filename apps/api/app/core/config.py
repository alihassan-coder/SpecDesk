"""Typed settings from env / `apps/api/.env` (pydantic-settings)."""

import re
from functools import lru_cache
from pathlib import Path
from typing import Annotated, Literal

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

API_DIR = Path(__file__).resolve().parents[2]

_PG_SCHEME = re.compile(r"^postgres(?:ql)?(?:\+\w+)?://")

CommaList = Annotated[list[str], NoDecode]


def to_psycopg_url(url: str) -> str:
    """Neon gives `postgresql://…`; SQLAlchemy needs the psycopg 3 driver name."""
    return _PG_SCHEME.sub("postgresql+psycopg://", url.strip(), count=1)


def _split_commas(value: object) -> object:
    if isinstance(value, str):
        return [part.strip() for part in value.split(",") if part.strip()]
    return value


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=API_DIR / ".env", env_file_encoding="utf-8", extra="ignore"
    )

    environment: Literal["development", "test", "preview", "production"] = "development"
    # repr=False keeps credentials out of logs and tracebacks.
    database_url: str | None = Field(default=None, repr=False)
    database_url_unpooled: str | None = Field(default=None, repr=False)
    admin_emails: CommaList = []
    cors_origins: CommaList = ["http://localhost:3000"]
    secrets_encryption_key: SecretStr | None = None  # required from M7 (admin keys)
    # Better Auth's JWT plugin (apps/web). It signs with iss = aud = BETTER_AUTH_URL.
    auth_jwks_url: str = "http://localhost:3000/api/auth/jwks"
    auth_issuer: str = "http://localhost:3000"
    auth_audience: str = "http://localhost:3000"
    # Transactional email (Brevo). No key = emails are skipped (logged at info level).
    brevo_api_key: SecretStr | None = None
    email_from_address: str | None = None
    email_from_name: str = "SpecDesk"
    web_url: str = "http://localhost:3000"  # public site, for links in emails

    @field_validator("database_url", "database_url_unpooled", mode="before")
    @classmethod
    def _normalise_db_url(cls, value: object) -> object:
        if isinstance(value, str):
            return to_psycopg_url(value) if value.strip() else None
        return value

    @field_validator("admin_emails", mode="before")
    @classmethod
    def _parse_admin_emails(cls, value: object) -> object:
        parsed = _split_commas(value)
        if isinstance(parsed, list):
            return [str(e).lower() for e in parsed]  # pyright: ignore[reportUnknownVariableType, reportUnknownArgumentType]
        return parsed

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _parse_cors(cls, value: object) -> object:
        return _split_commas(value)

    def is_admin(self, email: str) -> bool:
        return email.strip().lower() in self.admin_emails


@lru_cache
def get_settings() -> Settings:
    return Settings()
