import pytest

APP_ENV_VARS = (
    "DATABASE_URL",
    "DATABASE_URL_UNPOOLED",
    "ADMIN_EMAILS",
    "CORS_ORIGINS",
    "ENVIRONMENT",
    "SECRETS_ENCRYPTION_KEY",
)


@pytest.fixture(autouse=True)
def _isolate_env(monkeypatch: pytest.MonkeyPatch) -> None:
    """Process env must not leak into tests; `.env` file values are still read where wanted."""
    for name in APP_ENV_VARS:
        monkeypatch.delenv(name, raising=False)
