"""JWT auth: Better Auth tokens verified against a JWKS. No network: the key set is local."""

import json
import time
import uuid
from collections.abc import Iterator
from typing import Any

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from fastapi import APIRouter, FastAPI
from fastapi.testclient import TestClient
from jwt.algorithms import OKPAlgorithm
from langgraph.checkpoint.memory import InMemorySaver
from sqlalchemy import text

from app.agents.runtime.checkpointer import get_checkpointer
from app.core.config import Settings, get_settings
from app.core.owner import DEV_OWNER_ID, AdminUser, CurrentUser, get_jwks_client
from app.db.models import Chat
from app.db.session import get_engine, session_scope
from app.main import create_app

ISSUER = "http://localhost:3000"
ADMIN = "boss@specdesk.test"
KID = "test-key"


class LocalKeys:
    """Stands in for PyJWKClient: one Ed25519 key, like Better Auth's default."""

    def __init__(self) -> None:
        self.private = Ed25519PrivateKey.generate()
        jwk: dict[str, Any] = json.loads(OKPAlgorithm.to_jwk(self.private.public_key()))
        self.jwk = jwt.PyJWK({**jwk, "alg": "EdDSA", "kid": KID})

    def get_signing_key_from_jwt(self, token: str) -> jwt.PyJWK:
        if jwt.get_unverified_header(token).get("kid") != KID:
            raise jwt.PyJWKClientError("Unable to find a signing key that matches")
        return self.jwk

    def token(self, sub: str, email: str, **overrides: Any) -> str:
        now = int(time.time())
        claims: dict[str, Any] = {
            "sub": sub,
            "email": email,
            "iss": ISSUER,
            "aud": ISSUER,
            "iat": now,
            "exp": now + 900,
            **overrides,
        }
        return jwt.encode(claims, self.private, algorithm="EdDSA", headers={"kid": KID})


def _settings(environment: str) -> Settings:
    return Settings(
        _env_file=None,  # type: ignore[call-arg]
        environment=environment,  # type: ignore[arg-type]
        admin_emails=ADMIN,  # type: ignore[arg-type]
        auth_issuer=ISSUER,
        auth_audience=ISSUER,
    )


probe = APIRouter()


@probe.get("/_test/me")
def me(user: CurrentUser) -> dict[str, Any]:
    return {"id": user.id, "email": user.email, "is_admin": user.is_admin}


@probe.get("/_test/admin")
def admin_only(user: AdminUser) -> dict[str, str]:
    return {"id": user.id}


@pytest.fixture
def keys() -> LocalKeys:
    return LocalKeys()


def _app(keys: LocalKeys, environment: str = "production") -> FastAPI:
    app = create_app()
    app.include_router(probe)
    app.dependency_overrides[get_settings] = lambda: _settings(environment)
    app.dependency_overrides[get_jwks_client] = lambda: keys
    return app


def _bearer(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_valid_token_gives_the_user(keys: LocalKeys) -> None:
    client = TestClient(_app(keys))
    res = client.get("/_test/me", headers=_bearer(keys.token("user-a", "a@example.com")))
    assert res.status_code == 200
    assert res.json() == {"id": "user-a", "email": "a@example.com", "is_admin": False}


@pytest.mark.parametrize(
    "overrides",
    [
        {"exp": int(time.time()) - 60},  # expired
        {"iss": "https://evil.example"},  # wrong issuer
        {"aud": "https://other-app.example"},  # wrong audience
    ],
    ids=["expired", "wrong-issuer", "wrong-audience"],
)
def test_bad_tokens_are_a_humanized_401(keys: LocalKeys, overrides: dict[str, Any]) -> None:
    client = TestClient(_app(keys))
    res = client.get("/_test/me", headers=_bearer(keys.token("user-a", "a@x.io", **overrides)))
    assert res.status_code == 401
    error = res.json()["error"]
    assert error["code"] == "session_expired"
    assert error["title"] == "Your session expired"
    assert error["action"] == "Sign in again."


def test_token_signed_by_another_key_is_rejected(keys: LocalKeys) -> None:
    forged = LocalKeys().token("user-a", "a@x.io")  # same kid, different private key
    res = TestClient(_app(keys)).get("/_test/me", headers=_bearer(forged))
    assert res.status_code == 401
    assert res.json()["error"]["code"] == "session_expired"


def test_garbage_token_is_rejected(keys: LocalKeys) -> None:
    res = TestClient(_app(keys)).get("/_test/me", headers=_bearer("not-a-jwt"))
    assert res.status_code == 401
    assert res.json()["error"]["code"] == "session_expired"


def test_missing_header_in_production_needs_sign_in(keys: LocalKeys) -> None:
    res = TestClient(_app(keys, "production")).get("/_test/me")
    assert res.status_code == 401
    assert res.json()["error"]["code"] == "sign_in_required"
    assert res.json()["error"]["title"] == "Please sign in"


@pytest.mark.parametrize("environment", ["development", "test"])
def test_missing_header_in_dev_is_the_dev_owner(keys: LocalKeys, environment: str) -> None:
    res = TestClient(_app(keys, environment)).get("/_test/me")
    assert res.status_code == 200
    assert res.json() == {"id": DEV_OWNER_ID, "email": None, "is_admin": False}


def test_admin_email_is_admin(keys: LocalKeys) -> None:
    client = TestClient(_app(keys))
    res = client.get("/_test/admin", headers=_bearer(keys.token("boss", "Boss@SpecDesk.test")))
    assert res.status_code == 200
    assert res.json() == {"id": "boss"}


def test_non_admin_gets_a_humanized_403(keys: LocalKeys) -> None:
    client = TestClient(_app(keys))
    res = client.get("/_test/admin", headers=_bearer(keys.token("user-a", "a@example.com")))
    assert res.status_code == 403
    assert res.json()["error"]["code"] == "admin_only"
    assert res.json()["error"]["title"] == "Admins only"


# --- ownership over the real chats API (needs the dev database) ---


@pytest.fixture
def db_ready() -> None:
    try:
        with get_engine().connect() as conn:
            conn.execute(text("select 1"))
    except Exception:  # no DB configured or reachable
        pytest.skip("dev database not reachable")


@pytest.fixture
def chats_client(db_ready: None, keys: LocalKeys) -> Iterator[TestClient]:
    app = _app(keys)
    saver = InMemorySaver()
    app.dependency_overrides[get_checkpointer] = lambda: saver
    yield TestClient(app)
    with session_scope() as s:
        for chat in s.query(Chat).filter(Chat.owner_id.in_(["auth-test-a", "auth-test-b"])):
            s.delete(chat)


def test_user_cannot_read_another_users_chat(chats_client: TestClient, keys: LocalKeys) -> None:
    as_a = _bearer(keys.token("auth-test-a", "a@example.com"))
    as_b = _bearer(keys.token("auth-test-b", "b@example.com"))

    created = chats_client.post(
        "/api/v1/chats", json={"idea": "A booking app for physiotherapists"}, headers=as_a
    )
    assert created.status_code == 201
    chat_id = uuid.UUID(created.json()["id"])

    assert chats_client.get(f"/api/v1/chats/{chat_id}", headers=as_a).status_code == 200

    other = chats_client.get(f"/api/v1/chats/{chat_id}", headers=as_b)
    assert other.status_code == 404
    assert other.json()["error"]["code"] == "not_found"
    assert all(
        c["id"] != str(chat_id) for c in chats_client.get("/api/v1/chats", headers=as_b).json()
    )
