"""Which tables Alembic owns. Used as `include_object` in migrations/env.py."""

from typing import Literal

from sqlalchemy.schema import SchemaItem

# Owned by Better Auth (apps/web) — Alembic must never create, alter or drop them.
BETTER_AUTH_TABLES = frozenset({"user", "session", "account", "verification", "jwks"})
# LangGraph's Postgres checkpointer owns these.
# Created by `python -m app.agents.runtime.checkpointer setup`.
LANGGRAPH_TABLES = frozenset(
    {"checkpoints", "checkpoint_blobs", "checkpoint_writes", "checkpoint_migrations"}
)
# Mem0 manages its own pgvector tables (M4).
FOREIGN_TABLE_PREFIXES = ("mem0",)

ObjectType = Literal[
    "schema",
    "table",
    "column",
    "index",
    "unique_constraint",
    "foreign_key_constraint",
    "check_constraint",
]


def is_foreign_table(name: str | None) -> bool:
    if name is None:
        return False
    return (
        name in BETTER_AUTH_TABLES
        or name in LANGGRAPH_TABLES
        or name.startswith(FOREIGN_TABLE_PREFIXES)
    )


def include_object(
    obj: SchemaItem,
    name: str | None,
    type_: ObjectType,
    reflected: bool,
    compare_to: SchemaItem | None,
) -> bool:
    if type_ == "table":
        return not is_foreign_table(name)
    table_name: str | None = getattr(getattr(obj, "table", None), "name", None)
    return not is_foreign_table(table_name)
