"""Share links: owner turns them on/off; anyone with the token reads the plan without auth.

Needs the dev database (skipped otherwise). Reuses the fake-model plan setup from the plans test.
"""

import uuid
from typing import cast

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.core.owner import current_owner, current_user

from .agents.sse import parse_events
from .agents.test_plans_api import Api, _new_chat  # pyright: ignore[reportPrivateUsage]
from .agents.test_plans_api import api as api  # noqa: F401  (fixture)
from .agents.test_plans_api import db_ready as db_ready  # noqa: F401  (fixture)


def _make_plan(client: TestClient, created: list[uuid.UUID]) -> str:
    chat_id = _new_chat(client, created)
    client.post(f"/api/v1/chats/{chat_id}/interview")
    return str(parse_events(client.post(f"/api/v1/chats/{chat_id}/plan").text)[-1][1]["planId"])


def _public(client: TestClient) -> TestClient:
    """A client where any authenticated call would fail: proves the share routes need no auth."""

    def no_user() -> None:
        raise AssertionError("public share routes must not resolve a user")

    cast(FastAPI, client.app).dependency_overrides[current_user] = no_user
    return client


def test_owner_shares_and_anyone_reads(api: Api) -> None:
    client, _, created = api
    plan_id = _make_plan(client, created)

    first = client.post(f"/api/v1/plans/{plan_id}/share")
    assert first.status_code == 200
    token = first.json()["token"]
    assert len(token) >= 32
    assert first.json()["path"] == f"/share/{token}"
    assert client.post(f"/api/v1/plans/{plan_id}/share").json()["token"] == token  # stable

    public = _public(client)
    res = public.get(f"/api/v1/share/{token}")
    assert res.status_code == 200
    plan = res.json()
    assert plan["id"] == plan_id
    assert plan["title"] == "PhysioFlow"
    assert "chatId" not in plan
    assert all(f["id"] for f in plan["files"])

    spec = public.get(f"/api/v1/share/{token}/files/spec.md")
    assert spec.status_code == 200
    assert spec.headers["content-type"].startswith("text/markdown")
    assert "attachment" in spec.headers["content-disposition"]
    assert "# PhysioFlow" in spec.text
    assert public.get(f"/api/v1/share/{token}/files/secrets.txt").status_code == 404


def test_revoke_kills_the_link(api: Api) -> None:
    client, _, created = api
    plan_id = _make_plan(client, created)
    token = client.post(f"/api/v1/plans/{plan_id}/share").json()["token"]

    res = client.delete(f"/api/v1/plans/{plan_id}/share")
    assert res.status_code == 200
    assert res.json() == {"token": None}
    gone = client.get(f"/api/v1/share/{token}")
    assert gone.status_code == 404
    assert gone.json()["error"]["code"] == "share_not_found"
    assert client.get(f"/api/v1/share/{token}/files/spec.md").status_code == 404
    # Sharing again gives a new token; the old one stays dead.
    assert client.post(f"/api/v1/plans/{plan_id}/share").json()["token"] != token


def test_other_user_cannot_share_or_revoke(api: Api) -> None:
    client, _, created = api
    plan_id = _make_plan(client, created)
    token = client.post(f"/api/v1/plans/{plan_id}/share").json()["token"]

    cast(FastAPI, client.app).dependency_overrides[current_owner] = lambda: "someone-else"
    assert client.post(f"/api/v1/plans/{plan_id}/share").status_code == 404
    assert client.delete(f"/api/v1/plans/{plan_id}/share").status_code == 404
    assert client.get(f"/api/v1/share/{token}").status_code == 200  # still shared


def test_unknown_token_is_a_humanized_404(api: Api) -> None:
    client, _, _ = api
    res = _public(client).get("/api/v1/share/not-a-real-token")
    assert res.status_code == 404
    error = res.json()["error"]
    assert error["code"] == "share_not_found"
    assert error["title"] and error["action"]
