"""Every error leaves the API in the humanized shape — never a stack trace."""

import re
from typing import cast

from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import BaseModel

from app.core.errors import AppError, install_error_handlers
from app.main import create_app


def _error(body: object) -> dict[str, str]:
    """Assert the exact humanized shape and return the inner error."""
    assert isinstance(body, dict)
    payload = cast(dict[str, object], body)
    assert set(payload) == {"error"}
    err = payload["error"]
    assert isinstance(err, dict)
    fields = cast(dict[str, object], err)
    assert set(fields) == {"code", "title", "message", "action"}
    assert all(isinstance(v, str) and v for v in fields.values())
    return cast(dict[str, str], fields)


def _app_with_failing_routes() -> FastAPI:
    app = FastAPI()
    install_error_handlers(app)

    class Body(BaseModel):
        idea: str

    @app.get("/boom")
    def boom() -> None:
        raise RuntimeError("secret internal detail")

    @app.get("/forbidden")
    def forbidden() -> None:
        raise AppError("forbidden", status_code=403)

    @app.get("/custom")
    def custom() -> None:
        raise AppError(
            "rate_limited", status_code=429, message="You've started 5 plans in a minute."
        )

    @app.post("/echo")
    def echo(body: Body) -> Body:
        return body

    return app


client = TestClient(_app_with_failing_routes(), raise_server_exceptions=False)


def test_unknown_route_is_humanized_404() -> None:
    res = TestClient(create_app()).get("/api/v1/nope")
    assert res.status_code == 404
    assert _error(res.json())["code"] == "not_found"


def test_unhandled_exception_is_generic_500_without_details() -> None:
    res = client.get("/boom")
    assert res.status_code == 500
    err = _error(res.json())
    assert err["code"] == "internal"
    assert err["title"] == "Something went wrong on our side"
    assert "secret" not in res.text
    assert "Traceback" not in res.text


def test_unhandled_error_gives_a_short_reference_for_support() -> None:
    first = client.get("/boom").json()["error"]["action"]
    second = client.get("/boom").json()["error"]["action"]
    assert re.search(r"reference [0-9a-f]{8}\.$", first)
    assert first != second  # one reference per failure, never accumulated
    assert first.count("reference") == 1


def test_known_code_uses_shared_wording() -> None:
    res = client.get("/forbidden")
    assert res.status_code == 403
    assert _error(res.json()) == {
        "code": "forbidden",
        "title": "This plan belongs to someone else",
        "message": "You can only open plans you created or that were shared with you.",
        "action": "Ask the owner for a share link.",
    }


def test_message_can_be_overridden_per_raise() -> None:
    err = _error(client.get("/custom").json())
    assert err["title"] == "Slow down a little"
    assert err["message"] == "You've started 5 plans in a minute."


def test_validation_error_is_humanized_422_naming_the_field() -> None:
    res = client.post("/echo", json={})
    assert res.status_code == 422
    err = _error(res.json())
    assert err["code"] == "invalid_input"
    assert "idea" in err["message"]


def test_malformed_json_is_humanized_422() -> None:
    res = client.post("/echo", content=b"{not json", headers={"content-type": "application/json"})
    assert res.status_code == 422
    assert _error(res.json())["code"] == "invalid_input"


def test_method_not_allowed_is_humanized() -> None:
    res = client.delete("/boom")
    assert res.status_code == 405
    assert _error(res.json())["code"] == "method_not_allowed"
