"""Validation for the canonical rice-yield training CSV."""

from __future__ import annotations

from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

import pandas as pd

REQUIRED_COLUMNS = (
    "record_id",
    "observation_level",
    "target_yield",
    "target_yield_unit",
    "harvested_area",
    "harvested_area_unit",
    "production",
    "production_unit",
    "year",
    "season",
    "district",
    "source",
    "data_quality_status",
)
OPTIONAL_FEATURE_COLUMNS = (
    "crop",
    "rice_variety",
    "growth_stage",
    "temperature_mean_c",
    "humidity_mean_pct",
    "precipitation_total_mm",
    "rain_probability_mean_pct",
    "fertilizer_kg_per_hectare",
    "medicine_applications",
)
NUMERIC_COLUMNS = (
    "target_yield",
    "harvested_area",
    "production",
    "year",
    "temperature_mean_c",
    "humidity_mean_pct",
    "precipitation_total_mm",
    "rain_probability_mean_pct",
    "fertilizer_kg_per_hectare",
    "medicine_applications",
)
CANONICAL_UNITS = {
    "target_yield_unit": "tonnes_per_hectare",
    "harvested_area_unit": "hectare",
    "production_unit": "tonne",
}
_TEXT_COLUMNS = (
    "record_id",
    "observation_level",
    "target_yield_unit",
    "harvested_area_unit",
    "production_unit",
    "season",
    "district",
    "source",
    "data_quality_status",
)


@dataclass(frozen=True)
class ValidationIssue:
    code: str
    message: str
    rows: tuple[int, ...] = ()

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class DatasetValidation:
    path: str
    valid: bool
    row_count: int
    columns: tuple[str, ...]
    issues: tuple[ValidationIssue, ...]
    dataset_id: str | None = None

    def as_dict(self) -> dict[str, Any]:
        result = asdict(self)
        result["issues"] = [issue.as_dict() for issue in self.issues]
        return result


def _issue(code: str, message: str, rows: list[int] | None = None) -> ValidationIssue:
    return ValidationIssue(code, message, tuple(rows or ()))


def validate_dataframe(frame: pd.DataFrame, path: str = "<dataframe>") -> DatasetValidation:
    issues: list[ValidationIssue] = []
    if frame.empty:
        issues.append(_issue("empty_dataset", "The dataset contains no harvest records."))
    missing_columns = [column for column in REQUIRED_COLUMNS if column not in frame.columns]
    if missing_columns:
        issues.append(_issue("missing_columns", f"Missing required columns: {missing_columns}"))
        return DatasetValidation(path, False, len(frame), tuple(frame.columns), tuple(issues))

    for column in (*_TEXT_COLUMNS, "crop", "rice_variety", "growth_stage"):
        if column in frame:
            missing = frame[column].isna() | frame[column].astype("string").str.strip().eq("")
            if missing.any() and column in REQUIRED_COLUMNS:
                issues.append(
                    _issue("missing_values", f"Required column '{column}' has missing values.", (frame.index[missing] + 2).tolist())
                )

    for column in NUMERIC_COLUMNS:
        if column not in frame:
            continue
        numeric = pd.to_numeric(frame[column], errors="coerce")
        invalid = numeric.isna() & frame[column].notna()
        if invalid.any():
            issues.append(_issue("invalid_numeric", f"Column '{column}' contains non-numeric values.", (frame.index[invalid] + 2).tolist()))
        if column in ("target_yield", "harvested_area", "production", "year") and (numeric.dropna() <= 0).any():
            issues.append(_issue("suspicious_numeric", f"Column '{column}' must be positive."))
        if column in ("humidity_mean_pct", "rain_probability_mean_pct") and ((numeric.dropna() < 0) | (numeric.dropna() > 100)).any():
            issues.append(_issue("suspicious_numeric", f"Column '{column}' must be between 0 and 100."))

    for column, expected in CANONICAL_UNITS.items():
        values = frame[column].dropna().astype(str).str.strip()
        if not values.eq(expected).all():
            issues.append(_issue("inconsistent_units", f"Column '{column}' must use canonical unit '{expected}'."))

    duplicate_ids = frame["record_id"].astype("string").duplicated(keep=False)
    if duplicate_ids.any():
        issues.append(_issue("duplicate_records", "Duplicate record_id values found.", (frame.index[duplicate_ids] + 2).tolist()))

    # Multiple farms can legitimately share a district, season, and source.
    # Treat only exact duplicate rows as duplicate harvest records; record_id
    # separately protects the stable-record identity.
    duplicate_identity = frame.duplicated(keep=False)
    if duplicate_identity.any():
        issues.append(_issue("duplicate_records", "Duplicate harvest identity records found.", (frame.index[duplicate_identity] + 2).tolist()))

    farm_rows = frame["observation_level"].astype("string").str.lower().eq("farm")
    non_farm = ~farm_rows
    if non_farm.any():
        issues.append(_issue("non_farm_ground_truth", "District or other aggregate rows cannot train the farm-level model.", (frame.index[non_farm] + 2).tolist()))

    unverified = ~frame["data_quality_status"].astype("string").str.lower().eq("verified")
    if unverified.any():
        issues.append(_issue("unverified_records", "Only data_quality_status=verified rows may train.", (frame.index[unverified] + 2).tolist()))

    expected_production = pd.to_numeric(frame["target_yield"], errors="coerce") * pd.to_numeric(frame["harvested_area"], errors="coerce")
    production = pd.to_numeric(frame["production"], errors="coerce")
    inconsistent_production = expected_production.notna() & production.notna() & ~expected_production.sub(production).abs().le(0.05)
    if inconsistent_production.any():
        issues.append(_issue("suspicious_records", "Production is inconsistent with yield multiplied by harvested area.", (frame.index[inconsistent_production] + 2).tolist()))

    return DatasetValidation(path, not issues, len(frame), tuple(frame.columns), tuple(issues))


def load_and_validate(path: str | Path) -> tuple[pd.DataFrame, DatasetValidation]:
    csv_path = Path(path)
    if not csv_path.is_file():
        raise FileNotFoundError(f"Dataset does not exist: {csv_path}")
    frame = pd.read_csv(csv_path)
    validation = validate_dataframe(frame, str(csv_path))
    return frame, validation
