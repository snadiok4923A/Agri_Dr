"""Shared paths and preprocessing contract for the 15-class pipeline.

The v1 (6-class) artifacts live in ``models/`` and must not be touched.
Every artifact produced by this package goes under
``models/rice_disease_15class/<version>/`` instead.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

SERVICE_ROOT = Path(__file__).resolve().parents[2]
DATASET_ROOT = SERVICE_ROOT / "data" / "rice_disease_15class"
REPORTS_ROOT = SERVICE_ROOT / "reports" / "rice_disease_15class"
SPLIT_DIR = REPORTS_ROOT / "splits"
EVALUATION_DIR = REPORTS_ROOT / "evaluation"
MODEL_ROOT = SERVICE_ROOT / "models" / "rice_disease_15class" / "rice-disease-15class-v2"

#: Version string written into model metadata and ONNX sidecars.
MODEL_VERSION = "rice-disease-15class-v2"

#: Input resolution. Kept at 224 so the documented v1 preprocessing contract
#: (short edge 256, center crop 224, ImageNet normalization) still applies.
IMAGE_SIZE = 224
RESIZE_SIZE = 256
IMAGENET_MEAN = (0.485, 0.456, 0.406)
IMAGENET_STD = (0.229, 0.224, 0.225)

SUPPORTED_EXTENSIONS = frozenset({".jpg", ".jpeg", ".png", ".bmp", ".webp"})

#: Default deterministic seed used by the splitter and the trainer.
DEFAULT_SEED = 42

#: v1 production artifacts — read-only references, never written here.
V1_MODEL_PATH = SERVICE_ROOT / "models" / "rice_disease_model.onnx"
V1_CLASS_PATH = SERVICE_ROOT / "models" / "class_names.json"


def write_json(path: Path, payload: Any) -> Path:
    """Write indented UTF-8 JSON, creating parent directories."""

    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, sort_keys=False) + "\n", encoding="utf-8")
    return path


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))
