"""SpecDesk API entrypoint. No startup work (migrations are a deploy step): serverless-safe."""

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.core.errors import ErrorBody, install_error_handlers
from app.routers import admin, chats, health, plans, pricing

API_PREFIX = "/api/v1"


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="SpecDesk API",
        version="0.2.0",
        openapi_url=f"{API_PREFIX}/openapi.json",
        docs_url=f"{API_PREFIX}/docs",
        redoc_url=None,
        responses={
            "4XX": {"model": ErrorBody, "description": "Humanized error"},
            "5XX": {"model": ErrorBody, "description": "Humanized error"},
        },
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    install_error_handlers(app)

    api = APIRouter(prefix=API_PREFIX)
    api.include_router(health.router)
    api.include_router(pricing.router)
    api.include_router(chats.router)
    api.include_router(plans.router)
    api.include_router(admin.router)
    app.include_router(api)
    return app


app = create_app()
