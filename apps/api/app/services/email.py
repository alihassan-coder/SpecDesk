"""Transactional email through Brevo's API. Best effort: never raises into the caller.

No `BREVO_API_KEY` (local dev, tests) means the email is skipped with an info log.
Failures are logged with the status code only — never the key or the message body.
"""

import logging
from html import escape

import httpx

from app.core.config import Settings, get_settings

log = logging.getLogger(__name__)

BREVO_URL = "https://api.brevo.com/v3/smtp/email"
TIMEOUT_SECONDS = 10.0


def plan_ready_payload(
    settings: Settings, to: str, title: str, plan_url: str, price_range: str, weeks: int
) -> dict[str, object]:
    book_url = f"{settings.web_url.rstrip('/')}/book"
    week_word = "week" if weeks == 1 else "weeks"
    subject = f"Your plan is ready: {title}"
    text = (
        f"Your plan for {title} is ready.\n\n"
        f"Estimated price: {price_range}\n"
        f"Estimated time: {weeks} {week_word}\n\n"
        f"Open your plan: {plan_url}\n\n"
        f"Want us to build it? Book a free call: {book_url}\n"
    )
    t, u, b = escape(title), escape(plan_url, quote=True), escape(book_url, quote=True)
    html = f"""<div style="font-family:system-ui,sans-serif;max-width:480px;line-height:1.5">
<h2 style="margin:0 0 12px">Your plan for {t} is ready</h2>
<p style="margin:0">Estimated price: <strong>{escape(price_range)}</strong></p>
<p style="margin:0 0 20px">Estimated time: <strong>{weeks} {week_word}</strong></p>
<p><a href="{u}" style="display:inline-block;padding:10px 18px;border-radius:8px;
background:#2563eb;color:#fff;text-decoration:none">Open your plan</a></p>
<p style="margin-top:24px">Want us to build it? <a href="{b}">Book a free call</a></p>
</div>"""
    return {
        "sender": {"name": settings.email_from_name, "email": settings.email_from_address},
        "to": [{"email": to}],
        "subject": subject,
        "htmlContent": html,
        "textContent": text,
    }


def send_plan_ready(
    to: str,
    title: str,
    plan_url: str,
    price_range: str,
    weeks: int,
    *,
    settings: Settings | None = None,
) -> None:
    """Email the founder that their plan is ready. Silently skipped when email isn't set up."""
    s = settings or get_settings()
    if s.brevo_api_key is None or not s.brevo_api_key.get_secret_value():
        log.info("plan-ready email skipped: BREVO_API_KEY is not set")
        return
    if not s.email_from_address:
        log.info("plan-ready email skipped: EMAIL_FROM_ADDRESS is not set")
        return
    try:
        res = httpx.post(
            BREVO_URL,
            json=plan_ready_payload(s, to, title, plan_url, price_range, weeks),
            headers={"api-key": s.brevo_api_key.get_secret_value(), "accept": "application/json"},
            timeout=TIMEOUT_SECONDS,
        )
    except httpx.HTTPError as exc:
        log.warning("plan-ready email failed: %s", type(exc).__name__)
        return
    except Exception:  # never break the caller over an email
        log.warning("plan-ready email failed: unexpected error")
        return
    if res.status_code >= 400:
        log.warning("plan-ready email failed: Brevo returned %s", res.status_code)
