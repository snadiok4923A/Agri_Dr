"""Contract and safety tests for the 15-class ``/disease/v2`` endpoints.

Three things are pinned here: the new endpoints behave like v1 for uploads and
uncertain results, the metadata/ONNX checks refuse a wrong model instead of
mislabelling it, and the v1 endpoints plus both model files stay untouched.
"""

from __future__ import annotations

import json
from io import BytesIO
from pathlib import Path

import numpy as np
import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app import disease_v2_service, main
from app.disease_v2_service import (
    DiseaseV2ModelUnavailableError,
    MODEL_DIR_ENV,
    _read_metadata,
    load_model,
    reset_cache,
)
from app.main import app

client = TestClient(app)

TEST_IMAGE = Path(__file__).parents[2] / "public" / "Disease" / "Leaf Blast.jpg"
MODEL_DIR = disease_v2_service.DEFAULT_MODEL_DIR
HAS_MODEL = bool(list(MODEL_DIR.glob("*.onnx"))) and (MODEL_DIR / "model_metadata.json").is_file()
requires_model = pytest.mark.skipif(not HAS_MODEL, reason="Experiment A ONNX artifact not exported")

PRODUCTION_ARTIFACTS = (
    Path(__file__).parents[1] / "models" / "rice_disease_model.onnx",
    Path(__file__).parents[1] / "models" / "class_names.json",
)


@pytest.fixture(autouse=True)
def _clear_model_cache():
    """Every test starts from a cold cache so env changes take effect."""

    reset_cache()
    yield
    reset_cache()


def _rgba_png_bytes(size: int = 160) -> bytes:
    """Half-transparent gradient: exercises the alpha-compositing path."""

    array = np.zeros((size, size, 4), dtype=np.uint8)
    ramp = np.linspace(20, 230, size, dtype=np.uint8)
    array[..., 0] = ramp[None, :]
    array[..., 1] = ramp[:, None]
    array[..., 2] = 90
    array[..., 3] = 128
    buffer = BytesIO()
    Image.fromarray(array, "RGBA").save(buffer, format="PNG")
    return buffer.getvalue()


def _snapshot(paths) -> dict[str, tuple[int, int]]:
    return {
        str(path): (path.stat().st_size, path.stat().st_mtime_ns)
        for path in paths
        if path.is_file()
    }


# --- status ----------------------------------------------------------------


@requires_model
def test_v2_status_reports_the_experiment_a_model() -> None:
    response = client.get("/disease/v2/status")
    body = response.json()

    assert response.status_code == 200
    assert body["available"] is True
    assert body["classes"] == 15
    assert body["model_version"] == "rice-disease-15class-v3-exp20"
    assert body["model_version"] != "rice-disease-15class-v2"
    assert body["production"] is False
    assert body["threshold"] == 0.6
    # Folder name only: never an absolute server path.
    assert body["model_dir"] == "rice-disease-15class-v3-exp20"
    assert ":" not in body["model_dir"] and "\\" not in body["model_dir"]


