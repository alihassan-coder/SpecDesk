"""Humanized errors. Every error response is `{"error": {code, title, message, action}}`.

Wording for shared codes matches apps/web/src/lib/errors.ts.
"""

import logging
from collections.abc import Sequence
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger("specdesk.errors")


class HumanError(BaseModel):
    code: str
    title: str
    message: str
    action: str


class ErrorBody(BaseModel):
    error: HumanError


_GENERIC = ("Something went wrong on our side", "It's not something you did.",
            "Try again. If it keeps happening, refresh the page.")  # fmt: skip

KNOWN: dict[str, tuple[str, str, str]] = {
    # --- shared with the web app ---
    "rate_limited": (
        "Slow down a little",
        "You've started several plans in a short time.",
        "Try again in about 30 seconds.",
    ),
    "model_unavailable": (
        "The planning model is busy",
        "Our AI provider didn't answer in time. Your answers are saved.",
        "Retry — we'll switch to a backup model automatically.",
    ),
    "not_software": (
        "SpecDesk plans software",
        "This idea doesn't have an app or website in it yet.",
        "Describe the app you'd build for it, and we'll plan that.",
    ),
    "not_found": (
        "This plan isn't here",
        "It may have been deleted, or the link is wrong.",
        "Go back to your plans.",
    ),
    "forbidden": (
        "This plan belongs to someone else",
        "You can only open plans you created or that were shared with you.",
        "Ask the owner for a share link.",
    ),
    # --- API-only ---
    "internal": _GENERIC,
    "method_not_allowed": (
        "That action isn't supported here",
        "This address doesn't accept that kind of request.",
        "Refresh the page and try again.",
    ),
    "unauthorized": (
        "Please sign in",
        "Your session has ended or you aren't signed in yet.",
        "Sign in with your email code, then try again.",
    ),
    "invalid_input": (
        "Some details need another look",
        "A few fields are missing or in the wrong format.",
        "Fix the highlighted fields and send again.",
    ),
    "database_unavailable": (
        "We can't reach our database",
        "Your work is safe, but we can't load or save anything right now.",
        "Wait a minute and try again.",
    ),
}

# A 404 from routing isn't necessarily a plan, so it gets neutral wording (same code).
_ROUTE_NOT_FOUND = {
    "title": "We couldn't find that",
    "message": "The address you asked for doesn't exist.",
    "action": "Check the link, or go back to your plans.",
}

_STATUS_CODES: dict[int, str] = {
    401: "unauthorized",
    403: "forbidden",
    404: "not_found",
    405: "method_not_allowed",
    422: "invalid_input",
    429: "rate_limited",
}


def humanize(
    code: str, *, title: str | None = None, message: str | None = None, action: str | None = None
) -> HumanError:
    d_title, d_message, d_action = KNOWN.get(code, _GENERIC)
    return HumanError(
        code=code, title=title or d_title, message=message or d_message, action=action or d_action
    )


class AppError(Exception):
    """Raise anywhere in the app; the handler turns it into the humanized body."""

    def __init__(
        self,
        code: str,
        *,
        status_code: int = 400,
        title: str | None = None,
        message: str | None = None,
        action: str | None = None,
    ) -> None:
        super().__init__(code)
        self.status_code = status_code
        self.error = humanize(code, title=title, message=message, action=action)


def error_response(status_code: int, error: HumanError) -> JSONResponse:
    return JSONResponse(status_code=status_code, content=ErrorBody(error=error).model_dump())


def _field_names(errors: Sequence[Any]) -> list[str]:
    names: list[str] = []
    for err in errors:
        loc = [str(p) for p in err.get("loc", ()) if p not in ("body", "query", "path", "header")]
        name = ".".join(loc)
        if name and name not in names:
            names.append(name)
    return names


def _validation_error(errors: Sequence[Any]) -> HumanError:
    if any(err.get("type") == "json_invalid" for err in errors):
        return humanize(
            "invalid_input",
            message="The request couldn't be read (it isn't valid JSON).",
            action="Refresh the page and try again.",
        )
    names = _field_names(errors)
    message = f"Please check: {', '.join(names)}." if names else None
    return humanize("invalid_input", message=message)


async def _app_error(_: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, AppError)
    return error_response(exc.status_code, exc.error)


async def _http_error(_: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, StarletteHTTPException)
    code = _STATUS_CODES.get(
        exc.status_code, "internal" if exc.status_code >= 500 else "bad_request"
    )
    overrides = _ROUTE_NOT_FOUND if exc.status_code == 404 else {}
    return error_response(exc.status_code, humanize(code, **overrides))


async def _validation(_: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, RequestValidationError)
    return error_response(422, _validation_error(exc.errors()))


async def _unhandled(request: Request, exc: Exception) -> JSONResponse:
    # Full detail goes to server logs only; the client gets the friendly generic message.
    logger.exception("Unhandled error on %s %s", request.method, request.url.path, exc_info=exc)
    return error_response(500, humanize("internal"))


def install_error_handlers(app: FastAPI) -> None:
    app.add_exception_handler(AppError, _app_error)
    app.add_exception_handler(StarletteHTTPException, _http_error)
    app.add_exception_handler(RequestValidationError, _validation)
    app.add_exception_handler(Exception, _unhandled)
