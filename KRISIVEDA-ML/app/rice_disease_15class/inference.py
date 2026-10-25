"""Optional ONNX inference helper for the 15-class model.

**Not imported by ``app.main``.** The production API still serves the
6-class model. This module exists so the new model can be smoke-tested and,
later, reviewed for integration without duplicating preprocessing logic.

Preprocessing is the v1 contract (EXIF transpose, RGB, short edge 256,
center crop 224, /255, ImageNet normalization, NCHW) and is implemented once
in :mod:`app.rice_disease_15class.preprocess`, shared with evaluation.
"""

from __future__ import annotations

import json
from io import BytesIO
from pathlib import Path
from typing import Any

import numpy as np
from PIL import Image

from . import taxonomy
from .config import MODEL_ROOT, MODEL_VERSION
from .preprocess import batch, load_rgb, to_model_tensor

V2_MODEL_PATH = MODEL_ROOT / "rice_disease_15class.onnx"
V2_METADATA_PATH = MODEL_ROOT / "model_metadata.json"
MIN_CONFIDENCE = 0.60
MAX_IMAGE_BYTES = 10 * 1024 * 1024

_cache: dict[str, Any] = {}


class V2ModelUnavailableError(RuntimeError):
    """Raised when the 15-class ONNX model or its metadata is unavailable."""


def load_model():
    """Load and cache the ONNX session + validated class order."""

    if "session" in _cache:
        return _cache["session"], _cache["class_ids"], _cache["display_names"], _cache["categories"]

    if not V2_MODEL_PATH.is_file():
        raise V2ModelUnavailableError(f"15-class ONNX model not found: {V2_MODEL_PATH}")
    if not V2_METADATA_PATH.is_file():
        raise V2ModelUnavailableError(f"Model metadata not found: {V2_METADATA_PATH}")

    import onnxruntime as ort

    metadata = json.loads(V2_METADATA_PATH.read_text(encoding="utf-8"))
    class_ids = list(metadata.get("class_order") or [])
    if class_ids != list(taxonomy.CLASS_IDS):
        raise V2ModelUnavailableError("ONNX metadata class order does not match the 15-class taxonomy.")

    session = ort.InferenceSession(str(V2_MODEL_PATH), providers=["CPUExecutionProvider"])
    if session.get_outputs()[0].shape[-1] != len(class_ids):
        raise V2ModelUnavailableError("ONNX output width does not match the class mapping.")

    _cache["session"] = session
    _cache["class_ids"] = class_ids
    _cache["display_names"] = dict(metadata.get("class_display_names") or {})
    _cache["categories"] = dict(metadata.get("class_categories") or {})
    return session, class_ids, _cache["display_names"], _cache["categories"]


def preprocess_image(image: Image.Image) -> np.ndarray:
    """Deterministic model input; identical to evaluation and ONNX parity."""

    return batch(to_model_tensor(image))


def _decode(image_bytes: bytes) -> Image.Image:
    """Validate the bytes, then hand back an upright 3-channel RGB image.

    Decoding must go through :func:`load_rgb` (EXIF transpose + alpha
    compositing). Opening the file directly left RGBA PNGs 4-channel and broke
    normalization with a shape error.
    """

    try:
        with Image.open(BytesIO(image_bytes)) as probe:
            probe.verify()  # detects truncated/corrupt files but leaves the image unusable
            if probe.format not in {"JPEG", "PNG", "WEBP"}:
                raise ValueError("Unsupported image format.")
        return load_rgb(BytesIO(image_bytes))
    except (OSError, ValueError, Image.DecompressionBombError) as exc:
        raise ValueError("Invalid image. Upload a valid JPG, PNG or WEBP photo.") from exc


def analyze_image(image_bytes: bytes) -> dict[str, Any]:
    """Classify one image. Returns ``ok`` or ``uncertain`` — never a guess."""

    if not image_bytes:
        raise ValueError("No image was provided.")
    if len(image_bytes) > MAX_IMAGE_BYTES:
        raise ValueError("Image exceeds the 10 MB upload limit.")

    with _decode(image_bytes) as image:
        tensor = preprocess_image(image)

    session, class_ids, display_names, categories = load_model()
    logits = session.run(
        [session.get_outputs()[0].name],
        {session.get_inputs()[0].name: tensor},
    )[0][0]
    shifted = logits - np.max(logits)
    probabilities = np.exp(shifted) / np.exp(shifted).sum()
    ranked = np.argsort(probabilities)[::-1]
    best = int(ranked[0])
    confidence = float(probabilities[best])

    top_predictions = [
        {
            "class_id": class_ids[int(index)],
            "display_name": display_names.get(class_ids[int(index)], class_ids[int(index)]),
            "category": categories.get(class_ids[int(index)], "unknown"),
            "confidence": round(float(probabilities[index]), 4),
        }
        for index in ranked[:3]
    ]

    payload: dict[str, Any] = {
        "status": "ok" if confidence >= MIN_CONFIDENCE else "uncertain",
        "class_id": class_ids[best] if confidence >= MIN_CONFIDENCE else None,
        "display_name": display_names.get(class_ids[best]) if confidence >= MIN_CONFIDENCE else None,
        "category": categories.get(class_ids[best]) if confidence >= MIN_CONFIDENCE else None,
        "confidence": round(confidence, 4),
        "top_predictions": top_predictions,
        "model_version": MODEL_VERSION,
        "disclaimer": (
            "AI image classification result. Confirm the diagnosis before taking treatment decisions."
        ),
    }
    if payload["status"] == "uncertain":
        payload["message"] = (
            "The result is uncertain. Please upload a clearer rice-leaf photo or seek advice "
            "from an agricultural expert."
        )
    return payload


def status() -> dict[str, Any]:
    try:
        _, class_ids, _, _ = load_model()
        return {
            "available": True,
            "model_version": MODEL_VERSION,
            "classes": len(class_ids),
            "message": "15-class development model loaded (not served by the API).",
        }
    except V2ModelUnavailableError as exc:
        return {
            "available": False,
            "model_version": MODEL_VERSION,
            "classes": 0,
            "message": str(exc),
        }
