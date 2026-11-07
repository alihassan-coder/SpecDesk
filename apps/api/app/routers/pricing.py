from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

from app.services.pricing import (
    Complexity,
    FeatureInput,
    PricingEngine,
    load_pricing_config,
)

router = APIRouter(prefix="/pricing", tags=["pricing"])


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class FeatureIn(CamelModel):
    """Subset of the web `Feature` type; extra fields (name, moscow…) are ignored."""

    id: str | None = None
    complexity: Complexity
    hours: int | None = Field(default=None, ge=0, le=10_000)
    included: bool = True


class EstimateRequest(CamelModel):
    features: list[FeatureIn] = Field(max_length=500)
    hourly_rate: float | None = Field(default=None, gt=0, le=1_000)
    buffer: float | None = Field(default=None, ge=0, le=2)


class EstimateResponse(CamelModel):
    hours: int
    price_min: int
    price_max: int
    weeks: int
    currency: str


def get_pricing_engine() -> PricingEngine:
    return PricingEngine(load_pricing_config())


@router.post("/estimate", response_model_by_alias=True)
def estimate(
    body: EstimateRequest, engine: Annotated[PricingEngine, Depends(get_pricing_engine)]
) -> EstimateResponse:
    result = engine.estimate(
        [FeatureInput(f.complexity, f.hours, f.included) for f in body.features],
        hourly_rate=body.hourly_rate,
        buffer=body.buffer,
    )
    return EstimateResponse(
        hours=result.hours,
        price_min=result.price_min,
        price_max=result.price_max,
        weeks=result.weeks,
        currency=engine.config.currency,
    )
