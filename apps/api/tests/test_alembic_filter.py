"""Autogenerate must never touch tables owned by Better Auth or Mem0."""

import pytest
from sqlalchemy import Column, Index, Integer, MetaData, Table

from app.db.ownership import include_object


def _table(name: str) -> Table:
    return Table(name, MetaData(), Column("id", Integer, primary_key=True))


@pytest.mark.parametrize("name", ["user", "session", "account", "verification", "jwks", "mem0"])
def test_foreign_tables_and_their_indexes_are_excluded(name: str) -> None:
    table = _table(name)
    index = Index(f"ix_{name}_id", table.c.id)
    assert not include_object(table, name, "table", True, None)
    assert not include_object(index, index.name, "index", True, None)
    assert not include_object(table.c.id, "id", "column", True, None)


@pytest.mark.parametrize("name", ["chat", "plan_version", "user_settings"])
def test_app_tables_are_included(name: str) -> None:
    assert include_object(_table(name), name, "table", False, None)
