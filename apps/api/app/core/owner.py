"""Who is making the request.

The website (apps/web) signs people in with Better Auth and calls this API through its
`/api/v1/*` proxy with `Authorization: Bearer <jwt>`. The JWT is minted by Better Auth's jwt
plugin and verified here against its JWKS (EdDSA / Ed25519 by default). `sub` is the user id
and every resource's `owner_id`.

Without a bearer header, development and test fall back to a fixed dev owner so the API can be
used on its own (curl, tests); every other environment refuses.
"""

from dataclasses import dataclass
from functools import lru_cache
from typing import Annotated, Any, Protocol

import jwt
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import Settings, get_settings
from app.core.errors import AppError

DEV_OWNER_ID = "dev-founder"

# Asymmetric algorithms Better Auth's jwt plugin can be configured with. Never HS*/none.
ALLOWED_ALGORITHMS = frozenset({"EdDSA", "ES256", "ES512", "RS256", "PS256"})


@dataclass(frozen=True)
class AuthUser:
    id: str
    email: str | None
    is_admin: bool


class SigningKeySource(Protocol):
    """What we need from `jwt.PyJWKClient` (tests swap in a local key)."""

    def get_signing_key_from_jwt(self, token: str) -> jwt.PyJWK: ...


@lru_cache
def _jwks_client(url: str) -> jwt.PyJWKClient:
    # Caches the key set for 5 minutes; an unknown `kid` triggers one refetch (key rotation).
    return jwt.PyJWKClient(url, cache_keys=True, lifespan=300, timeout=5)


def get_jwks_client(settings: Annotated[Settings, Depends(get_settings)]) -> SigningKeySource:
    return _jwks_client(settings.auth_jwks_url)


_bearer = HTTPBearer(auto_error=False, description="Better Auth JWT")


def _sign_in_required() -> AppError:
    return AppError("sign_in_required", status_code=401)


def _session_expired() -> AppError:
    return AppError("session_expired", status_code=401)


def _verify(token: str, keys: SigningKeySource, settings: Settings) -> dict[str, Any]:
    try:
        signing_key = keys.get_signing_key_from_jwt(token)
    except jwt.PyJWKClientConnectionError as exc:
        raise AppError("auth_unavailable", status_code=503) from exc
    except jwt.PyJWTError as exc:  # malformed token, unknown kid, unusable key
        raise _session_expired() from exc

    if signing_key.algorithm_name not in ALLOWED_ALGORITHMS:
        raise _session_expired()
    try:
        return jwt.decode(
            token,
            signing_key,
            algorithms=[signing_key.algorithm_name],
            audience=settings.auth_audience,
            issuer=settings.auth_issuer,
            options={"require": ["exp", "iat", "sub", "iss", "aud"]},
        )
    except jwt.PyJWTError as exc:  # expired, wrong issuer/audience, bad signature
        raise _session_expired() from exc


def current_user(
    settings: Annotated[Settings, Depends(get_settings)],
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
    keys: Annotated[SigningKeySource, Depends(get_jwks_client)],
) -> AuthUser:
    if credentials is None:
        if settings.environment in ("development", "test"):
            return AuthUser(id=DEV_OWNER_ID, email=None, is_admin=False)
        raise _sign_in_required()

    claims = _verify(credentials.credentials, keys, settings)
    sub = claims.get("sub")
    if not isinstance(sub, str) or not sub:
        raise _session_expired()
    email = claims.get("email")
    email = email if isinstance(email, str) and email else None
    return AuthUser(id=sub, email=email, is_admin=email is not None and settings.is_admin(email))


CurrentUser = Annotated[AuthUser, Depends(current_user)]


def current_owner(user: CurrentUser) -> str:
    return user.id


Owner = Annotated[str, Depends(current_owner)]


def require_admin(user: CurrentUser) -> AuthUser:
    if not user.is_admin:
        raise AppError("admin_only", status_code=403)
    return user


AdminUser = Annotated[AuthUser, Depends(require_admin)]
