# SpecDesk API (FastAPI)

Python 3.12 (pinned in `.python-version`), managed with **uv**. All commands run from `apps/api`.

## Setup
```bash
cd apps/api
uv sync                       # creates .venv from uv.lock (add --offline if everything is cached)
```
Secrets live in `apps/api/.env` (gitignored). Variables: see the repo-root `.env.example`
(`DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `ADMIN_EMAILS`, `CORS_ORIGINS`, `ENVIRONMENT`,
`SECRETS_ENCRYPTION_KEY`). Plain `postgresql://` Neon URLs are converted to `postgresql+psycopg://`.

## Run
```bash
uv run uvicorn app.main:app --reload --port 8000   # or `pnpm dev:api` from the repo root
# http://localhost:8000/api/v1/health      liveness
# http://localhost:8000/api/v1/health/db   runs SELECT 1 against Neon
# http://localhost:8000/api/v1/docs        Swagger UI (OpenAPI JSON at /api/v1/openapi.json)
```

## Database migrations (Alembic — see docs/MIGRATIONS.md)
Alembic uses `DATABASE_URL_UNPOOLED` (direct Neon host); the app uses the pooled `DATABASE_URL`.
```bash
uv run alembic upgrade head                          # apply (deploy step, never on app startup)
uv run alembic revision --autogenerate -m "message"  # then READ and edit the file
uv run alembic check                                 # fails if models and migrations drift
uv run alembic history --verbose
uv run alembic downgrade -1                          # local / Neon branch only
```

## AI agents (see app/agents/README.md and docs/AGENTS.md)

```bash
# once per database (deploy step): LangGraph checkpoint tables
uv run python -m app.agents.runtime.checkpointer setup

# put a provider key in apps/api/.env (or save it in Admin → API keys)
#   ANTHROPIC_API_KEY=sk-ant-...

# optional: one real round against the model (costs a few cents)
SPECDESK_LIVE_TESTS=1 uv run pytest tests/agents/test_live_interviewer.py -s
```

Endpoints: `POST /api/v1/chats` → `POST /api/v1/chats/{id}/interview` (SSE) →
`POST /api/v1/chats/{id}/answers` (SSE) · `GET /api/v1/chats/{id}`.
Until M3 there is no sign-in: development and test use a fixed dev owner; other environments refuse.

## Quality gates
```bash
uv run ruff check .
uv run ruff format --check .
uv run pyright
uv run pytest                  # DB tests skip automatically when no database is reachable
```

## Layout
- `app/core` — `config.py` (typed settings), `errors.py` (humanized error shape + handlers)
- `app/db` — `base.py` (naming convention, mixins), `models.py` (app tables), `session.py` (engine/session deps)
- `app/routers` — HTTP routes under `/api/v1` (`health`, `pricing`)
- `app/services` — `pricing.py` (rule-based engine over `pricing.yaml`)
- `migrations/` — Alembic env + versions
- `tests/` — pytest
