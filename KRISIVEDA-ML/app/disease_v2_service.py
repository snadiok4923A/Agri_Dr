"""Lazy, read-only ONNX service for the 15-class Experiment A model.

This module is deliberately separate from :mod:`app.disease_service`, which
serves the production 6-class model on ``/disease/predict``. Nothing here is
imported by that path, and this module never writes a file.

Rules enforced before any inference:

* the model is loaded from an explicit directory
  (``KRISIVEDA_DISEASE_V2_MODEL_DIR``), never from a hardcoded absolute path;
* the class order is read from ``model_metadata.json`` and must match
  :data:`app.rice_disease_15class.taxonomy.CLASS_IDS`;
* the ONNX output width must equal that class count;
* the v2 *development* model directory is refused, so the older 15-class model
  can never be reported as Experiment A;
* preprocessing is the shared, alpha-safe 15-class implementation - the v1
  helper is not copied, because it leaves RGBA images 4-channel.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from io import BytesIO
from pathlib import Path
from typing import Any

import numpy as np
from PIL import Image

from .rice_disease_15class import taxonomy
from .rice_disease_15class.config import MODEL_ROOT as V2_DEVELOPMENT_ROOT
from .rice_disease_15class.inference import MIN_CONFIDENCE
from .rice_disease_15class.preprocess import batch, load_rgb, to_model_tensor

SERVICE_ROOT = Path(__file__).resolve().parent.parent

#: Folder name only in responses; the absolute path never leaves the server.
DEFAULT_MODEL_DIR = (
    SERVICE_ROOT / "models" / "rice_disease_15class" / "rice-disease-15class-v3-exp20"
)
MODEL_DIR_ENV = "KRISIVEDA_DISEASE_V2_MODEL_DIR"

MAX_IMAGE_BYTES = 10 * 1024 * 1024
TOP_K = 3
NUM_CLASSES = taxonomy.NUM_CLASSES

MODEL_NAME = "KRISIVEDA Rice Disease & Pest Classifier"
PRODUCTION = False

OK_MESSAGE = (
    "AI image classification result from the 15-class development model. "
    "Confirm the finding with an agricultural expert before taking treatment decisions."
)
UNCERTAIN_MESSAGE = (
    "The result is uncertain. Please upload a clearer rice-leaf photo or seek advice "
    "from an agricultural expert."
)
DISCLAIMER = (
    "Experimental 15-class model, not the production classifier. A prediction is a "
    "dataset label, not a confirmed agronomic diagnosis."
)


class DiseaseV2ModelUnavailableError(RuntimeError):
    """Raised when the Experiment A model or its metadata cannot be used."""


@dataclass(frozen=True)
class LoadedModel:
    """A validated session plus the metadata it was loaded with."""

    session: Any
    model_version: str
    model_dir: str
    input_name: str
    output_name: str


_cache: dict[str, LoadedModel] = {}


def reset_cache() -> None:
    """Drop the cached session (used by tests and after changing the env var)."""

    _cache.clear()


def model_dir() -> Path:
    """Resolve the configured model directory; relative paths sit under the service."""

    raw = os.getenv(MODEL_DIR_ENV, "").strip()
    if not raw:
        return DEFAULT_MODEL_DIR
    candidate = Path(raw).expanduser()
    return candidate if candidate.is_absolute() else SERVICE_ROOT / candidate


def _read_metadata(metadata_path: Path) -> tuple[str, list[str]]:
    """Return ``(model_version, class_order)`` after validating the metadata."""

    try:
        metadata = json.loads(Path(metadata_path).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise DiseaseV2ModelUnavailableError(
            f"Unable to read model metadata: {metadata_path.name}"
        ) from exc

    model_version = metadata.get("model_version")
    if not isinstance(model_version, str) or not model_version.strip():
        raise DiseaseV2ModelUnavailableError("Model metadata has no model_version.")

    class_order = metadata.get("class_order")
    if not isinstance(class_order, list) or not all(isinstance(item, str) for item in class_order):
        raise DiseaseV2ModelUnavailableError("Model metadata has an invalid class_order.")

    if class_order != list(taxonomy.CLASS_IDS):
        raise DiseaseV2ModelUnavailableError(
            "Model metadata class order does not match the 15-class taxonomy."
        )

    declared = metadata.get("num_classes")
    if declared is not None and declared != NUM_CLASSES:
        raise DiseaseV2ModelUnavailableError(
            f"Model metadata declares {declared} classes, expected {NUM_CLASSES}."
        )

    return model_version.strip(), class_order


def load_model() -> LoadedModel:
    """Load and cache the configured Experiment A model."""

    directory = model_dir()
    key = str(directory.resolve())
    cached = _cache.get(key)
    if cached is not None:
        return cached

    if not directory.is_dir():
        raise DiseaseV2ModelUnavailableError(
            f"15-class model directory not found: {directory.name}"
        )

    if directory.resolve() == V2_DEVELOPMENT_ROOT.resolve():
        raise DiseaseV2ModelUnavailableError(
            "The configured directory holds the v2 development model, not Experiment A. "
            f"Set {MODEL_DIR_ENV} to the rice-disease-15class-v3-exp20 directory."
        )

    onnx_files = sorted(directory.glob("*.onnx"))
    if len(onnx_files) != 1:
        raise DiseaseV2ModelUnavailableError(
            f"Expected exactly one .onnx file in {directory.name}, found {len(onnx_files)}."
        )

    metadata_path = directory / "model_metadata.json"
    if not metadata_path.is_file():
        raise DiseaseV2ModelUnavailableError(
            f"Model metadata not found beside the model: {metadata_path.name}"
        )

    model_version, class_order = _read_metadata(metadata_path)

    try:
        import onnxruntime as ort

        session = ort.InferenceSession(
            str(onnx_files[0]),
            providers=["CPUExecutionProvider"],
        )
    except Exception as exc:  # pragma: no cover - depends on the runtime install
        raise DiseaseV2ModelUnavailableError(
            "Unable to load the 15-class ONNX model."
        ) from exc

    inputs = session.get_inputs()
    outputs = session.get_outputs()
    if len(inputs) != 1 or len(outputs) != 1:
        raise DiseaseV2ModelUnavailableError("Unexpected ONNX input/output count.")
    if outputs[0].shape[-1] != len(class_order):
        raise DiseaseV2ModelUnavailableError(
            "ONNX output width does not match the class mapping."
        )

    loaded = LoadedModel(
        session=session,
        model_version=model_version,
        model_dir=directory.name,
        input_name=inputs[0].name,
        output_name=outputs[0].name,
    )
    _cache[key] = loaded
    return loaded


def get_disease_v2_model_status() -> dict[str, Any]:
    """Status payload for ``GET /disease/v2/status`` (folder name, never a path)."""

    try:
        loaded = load_model()
    except DiseaseV2ModelUnavailableError as exc:
        return {
            "available": False,
            "model": MODEL_NAME,
            "model_version": None,
            "classes": 0,
            "threshold": MIN_CONFIDENCE,
            "model_dir": model_dir().name,
            "production": PRODUCTION,
            "message": str(exc),
        }

    return {
        "available": True,
        "model": MODEL_NAME,
        "model_version": loaded.model_version,
        "classes": NUM_CLASSES,
        "threshold": MIN_CONFIDENCE,
        "model_dir": loaded.model_dir,
        "production": PRODUCTION,
        "message": (
            "15-class development model loaded. This is not the production "
            "6-class classifier."
        ),
    }


def _decode_image(image_bytes: bytes) -> Image.Image:
    """Validate the upload, then return an upright 3-channel RGB image."""

    try:
        with Image.open(BytesIO(image_bytes)) as probe:
            probe.verify()  # detects truncated files; leaves the image unusable
            if probe.format not in {"JPEG", "PNG", "WEBP"}:
                raise ValueError("Unsupported image format.")
        return load_rgb(BytesIO(image_bytes))
    except (OSError, ValueError, Image.DecompressionBombError) as exc:
        raise ValueError("Invalid image. Upload a valid JPG, PNG or WEBP photo.") from exc


def _probabilities_from_logits(logits: np.ndarray) -> np.ndarray:
    if logits.ndim != 1 or logits.size != NUM_CLASSES:
        raise RuntimeError("Model produced an invalid output shape.")
    if not np.isfinite(logits).all():
        raise RuntimeError("Model produced invalid numeric output.")
    shifted = logits - np.max(logits)
    probabilities = np.exp(shifted)
    return probabilities / probabilities.sum()


def _prediction(class_id: str, confidence: float) -> dict[str, Any]:
    """One top prediction; ``disease`` keeps the existing frontend working."""

    spec = taxonomy.get_spec(class_id)
    return {
        "class_id": spec.class_id,
        "display_name": spec.display_name,
        "disease": spec.display_name,
        "category": spec.category,
        "confidence": round(float(confidence), 4),
    }


def analyze_disease_v2_image(image_bytes: bytes, top_k: int = TOP_K) -> dict[str, Any]:
    """Classify one image with Experiment A. Returns ``ok`` or ``uncertain``."""

    if not image_bytes:
        raise ValueError("No image was provided.")
    if len(image_bytes) > MAX_IMAGE_BYTES:
        raise ValueError("Image exceeds the 10 MB upload limit.")

    with _decode_image(image_bytes) as image:
        tensor = batch(to_model_tensor(image))

    loaded = load_model()

    logits = loaded.session.run(
        [loaded.output_name],
        {loaded.input_name: tensor},
    )[0][0]
    probabilities = _probabilities_from_logits(logits)

    ranked = np.argsort(probabilities)[::-1][: max(1, top_k)]
    class_ids = list(taxonomy.CLASS_IDS)
    top_predictions = [
        _prediction(class_ids[int(index)], float(probabilities[index])) for index in ranked
    ]

    best_id = class_ids[int(ranked[0])]
    confidence = round(float(probabilities[int(ranked[0])]), 4)
    accepted = confidence >= MIN_CONFIDENCE

    payload: dict[str, Any] = {
        "status": "ok" if accepted else "uncertain",
        "class_id": best_id if accepted else None,
        "display_name": top_predictions[0]["display_name"] if accepted else None,
        "disease": top_predictions[0]["disease"] if accepted else None,
        "category": top_predictions[0]["category"] if accepted else None,
        "confidence": confidence,
        "top_predictions": top_predictions,
        "message": OK_MESSAGE if accepted else UNCERTAIN_MESSAGE,
        "model_version": loaded.model_version,
        "classes_total": NUM_CLASSES,
        "threshold": MIN_CONFIDENCE,
        "disclaimer": DISCLAIMER,
    }
    return payload
