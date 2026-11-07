"""Settings parse env values into the shapes the app needs."""

import pytest

from app.core.config import Settings

NEON = (
    "postgresql://u:p@ep-x-pooler.eu.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
)


def make(**env: str) -> Settings:
    return Settings(_env_file=None, **env)  # type: ignore[call-arg]


def test_neon_url_is_converted_to_psycopg3_driver_and_keeps_params() -> None:
    s = make(database_url=NEON)
    assert s.database_url == (
        "postgresql+psycopg://u:p@ep-x-pooler.eu.aws.neon.tech/neondb"
        "?sslmode=require&channel_binding=require"
    )


@pytest.mark.parametrize("scheme", ["postgres://", "postgresql://", "postgresql+psycopg://"])
def test_all_postgres_schemes_normalise(scheme: str) -> None:
    s = make(database_url_unpooled=f"{scheme}u:p@h/db")
    assert s.database_url_unpooled == "postgresql+psycopg://u:p@h/db"


def test_admin_emails_from_comma_separated_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ADMIN_EMAILS", " A@x.com, b@y.com ,")
    s = Settings(_env_file=None)  # type: ignore[call-arg]
    assert s.admin_emails == ["a@x.com", "b@y.com"]
    assert s.is_admin("B@Y.com")
    assert not s.is_admin("c@z.com")


def test_cors_origins_default_to_local_web_app(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("CORS_ORIGINS", raising=False)
    assert make().cors_origins == ["http://localhost:3000"]


def test_cors_origins_from_comma_separated_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CORS_ORIGINS", "https://a.app,https://b.app")
    assert Settings(_env_file=None).cors_origins == ["https://a.app", "https://b.app"]  # type: ignore[call-arg]


def test_missing_database_urls_are_none_not_crash() -> None:
    s = make()
    assert s.database_url is None
    assert s.database_url_unpooled is None
    assert s.environment == "development"
