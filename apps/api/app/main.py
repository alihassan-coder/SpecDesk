"""SpecDesk API entrypoint. Real routers arrive in M2+ (see docs/API.md)."""

from fastapi import FastAPI

app = FastAPI(title="SpecDesk API", version="0.1.0")


@app.get("/api/v1/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
