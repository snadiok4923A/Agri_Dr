"""Leakage-aware training pipeline for verified farm harvest records."""

from __future__ import annotations

import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import joblib
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.dummy import DummyRegressor
from sklearn.ensemble import RandomForestRegressor
from sklearn.impute import SimpleImputer
from sklearn.linear_model import Ridge
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

from .dataset import OPTIONAL_FEATURE_COLUMNS, load_and_validate

MIN_TRAIN_ROWS = 2


def _dataset_id(frame: pd.DataFrame) -> str:
    payload = frame.to_csv(index=False).encode("utf-8")
    return hashlib.sha256(payload).hexdigest()[:16]


def _split_by_season(frame: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame, list[str]]:
    groups = (
        frame[["year", "season"]]
        .drop_duplicates()
        .sort_values(["year", "season"])
        .astype({"year": int, "season": str})
    )
    if len(groups) < 2:
        raise ValueError("At least two year/season groups are required for a leakage-aware test split.")
    test_group = groups.iloc[-1]
    is_test = (frame["year"] == test_group["year"]) & (frame["season"] == test_group["season"])
    train = frame.loc[~is_test].copy()
    test = frame.loc[is_test].copy()
    if len(train) < MIN_TRAIN_ROWS or test.empty:
        raise ValueError("The year/season split does not provide enough training and test rows.")
    return train, test, [f"{row.year}-{row.season}" for row in groups.itertuples(index=False)]


def _feature_columns(frame: pd.DataFrame) -> list[str]:
    usable = [column for column in OPTIONAL_FEATURE_COLUMNS if column in frame.columns]
    if not usable:
        raise ValueError("No feature columns are available beyond the target and provenance columns.")
    return usable


def _make_pipeline(model: Any, features: list[str]) -> Pipeline:
    categorical = [column for column in features if frame_is_text(column)]
    numeric = [column for column in features if column not in categorical]
    transformers = []
    if numeric:
        transformers.append(("numeric", Pipeline([("imputer", SimpleImputer(strategy="median")), ("scale", StandardScaler())]), numeric))
    if categorical:
        transformers.append(("categorical", Pipeline([("imputer", SimpleImputer(strategy="most_frequent")), ("encode", OneHotEncoder(handle_unknown="ignore"))]), categorical))
    return Pipeline([("preprocess", ColumnTransformer(transformers=transformers)), ("model", model)])


def frame_is_text(column: str) -> bool:
    return column in {"crop", "rice_variety", "growth_stage"}


def train_dataset(dataset_path: str | Path, output_dir: str | Path) -> dict[str, Any]:
    frame, validation = load_and_validate(dataset_path)
    if not validation.valid:
        raise ValueError(json.dumps(validation.as_dict(), indent=2))
    dataset_identifier = _dataset_id(frame)
    train, test, groups = _split_by_season(frame)
    features = _feature_columns(frame)
    target = "target_yield"
    x_train, y_train = train[features], train[target]
    x_test, y_test = test[features], test[target]

    candidates = {
        "dummy_mean": DummyRegressor(strategy="mean"),
        "ridge": Ridge(alpha=1.0),
        "random_forest": RandomForestRegressor(n_estimators=100, random_state=42, n_jobs=1),
    }
    results: dict[str, dict[str, float]] = {}
    fitted: dict[str, Pipeline] = {}
    for name, estimator in candidates.items():
        pipeline = _make_pipeline(estimator, features)
        pipeline.fit(x_train, y_train)
        predicted = pipeline.predict(x_test)
        results[name] = {
            "mae": float(mean_absolute_error(y_test, predicted)),
            "rmse": float(mean_squared_error(y_test, predicted) ** 0.5),
            "r2": float(r2_score(y_test, predicted)) if len(y_test) >= 2 else float("nan"),
        }
        fitted[name] = pipeline

    best_name = min(results, key=lambda name: results[name]["mae"])
    output = Path(output_dir)
    output.mkdir(parents=True, exist_ok=True)
    artifact_path = output / "yield_model.joblib"
    metadata_path = output / "yield_model.metadata.json"
    joblib.dump(fitted[best_name], artifact_path)
    metadata = {
        "created_at": datetime.now(timezone.utc).isoformat(),
        "dataset_id": dataset_identifier,
        "dataset_path": str(dataset_path),
        "dataset_source": sorted(frame["source"].astype(str).unique().tolist()),
        "observation_level": "farm",
        "feature_names": features,
        "target": target,
        "target_unit": "tonnes_per_hectare",
        "test_split": "latest year/season group held out",
        "test_groups": [groups[-1]],
        "evaluation_metrics": results,
        "selected_model": best_name,
        "serving_supported": False,
        "limitations": [
            "Evaluation is based on one held-out latest year/season group.",
            "This artifact is not enabled for API serving until inference wiring is reviewed.",
            "Results do not establish accuracy for districts or farms outside this dataset.",
        ],
    }
    metadata_path.write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    return metadata


def main() -> None:
    parser = argparse.ArgumentParser(description="Train a leakage-aware Krisiveda rice-yield model.")
    parser.add_argument("dataset", help="Path to a verified canonical CSV dataset.")
    parser.add_argument("--output-dir", default="models", help="Directory for model and metadata artifacts.")
    args = parser.parse_args()
    metadata = train_dataset(args.dataset, args.output_dir)
    print(json.dumps(metadata, indent=2))


if __name__ == "__main__":
    main()
