"""Safeguard tests for validation and training."""

from pathlib import Path

import pandas as pd
import pytest

from app.dataset import validate_dataframe
from app.training import train_dataset


def valid_row(record_id: str, year: int, season: str) -> dict[str, object]:
    return {
        "record_id": record_id,
        "observation_level": "farm",
        "target_yield": 2.0,
        "target_yield_unit": "tonnes_per_hectare",
        "harvested_area": 1.0,
        "harvested_area_unit": "hectare",
        "production": 2.0,
        "production_unit": "tonne",
        "year": year,
        "season": season,
        "district": "Example",
        "source": "verified harvest register",
        "data_quality_status": "verified",
        "crop": "rice",
        "rice_variety": "Swarna",
        "growth_stage": "harvest",
        "temperature_mean_c": 28.0,
    }


def test_validator_reports_missing_columns() -> None:
    report = validate_dataframe(pd.DataFrame({"record_id": ["x"]}))
    assert report.valid is False
    assert report.issues[0].code == "missing_columns"


def test_validator_rejects_empty_template() -> None:
    report = validate_dataframe(pd.DataFrame(columns=["record_id"]))
    assert report.valid is False
    assert any(issue.code == "empty_dataset" for issue in report.issues)


def test_validator_rejects_duplicates_units_and_unverified_rows() -> None:
    rows = [valid_row("same", 2023, "kharif"), valid_row("same", 2023, "kharif")]
    rows[1]["target_yield_unit"] = "kg_per_hectare"
    rows[1]["data_quality_status"] = "unverified"
    report = validate_dataframe(pd.DataFrame(rows))
    codes = {issue.code for issue in report.issues}
    assert {"duplicate_records", "inconsistent_units", "unverified_records"} <= codes


def test_validator_rejects_aggregate_rows_and_suspicious_production() -> None:
    row = valid_row("district-1", 2023, "kharif")
    row["observation_level"] = "district"
    row["production"] = 99.0
    report = validate_dataframe(pd.DataFrame([row]))
    codes = {issue.code for issue in report.issues}
    assert {"non_farm_ground_truth", "suspicious_records"} <= codes


def test_training_requires_two_seasons(tmp_path: Path) -> None:
    dataset = tmp_path / "one-season.csv"
    pd.DataFrame([valid_row("a", 2023, "kharif"), valid_row("b", 2023, "kharif")]).to_csv(dataset, index=False)
    with pytest.raises(ValueError, match="two year/season groups"):
        train_dataset(dataset, tmp_path / "models")


def test_training_rejects_unverified_data(tmp_path: Path) -> None:
    dataset = tmp_path / "unverified.csv"
    row = valid_row("a", 2023, "kharif")
    row["data_quality_status"] = "unverified"
    pd.DataFrame([row, valid_row("b", 2024, "kharif")]).to_csv(dataset, index=False)
    with pytest.raises(ValueError, match="unverified_records"):
        train_dataset(dataset, tmp_path / "models")


def test_training_writes_metadata_only_for_valid_multi_season_data(tmp_path: Path) -> None:
    rows = [
        valid_row("a", 2023, "kharif"),
        valid_row("b", 2023, "kharif"),
        valid_row("c", 2024, "kharif"),
    ]
    rows[1]["target_yield"] = 2.5
    rows[1]["production"] = 2.5
    rows[2]["target_yield"] = 3.0
    rows[2]["production"] = 3.0
    dataset = tmp_path / "verified.csv"
    output = tmp_path / "models"
    pd.DataFrame(rows).to_csv(dataset, index=False)
    metadata = train_dataset(dataset, output)
    assert metadata["dataset_id"]
    assert metadata["feature_names"] == ["crop", "rice_variety", "growth_stage", "temperature_mean_c"]
    assert metadata["target_unit"] == "tonnes_per_hectare"
    assert metadata["evaluation_metrics"]["dummy_mean"]["mae"] >= 0
    assert (output / "yield_model.joblib").is_file()
    assert (output / "yield_model.metadata.json").is_file()
    assert metadata["serving_supported"] is False
