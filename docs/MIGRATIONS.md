# Database migrations (Alembic + Neon)

## Who owns which tables
- **Better Auth** owns `user`, `session`, `account`, `verification`, `jwks`. It creates them with its own CLI
  (`pnpm dlx @better-auth/cli migrate`). Alembic **never** touches them.
- **Alembic** (in `apps/api`) owns every app table in [DATA_MODEL.md](DATA_MODEL.md).
- **Mem0** manages its own vector table(s) in pgvector. Alembic only runs `CREATE EXTENSION IF NOT EXISTS vector` (added with the M4 Mem0 migration, not in the initial one).

## Connections
| Env var | Use |
|---|---|
| `DATABASE_URL` | Pooled Neon URL (`-pooler` host). The running app uses this. |
| `DATABASE_URL_UNPOOLED` | Direct Neon URL. **Alembic uses this** — DDL and advisory locks need a direct connection. |

Driver: SQLAlchemy 2 with **psycopg 3** (`postgresql+psycopg://`). It understands Neon's `sslmode` and `channel_binding` params as-is.

## Rules
1. All schema changes go through Alembic. Never change tables by hand in the Neon console.
2. `env.py` imports the SQLAlchemy `Base.metadata` and an `include_object` filter that skips Better Auth and Mem0 tables, so autogenerate never tries to drop them.
3. A `MetaData(naming_convention=…)` gives every index and constraint a stable name, so migrations are reproducible.
4. Autogenerate, then **read and edit** the file: `uv run alembic revision --autogenerate -m "add plan_version"`. Autogenerate misses renames, server defaults and data changes.
5. Each migration has a working `downgrade()`.
6. Never edit a migration that has run on a shared database. Add a new one instead.
7. Big or risky changes follow expand → migrate data → contract, spread over separate deploys.
8. Migrations run as a **deploy step** (`uv run alembic upgrade head`), never on app startup. On Vercel this is a build command for the API project; in CI it runs against a **Neon branch** created per pull request.
9. `uv run alembic check` in CI fails the build if the models and migrations have drifted apart.

## Commands (from `apps/api`, available from M2)
```bash
uv run alembic upgrade head          # apply
uv run alembic downgrade -1          # roll back one
uv run alembic revision --autogenerate -m "message"
uv run alembic history --verbose
uv run alembic check                 # drift check
```
