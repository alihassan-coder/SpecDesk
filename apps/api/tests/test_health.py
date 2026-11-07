from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, create_engine
from sqlalchemy.exc import OperationalError

from app.core.config import Settings
from app.db.session import get_engine
from app.main import create_app


@pytest.fixture
def app_client() -> Iterator[TestClient]:
    app = create_app()
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_liveness(app_client: TestClient) -> None:
    res = app_client.get("/api/v1/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}


def test_db_health_is_humanized_503_when_db_unreachable(app_client: TestClient) -> None:
    dead = create_engine(
        "postgresql+psycopg://u:p@127.0.0.1:1/none", connect_args={"connect_timeout": 1}
    )
    app_client.app.dependency_overrides[get_engine] = lambda: dead  # type: ignore[attr-defined]

    res = app_client.get("/api/v1/health/db")

    assert res.status_code == 503
    err = res.json()["error"]
    assert err["code"] == "database_unavailable"
    assert err["title"] == "We can't reach our database"
    assert "127.0.0.1" not in res.text


def test_db_health_is_humanized_503_when_db_not_configured(
    app_client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr("app.db.session.get_settings", lambda: Settings(_env_file=None))  # type: ignore[call-arg]
    get_engine.cache_clear()
    try:
        res = app_client.get("/api/v1/health/db")
    finally:
        get_engine.cache_clear()
    assert res.status_code == 503
    assert res.json()["error"]["code"] == "database_unavailable"


def _real_engine() -> Engine | None:
    url = Settings().database_url
    if url is None:
        return None
    engine = create_engine(url, connect_args={"connect_timeout": 5})
    try:
        with engine.connect():
            return engine
    except OperationalError:
        return None


def test_db_health_ok_against_real_database(app_client: TestClient) -> None:
    engine = _real_engine()
    if engine is None:
        pytest.skip("No reachable DATABASE_URL")
    app_client.app.dependency_overrides[get_engine] = lambda: engine  # type: ignore[attr-defined]
    res = app_client.get("/api/v1/health/db")
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}
