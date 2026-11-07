"""LangGraph's Postgres checkpointer on Neon.

The checkpointer owns its own tables (see `LANGGRAPH_TABLES` in app/db/ownership.py — Alembic
ignores them). Create them once per database, as a deploy step:

    uv run python -m app.agents.runtime.checkpointer setup
"""

import sys
from functools import lru_cache

from langgraph.checkpoint.postgres import PostgresSaver
from psycopg import Connection
from psycopg.rows import DictRow, dict_row
from psycopg_pool import ConnectionPool

from app.core.config import get_settings
from app.core.errors import AppError


def _plain_url(url: str) -> str:
    """psycopg wants `postgresql://`; our settings hold the SQLAlchemy form `postgresql+psycopg://`."""
    return url.replace("postgresql+psycopg://", "postgresql://", 1)


def _check_alive(conn: Connection[DictRow]) -> None:
    """Fail fast on a connection Neon has already closed, so the pool replaces it."""
    conn.execute("SELECT 1")


@lru_cache
def _pool() -> ConnectionPool[Connection[DictRow]]:
    url = get_settings().database_url
    if url is None:
        raise AppError(
            "database_unavailable",
            status_code=503,
            message="The server isn't connected to a database yet.",
        )
    # autocommit + dict rows are what PostgresSaver expects. prepare_threshold=None disables
    # server-side prepared statements, which Neon's pooled (PgBouncer) endpoint does not support.
    return ConnectionPool(
        conninfo=_plain_url(url),
        connection_class=Connection[DictRow],
        min_size=0,
        max_size=5,
        kwargs={"autocommit": True, "prepare_threshold": None, "row_factory": dict_row},
        # Neon closes idle connections: test each one before use and recycle idle ones.
        check=_check_alive,
        max_idle=300,
        open=True,
    )


def get_checkpointer() -> PostgresSaver:
    """FastAPI dependency. Tests override it with an InMemorySaver."""
    return PostgresSaver(_pool())  # pyright: ignore[reportArgumentType]


def setup_tables() -> None:
    """Create or upgrade the checkpointer's tables. Uses the direct (unpooled) URL: it runs DDL."""
    settings = get_settings()
    url = settings.database_url_unpooled or settings.database_url
    if url is None:
        raise SystemExit("DATABASE_URL_UNPOOLED is not set.")
    with PostgresSaver.from_conn_string(_plain_url(url)) as saver:
        saver.setup()


if __name__ == "__main__":
    if sys.argv[1:] == ["setup"]:
        setup_tables()
        print("LangGraph checkpoint tables are ready.")
    else:
        raise SystemExit("usage: python -m app.agents.runtime.checkpointer setup")
