"""Tests for the transparent aggregate regional reference."""

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.regional_baseline import (
    RegionalBaselineUnavailableError,
    REGIONAL_STATISTICS_PATH,
    convert_area_to_hectares,
    estimate_regional_production,
    latest_west_bengal_statistic,
)

client = TestClient(app)


def test_latest_reference_preserves_reported_west_bengal_value() -> None:
    assert REGIONAL_STATISTICS_PATH.is_absolute()
    assert REGIONAL_STATISTICS_PATH.is_file()
    statistic = latest_west_bengal_statistic()
    assert statistic.reporting_period == "2024-25"
    assert statistic.yield_kg_per_hectare == 2865


def test_area_conversion_supports_hectare_and_acre() -> None:
    assert convert_area_to_hectares(2, "hectare") == 2
    assert convert_area_to_hectares(1, "acre") == pytest.approx(0.40468564224)


def test_invalid_area_or_unknown_unit_is_rejected() -> None:
    with pytest.raises(ValueError, match="greater than zero"):
        convert_area_to_hectares(0, "hectare")
    with pytest.raises(ValueError, match="not supported"):
        convert_area_to_hectares(1, "bigha")


def test_missing_regional_statistics_is_explicit(tmp_path: Path) -> None:
    with pytest.raises(RegionalBaselineUnavailableError, match="unavailable"):
        latest_west_bengal_statistic(tmp_path / "missing.csv")


def test_estimate_uses_latest_yield_and_has_regional_label() -> None:
    estimate = estimate_regional_production(1, "hectare")
    assert estimate.illustrative_production_tonnes == pytest.approx(2.865)
    assert "illustrative regional estimate" in estimate.label
    assert "not expected or guaranteed" in estimate.label


def test_reference_endpoint_identifies_state_statistic() -> None:
    response = client.get("/regional-baseline")
    assert response.status_code == 200
    assert response.json()["yield_kg_per_hectare"] == 2865
    assert "state-level historical statistic" in response.json()["statistic_label"]


def test_estimate_endpoint_without_area_returns_no_quantity() -> None:
    response = client.post("/regional-baseline/estimate", json={})
    body = response.json()
    assert response.status_code == 200
    assert body["estimate_available"] is False
    assert body["illustrative_production_tonnes"] is None
    assert "illustrative regional estimate" in body["estimate_label"]


def test_estimate_endpoint_requires_area_unit() -> None:
    response = client.post("/regional-baseline/estimate", json={"farm_area": 1})
    assert response.status_code == 422


def test_farm_predict_api_remains_unavailable() -> None:
    response = client.post("/predict", json={})
    assert response.status_code == 200
    assert response.json()["mode"] == "unavailable"
