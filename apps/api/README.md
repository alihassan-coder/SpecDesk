# SpecDesk API (FastAPI)

Starts in milestone M2. Setup (official uv commands):

```bash
cd apps/api
uv sync
uv add fastapi "uvicorn[standard]" pydantic-settings
uv run uvicorn app.main:app --reload --port 8000
```

Folders: `app/core` (config, security), `app/routers` (HTTP), `app/agents` (pipeline steps),
`app/services` (pricing, files, memory, email), `tests/` (pytest, TDD).
