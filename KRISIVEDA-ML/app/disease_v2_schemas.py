"""Validated API contracts for the 15-class ``/disease/v2`` endpoints.

The response deliberately keeps two v1 field names - ``disease`` and
``top_predictions[].disease`` - so the existing React analysis modal renders
15-class results without component changes. ``class_id`` is the canonical
machine value; ``display_name``/``disease`` are the human string.
"""

from enum import Enum

from pydantic import BaseModel, ConfigDict, Field


class DiseaseV2ResultStatus(str, Enum):
    ok = "ok"
    uncertain = "uncertain"


class DiseaseV2Category(str, Enum):
    """The 15 classes mix pathogens, insect damage and healthy leaves."""

    disease = "disease"
    pest = "pest"
    healthy = "healthy"


class DiseaseV2TopPrediction(BaseModel):
    model_config = ConfigDict(extra="forbid")

    class_id: str
    display_name: str
    disease: str
    category: DiseaseV2Category
    confidence: float = Field(ge=0, le=1)


class DiseaseV2Response(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: DiseaseV2ResultStatus
    class_id: str | None = None
    display_name: str | None = None
    disease: str | None = None
    category: DiseaseV2Category | None = None
    confidence: float = Field(ge=0, le=1)
    top_predictions: list[DiseaseV2TopPrediction]
    message: str
    model_version: str
    classes_total: int
    threshold: float
    disclaimer: str


class DiseaseV2StatusResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    available: bool
    model: str
    model_version: str | None = None
    classes: int
    threshold: float
    model_dir: str
    production: bool
    message: str
