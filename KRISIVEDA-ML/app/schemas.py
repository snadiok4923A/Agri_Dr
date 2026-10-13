"""Validated API contracts for the Krisiveda yield service."""

from datetime import date
from enum import Enum
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field


class AreaUnit(str, Enum):
    acre = "acre"
    hectare = "hectare"
    bigha = "bigha"
    katha = "katha"
    decimal = "decimal"


class WeatherData(BaseModel):
    """Optional observations from the existing Open-Meteo integration."""

    model_config = ConfigDict(extra="forbid")

    temperature_c: float | None = Field(default=None, ge=-90, le=70)
    humidity_pct: float | None = Field(default=None, ge=0, le=100)
    precipitation_mm: float | None = Field(default=None, ge=0)
    rain_probability_pct: float | None = Field(default=None, ge=0, le=100)
    wind_speed_kmh: float | None = Field(default=None, ge=0)


class InputHistory(BaseModel):
    """A user-provided fertilizer or medicine event."""

    model_config = ConfigDict(extra="forbid")

    product: Annotated[str, Field(min_length=1, max_length=200)]
    applied_on: date | None = None
    quantity: float | None = Field(default=None, ge=0)
    unit: Annotated[str, Field(min_length=1, max_length=40)] | None = None


class YieldPredictionRequest(BaseModel):
    """Farm features accepted by the prediction endpoint.

    Optional values remain ``None`` when the caller does not know them. The
    service never replaces missing values with a guessed farm measurement.
    """

    model_config = ConfigDict(extra="forbid")

    farm_area: float | None = Field(default=None, gt=0)
    area_unit: AreaUnit | None = None
    crop: Annotated[str, Field(min_length=1, max_length=100)] | None = None
    rice_variety: Annotated[str, Field(min_length=1, max_length=100)] | None = None
    growth_stage: Annotated[str, Field(min_length=1, max_length=100)] | None = None
    weather: WeatherData | None = None
    fertilizer_history: list[InputHistory] | None = None
    medicine_history: list[InputHistory] | None = None


class ModelMode(str, Enum):
    trained_model = "trained_model"
    baseline = "baseline"
    unavailable = "unavailable"


class ModelStatus(BaseModel):
    mode: ModelMode
    trained_model_available: bool
    verified_baseline_available: bool
    message: str


class YieldPredictionResponse(BaseModel):
    mode: ModelMode
    prediction_source: str
    model_status: ModelStatus
    prediction: float | None = None
    prediction_unit: Literal["tonnes_per_hectare"] | None = None
    total_production: float | None = None
    total_production_unit: Literal["tonnes"] | None = None
    weather_status: Literal["available", "unavailable"]
    available_features: list[str]
    missing_features: list[str]
    limitations: list[str]