def test_v2_status_is_unavailable_when_the_directory_is_missing(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    monkeypatch.setenv(MODEL_DIR_ENV, str(tmp_path / "absent"))
    reset_cache()

    body = client.get("/disease/v2/status").json()

    assert body["available"] is False
    assert body["classes"] == 0
    assert body["model_version"] is None
    assert body["model_dir"] == "absent"


# --- prediction ------------------------------------------------------------


@requires_model
def test_v2_prediction_matches_the_response_schema() -> None:
    response = client.post(
        "/disease/v2/predict",
        files={"file": ("leaf.jpg", TEST_IMAGE.read_bytes(), "image/jpeg")},
    )
    body = response.json()

    assert response.status_code == 200
    assert body["status"] in {"ok", "uncertain"}
    assert 0 <= body["confidence"] <= 1
    assert body["classes_total"] == 15
    assert body["threshold"] == 0.6
    assert body["model_version"] == "rice-disease-15class-v3-exp20"
    assert len(body["top_predictions"]) == 3

    taxonomy_ids = set(disease_v2_service.taxonomy.CLASS_IDS)
    for prediction in body["top_predictions"]:
        assert prediction["class_id"] in taxonomy_ids
        assert prediction["category"] in {"disease", "pest", "healthy"}
        # The v1-compatible alias must carry the human name.
        assert prediction["disease"] == prediction["display_name"]
        assert 0 <= prediction["confidence"] <= 1

    if body["status"] == "ok":
        assert body["class_id"] == body["top_predictions"][0]["class_id"]
        assert body["disease"] == body["top_predictions"][0]["disease"]
        assert body["category"] == body["top_predictions"][0]["category"]
        assert body["confidence"] >= 0.6
    else:
        assert body["class_id"] is None
        assert body["disease"] is None
        assert body["category"] is None
        assert "uncertain" in body["message"].lower()


@requires_model
def test_v2_prediction_accepts_transparent_rgba_png() -> None:
    response = client.post(
        "/disease/v2/predict",
        files={"file": ("leaf.png", _rgba_png_bytes(), "image/png")},
    )
    body = response.json()

    assert response.status_code == 200
    assert body["status"] in {"ok", "uncertain"}
    assert isinstance(body["confidence"], float)


def test_v2_prediction_rejects_a_wrong_file_type() -> None:
    response = client.post(
        "/disease/v2/predict",
        files={"file": ("leaf.txt", b"not an image", "text/plain")},
    )
    assert response.status_code == 415


def test_v2_prediction_rejects_a_corrupted_image() -> None:
    response = client.post(
        "/disease/v2/predict",
        files={"file": ("leaf.jpg", b"not an image", "image/jpeg")},
    )
    assert response.status_code == 422


def test_v2_prediction_rejects_an_oversized_upload() -> None:
    response = client.post(
        "/disease/v2/predict",
        files={"file": ("leaf.jpg", b"x" * (10 * 1024 * 1024 + 1), "image/jpeg")},
    )
    assert response.status_code == 413


def test_v2_prediction_returns_503_when_the_model_is_missing(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    monkeypatch.setenv(MODEL_DIR_ENV, str(tmp_path / "absent"))
    reset_cache()

    response = client.post(
        "/disease/v2/predict",
        files={"file": ("leaf.jpg", TEST_IMAGE.read_bytes(), "image/jpeg")},
    )
    assert response.status_code == 503
    assert "unavailable" in response.json()["detail"].lower()


def test_v2_prediction_keeps_uncertain_results_explicit(monkeypatch: pytest.MonkeyPatch) -> None:
    def uncertain(_: bytes) -> dict:
        return {
            "status": "uncertain",
            "class_id": None,
            "display_name": None,
            "disease": None,
            "category": None,
            "confidence": 0.42,
            "top_predictions": [
                {
                    "class_id": "leaf_blast",
                    "display_name": "Leaf blast",
                    "disease": "Leaf blast",
                    "category": "disease",
                    "confidence": 0.42,
                }
            ],
            "message": "The result is uncertain.",
            "model_version": "rice-disease-15class-v3-exp20",
            "classes_total": 15,
            "threshold": 0.6,
            "disclaimer": "Experimental model.",
        }

    monkeypatch.setattr(main, "analyze_disease_v2_image", uncertain)
    response = client.post(
        "/disease/v2/predict",
        files={"file": ("leaf.jpg", b"valid", "image/jpeg")},
    )
    body = response.json()

    assert response.status_code == 200
    assert body["status"] == "uncertain"
    assert body["disease"] is None
    assert body["class_id"] is None
    assert body["confidence"] == 0.42
    assert body["top_predictions"][0]["disease"] == "Leaf blast"


# --- refusing the wrong model ---------------------------------------------


def test_v2_refuses_the_older_15_class_development_model(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv(MODEL_DIR_ENV, str(disease_v2_service.V2_DEVELOPMENT_ROOT))
    reset_cache()

    with pytest.raises(DiseaseV2ModelUnavailableError, match="v2 development model"):
        load_model()

    body = client.get("/disease/v2/status").json()
    assert body["available"] is False
    assert body["model_version"] is None


def test_metadata_class_order_mismatch_is_refused(tmp_path: Path) -> None:
    metadata_path = tmp_path / "model_metadata.json"
    metadata_path.write_text(
        json.dumps({"model_version": "x", "class_order": ["brown_spot", "leaf_blast"]}),
        encoding="utf-8",
    )

    with pytest.raises(DiseaseV2ModelUnavailableError, match="class order"):
        _read_metadata(metadata_path)


def test_metadata_without_a_version_is_refused(tmp_path: Path) -> None:
    metadata_path = tmp_path / "model_metadata.json"
    metadata_path.write_text(
        json.dumps({"class_order": list(disease_v2_service.taxonomy.CLASS_IDS)}),
        encoding="utf-8",
    )

    with pytest.raises(DiseaseV2ModelUnavailableError, match="model_version"):
        _read_metadata(metadata_path)


def test_metadata_class_count_mismatch_is_refused(tmp_path: Path) -> None:
    metadata_path = tmp_path / "model_metadata.json"
    metadata_path.write_text(
        json.dumps(
            {
                "model_version": "x",
                "num_classes": 6,
                "class_order": list(disease_v2_service.taxonomy.CLASS_IDS),
            }
        ),
        encoding="utf-8",
    )

    with pytest.raises(DiseaseV2ModelUnavailableError, match="6 classes"):
        _read_metadata(metadata_path)


# --- the production contract must not move --------------------------------


def test_v1_endpoints_are_unchanged() -> None:
    status = client.get("/disease/status")
    prediction = client.post(
        "/disease/predict",
        files={"file": ("leaf.jpg", TEST_IMAGE.read_bytes(), "image/jpeg")},
    )

    assert status.status_code == 200
    assert status.json()["classes"] == 6
    assert status.json()["version"] == "rice-disease-v1"

    body = prediction.json()
    assert prediction.status_code == 200
    assert set(body) == {
        "status",
        "disease",
        "confidence",
        "top_predictions",
        "message",
        "model_version",
    }
    assert body["model_version"] == "rice-disease-v1"
    assert set(body["top_predictions"][0]) == {"disease", "confidence"}


def test_regional_baseline_is_unchanged() -> None:
    response = client.get("/regional-baseline")
    assert response.status_code == 200
    assert "yield_kg_per_hectare" in response.json()


@requires_model
def test_v2_prediction_writes_no_model_file() -> None:
    before = _snapshot(PRODUCTION_ARTIFACTS + tuple(MODEL_DIR.glob("*")))

    response = client.post(
        "/disease/v2/predict",
        files={"file": ("leaf.jpg", TEST_IMAGE.read_bytes(), "image/jpeg")},
    )
    assert response.status_code == 200

    after = _snapshot(PRODUCTION_ARTIFACTS + tuple(MODEL_DIR.glob("*")))
    assert after == before
