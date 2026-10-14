"""FastAPI application for Krisiveda yield prediction."""

from fastapi import FastAPI
from fastapi import HTTPException

from .predictor import get_model_status, predict
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


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "krisiveda-ml"}


@app.get("/model/status", response_model=ModelStatus)
def model_status() -> ModelStatus:
    return get_model_status()


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
