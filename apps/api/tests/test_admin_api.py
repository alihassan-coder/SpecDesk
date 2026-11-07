"""Admin API against the dev database. Rows it writes are removed afterwards."""

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.agents.llm.catalog import CATALOG_CONFIG_KEY, DEFAULT_CATALOG
from app.core.owner import AuthUser, current_user
from app.db.models import AppConfig, ProviderKey
from app.db.session import get_engine, session_scope
from app.main import create_app

ADMIN = AuthUser(id="test-admin", email="admin@example.com", is_admin=True)
FOUNDER = AuthUser(id="test-founder", email="founder@example.com", is_admin=False)


@pytest.fixture
def db_ready() -> None:
    try:
        with get_engine().connect() as conn:
            conn.execute(text('select 1 from "user" limit 1'))
    except Exception:
        pytest.skip("dev database (with Better Auth tables) not reachable")


def _client(user: AuthUser) -> TestClient:
    app = create_app()
    app.dependency_overrides[current_user] = lambda: user
    return TestClient(app)


@pytest.fixture
def admin(db_ready: None) -> Iterator[TestClient]:
    with session_scope() as s:
        had_catalog = s.get(AppConfig, CATALOG_CONFIG_KEY) is not None
        had_mistral_key = s.get(ProviderKey, "mistralai") is not None
    yield _client(ADMIN)
    with session_scope() as s:
        if not had_catalog and (row := s.get(AppConfig, CATALOG_CONFIG_KEY)) is not None:
            s.delete(row)
        if not had_mistral_key and (key := s.get(ProviderKey, "mistralai")) is not None:
            s.delete(key)


def test_non_admins_get_a_friendly_403(db_ready: None) -> None:
    client = _client(FOUNDER)
    for path in ("/admin/overview", "/admin/leads", "/admin/models", "/admin/keys"):
        res = client.get(f"/api/v1{path}")
        assert res.status_code == 403
        assert res.json()["error"]["code"] == "admin_only"


def test_overview_and_leads_have_the_documented_shape(admin: TestClient) -> None:
    overview = admin.get("/api/v1/admin/overview").json()
    assert set(overview["stats"]) == {"users", "chats", "plans", "agentRuns", "costUsd30d"}
    for row in overview["plans"]:
        assert {"chatId", "planId", "title", "ownerEmail", "status", "updatedAt"} <= set(row)

    leads = admin.get("/api/v1/admin/leads").json()
    for lead in leads:
        assert {"id", "email", "status", "chats", "plans", "costUsd"} <= set(lead)
    assert admin.patch("/api/v1/admin/leads/nobody", json={"status": "won"}).status_code == 404


def test_models_round_trip_and_bad_catalogs_are_rejected(admin: TestClient) -> None:
    current = admin.get("/api/v1/admin/models").json()
    assert "interviewer" in current["agents"] and "critic" in current["agents"]

    catalog = DEFAULT_CATALOG.model_dump(mode="json")
    catalog["agent_models"] = {"critic": "groq:openai/gpt-oss-20b"}
    saved = admin.put("/api/v1/admin/models", json=catalog).json()
    assert saved["isDefault"] is False
    assert saved["catalog"]["agent_models"] == {"critic": "groq:openai/gpt-oss-20b"}

    catalog["default_model"] = "nope:missing"
    bad = admin.put("/api/v1/admin/models", json=catalog)
    assert bad.status_code == 400
    assert bad.json()["error"]["code"] == "invalid_catalog"


def test_keys_are_stored_encrypted_and_only_last4_is_shown(admin: TestClient) -> None:
    rows = admin.get("/api/v1/admin/keys").json()
    assert {r["provider"] for r in rows} >= {"groq", "anthropic"}

    saved = admin.put("/api/v1/admin/keys/mistralai", json={"key": "mk-test-secret-1234"})
    assert saved.status_code == 200, saved.text
    assert saved.json()["source"] == "db"
    assert saved.json()["last4"] == "1234"
    assert "secret" not in saved.text
    with session_scope() as s:
        row = s.get(ProviderKey, "mistralai")
        assert row is not None and "secret" not in row.ciphertext

    removed = admin.delete("/api/v1/admin/keys/mistralai").json()
    assert removed["source"] in {"env", "missing"}
    assert admin.put("/api/v1/admin/keys/unknown", json={"key": "x" * 10}).status_code == 404


def test_pricing_is_readable(admin: TestClient) -> None:
    pricing = admin.get("/api/v1/admin/pricing").json()
    assert pricing["currency"] and set(pricing["complexity_hours"]) == {"S", "M", "L", "XL"}
