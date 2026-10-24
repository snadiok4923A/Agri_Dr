"""FastAPI application for Krisiveda yield prediction."""

import os

from fastapi import File, FastAPI, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from .predictor import get_model_status, predict
from .disease_service import (
    DiseaseModelUnavailableError,
    analyze_disease_image,
    get_disease_model_status,
)
from .regional_baseline import (
    RegionalBaselineUnavailableError,
    estimate_regional_production,
    latest_west_bengal_statistic,
)
from .regional_schemas import (
    RegionalEstimateRequest,
    RegionalEstimateResponse,
    RegionalReference,
)
from .schemas import ModelStatus, YieldPredictionRequest, YieldPredictionResponse

app = FastAPI(
    title="Krisiveda ML Service",
    version="0.1.0",
    description="Transparent paddy yield prediction service; no model is active yet.",
)

cors_origins = [
    origin.strip()
    for origin in os.getenv("KRISIVEDA_ML_CORS_ORIGINS", "").split(",")
    if origin.strip()
]
if "*" in cors_origins:
    raise RuntimeError(
        "KRISIVEDA_ML_CORS_ORIGINS must contain explicit frontend origins, not '*'."
    )
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "krisiveda-ml"}


@app.get("/model/status", response_model=ModelStatus)
def model_status() -> ModelStatus:
    return get_model_status()


@app.get("/disease/status")
def disease_status() -> dict:
    return get_disease_model_status()


@app.post("/disease/predict")
async def disease_prediction(file: UploadFile = File(...)) -> dict:
    allowed_types = {"image/jpeg", "image/png", "image/webp"}
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=415,
            detail="Upload a JPEG, PNG, or WEBP image.",
        )

    image_bytes = await file.read(10 * 1024 * 1024 + 1)
    if len(image_bytes) > 10 * 1024 * 1024:
        raise HTTPException(
            status_code=413,
            detail="Image exceeds the 10 MB upload limit.",
        )

    try:
        return analyze_disease_image(image_bytes)
    except DiseaseModelUnavailableError as exc:
        raise HTTPException(
            status_code=503,
            detail="Disease recognition is temporarily unavailable.",
        ) from exc
    except ValueError as exc:
        message = str(exc)
        if message == "Image exceeds the 10 MB upload limit.":
            raise HTTPException(status_code=413, detail=message) from exc
        raise HTTPException(
            status_code=422,
            detail="The uploaded file is not a valid supported image.",
        ) from exc
    except RuntimeError as exc:
        raise HTTPException(
            status_code=503,
            detail="Disease recognition is temporarily unavailable.",
        ) from exc


@app.post("/predict", response_model=YieldPredictionResponse)
def prediction(request: YieldPredictionRequest) -> YieldPredictionResponse:
    return predict(request)


def _regional_reference() -> RegionalReference:
    try:
        statistic = latest_west_bengal_statistic()
    except RegionalBaselineUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return RegionalReference(
        geography=statistic.geography,
        reporting_period=statistic.reporting_period,
        yield_kg_per_hectare=statistic.yield_kg_per_hectare,
        statistic_label="state-level historical statistic, not a farm-specific prediction",
        source_file=statistic.source_file,
        source_url=statistic.source_url,
        source_page=statistic.source_page,
        table_title=statistic.table_title,
    )


@app.get("/regional-baseline", response_model=RegionalReference)
def regional_baseline() -> RegionalReference:
    """Return the latest verified West Bengal regional reference."""

    return _regional_reference()


@app.post(
    "/regional-baseline/estimate",
    response_model=RegionalEstimateResponse,
)
def regional_baseline_estimate(
    request: RegionalEstimateRequest,
) -> RegionalEstimateResponse:
    reference = _regional_reference()
    label = "illustrative regional estimate, not expected or guaranteed farm production"
    limitations = [
        "This uses a state-level historical statistic, not a farm-specific prediction.",
        "No adjustment is made for variety, growth stage, weather, fertilizer, or medicine.",
        label.capitalize() + ".",
    ]
    if request.farm_area is None:
        limitations.append(
            "Farm area is missing; no illustrative production quantity is calculated."
        )
        return RegionalEstimateResponse(
            reference=reference,
            estimate_available=False,
            estimate_label=label,
            limitations=limitations,
        )
    try:
        estimate = estimate_regional_production(
            request.farm_area,
            request.area_unit or "",
        )
    except (RegionalBaselineUnavailableError, ValueError) as exc:
        status_code = 503 if isinstance(exc, RegionalBaselineUnavailableError) else 422
        raise HTTPException(status_code=status_code, detail=str(exc)) from exc
    return RegionalEstimateResponse(
        reference=reference,
        estimate_available=True,
        farm_area=estimate.farm_area,
        farm_area_unit=estimate.farm_area_unit,
        area_hectares=estimate.area_hectares,
        illustrative_production_tonnes=estimate.illustrative_production_tonnes,
        estimate_label=estimate.label,
        limitations=limitations,
    )
