"""Prediction selection and feature-availability logic.

There is intentionally no fabricated model or baseline in this phase. A
future trained artifact or verified baseline dataset can be registered here
without changing the API contract.
"""

from pathlib import Path

from .schemas import (
    ModelMode,
    ModelStatus,
    YieldPredictionRequest,
    YieldPredictionResponse,
)

SERVICE_ROOT = Path(__file__).resolve().parent.parent
MODEL_PATH = SERVICE_ROOT / "models" / "yield_model.joblib"
BASELINE_PATH = SERVICE_ROOT / "data" / "verified_baseline.csv"


def _trained_model_available() -> bool:
    # Phase 2 writes artifacts for auditability, but serving is intentionally
    # disabled until a reviewed inference adapter is implemented.
    metadata_path = MODEL_PATH.with_suffix(".metadata.json")
    if not MODEL_PATH.is_file() or not metadata_path.is_file():
        return False
    try:
        import json

        metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return False
    return metadata.get("serving_supported") is True and (MODEL_PATH.with_suffix(".verified")).is_file()


def _verified_baseline_available() -> bool:
    # A CSV alone is not evidence that its rows were verified. The training
    # workflow must publish the adjacent marker after validating provenance.
    return BASELINE_PATH.is_file() and (BASELINE_PATH.with_suffix(".verified")).is_file()


def get_model_status() -> ModelStatus:
    trained = _trained_model_available()
    baseline = _verified_baseline_available()
    if trained:
        mode = ModelMode.trained_model
        message = "A model artifact marked as trained on verified harvest records is available."
    elif baseline:
        mode = ModelMode.baseline
        message = "A verified historical baseline dataset is available; no trained model is active."
    else:
        mode = ModelMode.unavailable
        message = (
            "No trained model or verified historical baseline is available. "
            "No yield prediction is returned."
        )
    return ModelStatus(
        mode=mode,
        trained_model_available=trained,
        verified_baseline_available=baseline,
        message=message,
    )


def _feature_state(request: YieldPredictionRequest) -> tuple[list[str], list[str]]:
    available: list[str] = []
    missing: list[str] = []

    scalar_features = {
        "farm_area": request.farm_area,
        "area_unit": request.area_unit,
        "crop": request.crop,
        "rice_variety": request.rice_variety,
        "growth_stage": request.growth_stage,
        "weather": request.weather,
        "fertilizer_history": request.fertilizer_history,
        "medicine_history": request.medicine_history,
    }
    for name, value in scalar_features.items():
        (available if value is not None else missing).append(name)
    return available, missing


def predict(request: YieldPredictionRequest) -> YieldPredictionResponse:
    status = get_model_status()
    available, missing = _feature_state(request)
    limitations = [
        "No verified individual-farm harvest records are available for supervised inference.",
        "The service does not convert area units or calculate total production without a prediction.",
    ]
    if "farm_area" in missing:
        limitations.append("Farm area is missing; total farm production cannot be calculated.")
    if "crop" in missing or "rice_variety" in missing or "growth_stage" in missing:
        limitations.append(
            "Missing crop details prevent crop-, variety-, or stage-specific conclusions."
        )
    if "fertilizer_history" in missing:
        limitations.append("Fertilizer history is missing; fertilizer-history recommendations are skipped.")
    if "medicine_history" in missing:
        limitations.append("Medicine history is missing; medicine-history recommendations are skipped.")
    if request.weather is None:
        limitations.append("Weather data is unavailable; weather-dependent analysis is skipped.")

    return YieldPredictionResponse(
        mode=status.mode,
        prediction_source=(
            "trained_verified_harvest_model"
            if status.mode is ModelMode.trained_model
            else "verified_historical_baseline"
            if status.mode is ModelMode.baseline
            else "none"
        ),
        model_status=status,
        weather_status="available" if request.weather is not None else "unavailable",
        available_features=available,
        missing_features=missing,
        limitations=limitations,
    )
