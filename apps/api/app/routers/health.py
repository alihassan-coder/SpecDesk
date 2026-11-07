from typing import Annotated, Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import Engine, text
from sqlalchemy.exc import SQLAlchemyError

from app.core.errors import AppError
from app.db.session import get_engine

router = APIRouter(prefix="/health", tags=["health"])


class HealthStatus(BaseModel):
    status: Literal["ok"]


@router.get("")
def health() -> HealthStatus:
    return HealthStatus(status="ok")


@router.get("/db")
def health_db(engine: Annotated[Engine, Depends(get_engine)]) -> HealthStatus:
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except SQLAlchemyError as exc:
        raise AppError("database_unavailable", status_code=503) from exc
    return HealthStatus(status="ok")
