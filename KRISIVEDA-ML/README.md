# Krisiveda ML service

This directory contains the isolated FastAPI service for future paddy yield
prediction. It is deliberately separate from the existing React application.

## Current status

There is currently no verified harvest dataset and no trained model artifact in
this repository. Consequently, the service returns:

```json
{
  "mode": "unavailable",
  "prediction": null,
  "prediction_source": "none"
}
```

It does not invent a yield, area conversion, variety-specific conclusion, or
stage-specific conclusion. Missing fertilizer or medicine history does not
produce recommendations that depend on those histories. Missing weather is
reported as `weather_status: "unavailable"`.

The supported modes are:

- `trained_model`: reserved for a model trained and evaluated on verified
  individual-farm harvest records.
- `baseline`: reserved for a documented baseline built from a verified
  historical dataset.
- `unavailable`: the current mode because neither source exists.

District-level historical yield data must remain separate from individual farm
measurements and cannot be used as individual-farm harvest labels.

## Run locally

From this directory:

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload
```

The API is then available at `http://127.0.0.1:8000`.

## Endpoints

- `GET /health`
- `GET /model/status`
- `POST /predict`
- `GET /regional-baseline`
- `POST /regional-baseline/estimate`

The request accepts optional farm area, area unit, crop, rice variety, growth
stage, weather data, fertilizer history, and medicine history. Unknown fields
are rejected. Optional values remain absent rather than being filled with
defaults.

## Phase 5 regional baseline

The regional endpoints are separate from `/predict` and do not activate the
farm-specific ML `baseline` mode. They use only the verified aggregate rows in
[data/regional_rice_statistics.csv](data/regional_rice_statistics.csv).

`GET /regional-baseline` returns the latest explicitly reported West Bengal
rice statistic. The current reference is **2,865 kg/hectare for 2024-25** and
is labeled as a **state-level historical statistic, not a farm-specific
prediction**. The source is the official publication documented in
[data/regional_rice_statistics.md](data/regional_rice_statistics.md).

`POST /regional-baseline/estimate` accepts:

```json
{"farm_area": 1, "area_unit": "hectare"}
```

`farm_area` and `area_unit` are optional together. If area is provided, only
`hectare` and `acre` are accepted because their conversions are explicit. The
response may contain an `illustrative_production_tonnes` value calculated from
the latest state statistic. It is always labeled **illustrative regional
estimate, not expected or guaranteed farm production**. Missing area produces
no quantity. The calculation does not adjust for variety, growth stage,
weather, fertilizer, or medicine.

This regional reference is not farm-level ground truth, does not provide an
accuracy metric, and does not change `/model/status` or `/predict`, which
remain `unavailable` for farm-specific ML inference.

## Tests

```powershell
pytest
```

The tests cover the API contract, valid and incomplete inputs, unavailable
weather, absence of a trained model, dataset validation, duplicate and
unverified records, district-row rejection, season-split safeguards, and
metadata generation.

## Phase 2 dataset validation and training

The required CSV contract is documented in [data/README.md](data/README.md),
and [data/rice_yield_template.csv](data/rice_yield_template.csv) contains
headers only. No synthetic or example harvest labels are included.

Validate a supplied dataset before training:

```powershell
python scripts/validate_dataset.py path\to\verified_rice_yield.csv
```

The validator checks required columns, missing values, numeric values,
canonical units, duplicate records, non-farm aggregate rows, verification
status, and production/yield/area consistency.

Train only from a valid, verified farm-level dataset:

```powershell
python scripts/train_model.py path\to\verified_rice_yield.csv --output-dir models
```

The pipeline compares a mean baseline, Ridge regression, and
RandomForestRegressor. It holds out the latest year/season group rather than
randomly splitting rows, and reports MAE, RMSE, and R² where the test set
supports it. It stores a dataset identifier, source values, feature names,
target units, split description, metrics, selected model, and limitations in
`yield_model.metadata.json`.

Phase 2 artifacts are deliberately marked `serving_supported: false`. The
existing API therefore remains in `unavailable` mode until a reviewed
inference adapter is implemented. A trained artifact is not an accuracy claim,
and a district-level average is not individual-farm ground truth.
