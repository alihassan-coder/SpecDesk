"""`send_plan_ready`: Brevo payload shape, and silence when email isn't configured."""

import logging
from typing import Any

import httpx
import pytest
from pydantic import SecretStr

from app.core.config import Settings
from app.services import email

Call = dict[str, Any]


def _settings(key: str | None = "test-key") -> Settings:
    return Settings(
        _env_file=None,  # pyright: ignore[reportCallIssue]
        brevo_api_key=SecretStr(key) if key is not None else None,
        email_from_address="hello@specdesk.test",
        email_from_name="SpecDesk",
        web_url="https://specdesk.test/",
    )


@pytest.fixture
def calls(monkeypatch: pytest.MonkeyPatch) -> list[Call]:
    recorded: list[Call] = []

    def fake_post(url: str, **kwargs: Any) -> httpx.Response:
        recorded.append({"url": url, **kwargs})
        return httpx.Response(201, json={"messageId": "x"})

    monkeypatch.setattr(email.httpx, "post", fake_post)
    return recorded


def _send(settings: Settings) -> None:
    email.send_plan_ready(
        "founder@example.com",
        "PhysioFlow",
        "https://specdesk.test/plan/123",
        "$12,000 – $18,000",
        8,
        settings=settings,
    )


def test_sends_brevo_payload(calls: list[Call]) -> None:
    _send(_settings())
    assert len(calls) == 1
    call = calls[0]
    assert call["url"] == "https://api.brevo.com/v3/smtp/email"
    assert call["headers"]["api-key"] == "test-key"
    body = call["json"]
    assert body["sender"] == {"name": "SpecDesk", "email": "hello@specdesk.test"}
    assert body["to"] == [{"email": "founder@example.com"}]
    assert "PhysioFlow" in body["subject"]
    for part in ("htmlContent", "textContent"):
        assert "$12,000 – $18,000" in body[part]
        assert "8 weeks" in body[part]
        assert "https://specdesk.test/plan/123" in body[part]
        assert "https://specdesk.test/book" in body[part]
    assert "Open your plan" in body["htmlContent"]
    assert "Book a free call" in body["htmlContent"]


def test_missing_key_is_a_silent_no_op(calls: list[Call], caplog: pytest.LogCaptureFixture) -> None:
    with caplog.at_level(logging.INFO, logger="app.services.email"):
        _send(_settings(key=None))
    assert calls == []
    assert "skipped" in caplog.text


def test_failures_never_raise_or_log_the_key(
    monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    def failing(url: str, **kwargs: Any) -> httpx.Response:
        return httpx.Response(401, json={"message": "bad key test-key"})

    monkeypatch.setattr(email.httpx, "post", failing)
    with caplog.at_level(logging.INFO, logger="app.services.email"):
        _send(_settings())
    assert "401" in caplog.text
    assert "test-key" not in caplog.text

    def boom(url: str, **kwargs: Any) -> httpx.Response:
        raise httpx.ConnectError("down")

    monkeypatch.setattr(email.httpx, "post", boom)
    _send(_settings())  # does not raise
