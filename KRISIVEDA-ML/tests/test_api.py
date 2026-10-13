"""Contract tests for the phase-one prediction service."""

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


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
