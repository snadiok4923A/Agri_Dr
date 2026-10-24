
"""ONNX inference service for KRISIVEDA rice disease recognition."""

import json
from pathlib import Path

import numpy as np
import onnxruntime as ort
from PIL import Image, ImageOps


SERVICE_ROOT = Path(__file__).resolve().parent.parent
MODEL_PATH = SERVICE_ROOT / "models" / "rice_disease_model.onnx"
CLASS_PATH = SERVICE_ROOT / "models" / "class_names.json"

IMAGE_SIZE = 224
MAX_IMAGE_BYTES = 10 * 1024 * 1024  # 10 MB
MIN_CONFIDENCE = 0.60

_session = None
_class_names = None


class DiseaseModelUnavailableError(RuntimeError):
    """Raised when the disease model or class mapping is unavailable."""


def _load_model():
    global _session, _class_names

    if _session is not None and _class_names is not None:
        return _session, _class_names

    if not MODEL_PATH.is_file():
        raise DiseaseModelUnavailableError(
            f"Disease model file not found: {MODEL_PATH}"
        )

    if not CLASS_PATH.is_file():
        raise DiseaseModelUnavailableError(
            f"Disease class mapping not found: {CLASS_PATH}"
        )

    try:
        with CLASS_PATH.open("r", encoding="utf-8") as file:
            class_names = json.load(file)

        if (
            not isinstance(class_names, list)
            or not class_names
            or not all(isinstance(name, str) for name in class_names)
        ):
            raise ValueError("Invalid class_names.json format.")

        session = ort.InferenceSession(
            str(MODEL_PATH),
            providers=["CPUExecutionProvider"],
        )

        inputs = session.get_inputs()
        outputs = session.get_outputs()

        if len(inputs) != 1 or len(outputs) != 1:
            raise ValueError("Unexpected ONNX input/output count.")

        if len(class_names) != outputs[0].shape[-1]:
            raise ValueError("Class count does not match model output.")

        _session = session
        _class_names = class_names

        return _session, _class_names

    except DiseaseModelUnavailableError:
        raise
    except Exception as exc:
        raise DiseaseModelUnavailableError(
            "Unable to load the disease recognition model."
        ) from exc


def get_disease_model_status() -> dict:
    try:
        session, class_names = _load_model()
        return {
            "available": True,
            "model": "KRISIVEDA Rice Disease Classifier",
            "version": "rice-disease-v1",
            "classes": len(class_names),
            "message": "Disease model loaded successfully.",
        }
    except DiseaseModelUnavailableError:
        return {
            "available": False,
            "model": "KRISIVEDA Rice Disease Classifier",
            "version": "rice-disease-v1",
            "classes": 0,
            "message": "Disease model is unavailable.",
        }


def _preprocess_image(image: Image.Image) -> np.ndarray:
    """Match the model's RGB, resize, crop and ImageNet normalization."""

    image = ImageOps.exif_transpose(image).convert("RGB")

    width, height = image.size
    if width < 32 or height < 32:
        raise ValueError("Image is too small. Upload a clearer photo.")

    # Resize the shorter edge to 256, preserving aspect ratio.
    new_width = round(width * 256 / min(width, height))
    new_height = round(height * 256 / min(width, height))

    image = image.resize(
        (new_width, new_height),
        resample=Image.Resampling.BILINEAR,
    )

    left = (new_width - IMAGE_SIZE) // 2
    top = (new_height - IMAGE_SIZE) // 2

    image = image.crop((
        left,
        top,
        left + IMAGE_SIZE,
        top + IMAGE_SIZE,
    ))

    array = np.asarray(image, dtype=np.float32) / 255.0

    mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
    std = np.array([0.229, 0.224, 0.225], dtype=np.float32)

    array = (array - mean) / std
    array = np.transpose(array, (2, 0, 1))
    return np.expand_dims(array, axis=0).astype(np.float32)


def analyze_disease_image(image_bytes: bytes) -> dict:
    if not image_bytes:
        raise ValueError("No image was provided.")

    if len(image_bytes) > MAX_IMAGE_BYTES:
        raise ValueError("Image exceeds the 10 MB upload limit.")

    session, class_names = _load_model()

    try:
        from io import BytesIO

        with Image.open(BytesIO(image_bytes)) as image:
            tensor = _preprocess_image(image)

    except (ValueError, OSError) as exc:
        raise ValueError(
            "Invalid image. Upload a valid JPG, PNG or WEBP photo."
        ) from exc

    input_name = session.get_inputs()[0].name
    output_name = session.get_outputs()[0].name

    logits = session.run(
        [output_name],
        {input_name: tensor},
    )[0][0]

    if not np.isfinite(logits).all():
        raise RuntimeError("Model produced invalid numeric output.")

    # Convert logits to probabilities.
    shifted = logits - np.max(logits)
    probabilities = np.exp(shifted)
    probabilities = probabilities / probabilities.sum()

    ranked = np.argsort(probabilities)[::-1]
    best_index = int(ranked[0])
    confidence = float(probabilities[best_index])

    top_predictions = [
        {
            "disease": class_names[int(index)],
            "confidence": round(float(probabilities[index]), 4),
        }
        for index in ranked[:3]
    ]

    if confidence < MIN_CONFIDENCE:
        return {
            "status": "uncertain",
            "disease": None,
            "confidence": round(confidence, 4),
            "top_predictions": top_predictions,
            "message": (
                "The result is uncertain. Please upload a clearer rice-leaf "
                "photo or seek advice from an agricultural expert."
            ),
            "model_version": "rice-disease-v1",
        }

    return {
        "status": "ok",
        "disease": class_names[best_index],
        "confidence": round(confidence, 4),
        "top_predictions": top_predictions,
        "message": (
            "AI image classification result. Confirm the diagnosis "
            "before taking treatment decisions."
        ),
        "model_version": "rice-disease-v1",
    }
