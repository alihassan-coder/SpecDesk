"""Engine + session helpers. The running app uses the pooled Neon URL (`DATABASE_URL`)."""

from collections.abc import Generator, Iterator
from contextlib import contextmanager
from functools import lru_cache

from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings
from app.core.errors import AppError


@lru_cache
def get_engine() -> Engine:
    url = get_settings().database_url
    if url is None:
        raise AppError(
            "database_unavailable",
            status_code=503,
            message="The server isn't connected to a database yet.",
        )
    # Small pool + pre-ping: serverless instances are short-lived and Neon's pooler
    # (PgBouncer) closes idle connections.
    return create_engine(
        url,
        pool_pre_ping=True,
        pool_size=5,
        max_overflow=5,
        pool_recycle=300,
        connect_args={"connect_timeout": 10},
    )


@lru_cache
def _session_factory() -> sessionmaker[Session]:
    return sessionmaker(bind=get_engine(), expire_on_commit=False)


def get_session() -> Iterator[Session]:
    """FastAPI dependency: one session per request, rolled back on error."""
    with _session_factory()() as session:
        try:
            yield session
        except Exception:
            session.rollback()
            raise


@contextmanager
def session_scope() -> Generator[Session]:
    """A short-lived session that commits on success. Use inside streams and background work,
    where the request's own session may already be closed."""
    with _session_factory()() as session:
        try:
            yield session
            session.commit()
        except Exception:
            session.rollback()
            raise
