"""API schemas for the non-predictive regional reference endpoints."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class RegionalEstimateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    farm_area: float | None = Field(default=None, gt=0)
    area_unit: Literal["hectare", "acre"] | None = None

    @model_validator(mode="after")
    def require_unit_for_area(self) -> "RegionalEstimateRequest":
        if self.farm_area is not None and self.area_unit is None:
            raise ValueError("area_unit is required when farm_area is provided.")
        return self


class RegionalReference(BaseModel):
    geography: str
    reporting_period: str
    yield_kg_per_hectare: float
    statistic_label: str
    source_file: str
    source_url: str
    source_page: int
    table_title: str


class RegionalEstimateResponse(BaseModel):
    reference: RegionalReference
    estimate_available: bool
    farm_area: float | None = None
    farm_area_unit: str | None = None
    area_hectares: float | None = None
    illustrative_production_tonnes: float | None = None
    estimate_label: str
    limitations: list[str]
