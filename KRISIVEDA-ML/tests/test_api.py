"""Contract tests for the prediction and disease services."""

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app import main
from app.main import app

client = TestClient(app)
TEST_IMAGE = Path(__file__).parents[2] / "public" / "Disease" / "Leaf Blast.jpg"


def test_health() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_disease_status() -> None:
    response = client.get("/disease/status")
    assert response.status_code == 200
    assert response.json()["available"] is True
    assert response.json()["classes"] == 6


def test_disease_prediction_with_real_model_and_image() -> None:
    response = client.post(
        "/disease/predict",
        files={"file": ("leaf.jpg", TEST_IMAGE.read_bytes(), "image/jpeg")},
    )
    assert response.status_code == 200
    assert response.json()["status"] in {"ok", "uncertain"}
    assert 0 <= response.json()["confidence"] <= 1


def test_disease_rejects_invalid_file_type() -> None:
    response = client.post(
        "/disease/predict",
        files={"file": ("leaf.txt", b"not an image", "text/plain")},
    )
    assert response.status_code == 415


def test_disease_rejects_corrupted_image() -> None:
    response = client.post(
        "/disease/predict",
        files={"file": ("leaf.jpg", b"not an image", "image/jpeg")},
    )
    assert response.status_code == 422


def test_disease_rejects_oversized_upload() -> None:
    response = client.post(
        "/disease/predict",
        files={"file": ("leaf.jpg", b"x" * (10 * 1024 * 1024 + 1), "image/jpeg")},
    )
    assert response.status_code == 413


def test_disease_returns_unavailable_when_model_is_missing(monkeypatch: pytest.MonkeyPatch) -> None:
    def unavailable(_: bytes) -> dict:
        raise main.DiseaseModelUnavailableError("missing")

    monkeypatch.setattr(main, "analyze_disease_image", unavailable)
    response = client.post(
        "/disease/predict",
        files={"file": ("leaf.jpg", b"valid", "image/jpeg")},
    )
    assert response.status_code == 503


def test_disease_preserves_uncertain_result(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        main,
        "analyze_disease_image",
        lambda _: {
            "status": "uncertain",
            "disease": None,
            "confidence": 0.42,
            "top_predictions": [],
            "message": "Uncertain result.",
            "model_version": "test",
        },
    )
    response = client.post(
        "/disease/predict",
        files={"file": ("leaf.jpg", b"valid", "image/jpeg")},
    )
    assert response.status_code == 200
    assert response.json()["status"] == "uncertain"
    assert response.json()["disease"] is None


def test_valid_input_is_honest_when_model_is_absent() -> None:
    response = client.post(
        "/predict",
        json={
            "farm_area": 2.5,
            "area_unit": "acre",
            "crop": "rice",
            "rice_variety": "Swarna",
            "growth_stage": "tillering",
            "weather": {"temperature_c": 29, "humidity_pct": 78},
            "fertilizer_history": [{"product": "Urea", "quantity": 40, "unit": "kg"}],
            "medicine_history": [{"product": "Tricyclazole"}],
        },
    )
    body = response.json()
    assert response.status_code == 200
    assert body["mode"] == "unavailable"
    assert body["prediction"] is None
    assert body["prediction_source"] == "none"
    assert body["weather_status"] == "available"
    assert body["missing_features"] == []


def test_missing_area_never_returns_total_production() -> None:
    body = client.post("/predict", json={"crop": "rice"}).json()
    assert body["mode"] == "unavailable"
    assert body["total_production"] is None
    assert "farm_area" in body["missing_features"]
    assert any("total farm production" in item for item in body["limitations"])


def test_missing_crop_details_are_reported_without_specific_conclusions() -> None:
    body = client.post("/predict", json={"farm_area": 1, "area_unit": "acre"}).json()
    assert {"crop", "rice_variety", "growth_stage"}.issubset(body["missing_features"])
    assert any("crop-, variety-, or stage-specific" in item for item in body["limitations"])


def test_unavailable_weather_is_explicit() -> None:
    body = client.post(
        "/predict",
        json={"farm_area": 1, "area_unit": "acre", "crop": "rice"},
    ).json()
    assert body["weather_status"] == "unavailable"
    assert "weather" in body["missing_features"]
    assert any("Weather data is unavailable" in item for item in body["limitations"])


def test_model_status_and_prediction_are_unavailable_without_verified_artifacts() -> None:
    status = client.get("/model/status")
    prediction = client.post("/predict", json={})
    assert status.status_code == 200
    assert status.json()["mode"] == "unavailable"
    assert status.json()["trained_model_available"] is False
    assert status.json()["verified_baseline_available"] is False
    assert prediction.json()["model_status"]["mode"] == "unavailable"
