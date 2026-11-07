"""Alembic env. Uses the DIRECT Neon URL (DDL + advisory locks need it), never the pooler."""

from logging.config import fileConfig

from alembic import context
from sqlalchemy import create_engine, pool

from app.core.config import Settings
from app.db import Base
from app.db.ownership import include_object

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def _url() -> str:
    url = Settings().database_url_unpooled
    if url is None:
        raise RuntimeError("DATABASE_URL_UNPOOLED is not set (apps/api/.env).")
    return url


def _configure(**kwargs: object) -> None:
    context.configure(
        target_metadata=target_metadata,
        include_object=include_object,
        compare_type=True,
        compare_server_default=True,
        **kwargs,  # pyright: ignore[reportArgumentType]
    )


def run_migrations_offline() -> None:
    _configure(url=_url(), literal_binds=True, dialect_opts={"paramstyle": "named"})
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    engine = create_engine(_url(), poolclass=pool.NullPool)
    with engine.connect() as connection:
        _configure(connection=connection)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
