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

The request accepts optional farm area, area unit, crop, rice variety, growth
stage, weather data, fertilizer history, and medicine history. Unknown fields
are rejected. Optional values remain absent rather than being filled with
defaults.

## Tests

```powershell
pytest
```

The tests cover valid input, missing area, missing crop details, unavailable
weather, and the absence of a trained model or verified baseline.
