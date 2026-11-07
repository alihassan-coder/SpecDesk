"""Who is making the request.

Until M3 (Better Auth + JWT) there is no sign-in, so development and test use a fixed owner and
every other environment refuses. Replace `current_owner` with JWT verification in M3 — routes
already depend on it, so nothing else changes.
"""

from typing import Annotated

from fastapi import Depends

from app.core.config import Settings, get_settings
from app.core.errors import AppError

DEV_OWNER_ID = "dev-founder"


def current_owner(settings: Annotated[Settings, Depends(get_settings)]) -> str:
    if settings.environment in ("development", "test"):
        return DEV_OWNER_ID
    raise AppError(
        "sign_in_required",
        status_code=401,
        title="Please sign in",
        message="You need to be signed in to plan an app.",
        action="Sign in with your email and try again.",
    )


Owner = Annotated[str, Depends(current_owner)]
