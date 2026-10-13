"""FastAPI application for Krisiveda yield prediction."""

from fastapi import FastAPI

from .predictor import get_model_status, predict
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
