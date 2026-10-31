"""ONNX export and PyTorch/ONNX parity checks for the 15-class model.

Every output path is supplied by the caller, so an experiment can be exported
next to its own checkpoint without touching the v2 artefacts. The production
6-class ``models/rice_disease_model.onnx`` is never opened for writing.
"""

from __future__ import annotations

import hashlib
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Sequence

from . import taxonomy
from .config import (
    DATASET_ROOT,
    IMAGE_SIZE,
    IMAGENET_MEAN,
    IMAGENET_STD,
    MODEL_ROOT,
    MODEL_VERSION,
    RESIZE_SIZE,
    V1_MODEL_PATH,
    write_json,
)
from .data import ManifestRow


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with Path(path).open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def preprocessing_contract(image_size: int = IMAGE_SIZE) -> dict[str, Any]:
    return {
        "color_mode": "RGB",
        "exif_transpose": True,
        "resize": {"short_edge": RESIZE_SIZE, "interpolation": "bilinear"},
        "center_crop": image_size,
        "scale": "pixel / 255.0",
        "normalization": {
            "mean": list(IMAGENET_MEAN),
            "std": list(IMAGENET_STD),
            "channel_order": "RGB",
        },
        "layout": "NCHW",
        "dtype": "float32",
        "batch": "dynamic",
    }


def export_onnx(
    checkpoint_path: Path = MODEL_ROOT / "best.pt",
    output_path: Path = MODEL_ROOT / "rice_disease_15class.onnx",
    opset: int = 17,
    image_size: int = IMAGE_SIZE,
) -> dict[str, Any]:
    """Export the checkpoint and verify the ONNX graph loads on CPU."""

    import torch

    from .model import build_model

    checkpoint_path = Path(checkpoint_path)
    if not checkpoint_path.is_file():
        raise FileNotFoundError(f"Checkpoint not found: {checkpoint_path}")
    if Path(output_path).resolve() == V1_MODEL_PATH.resolve():
        raise ValueError("Refusing to overwrite the production 6-class ONNX model.")

    checkpoint = torch.load(checkpoint_path, map_location="cpu", weights_only=False)
    if checkpoint.get("class_ids") != list(taxonomy.CLASS_IDS):
        raise ValueError("Checkpoint class order does not match the 15-class taxonomy.")

    model = build_model(taxonomy.NUM_CLASSES, pretrained=False)
    model.load_state_dict(checkpoint["model_state"])
    model.eval()

    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    dummy = torch.zeros(1, 3, image_size, image_size, dtype=torch.float32)
    export_kwargs = {
        "input_names": ["images"],
        "output_names": ["logits"],
        "dynamic_axes": {"images": {0: "batch"}, "logits": {0: "batch"}},
        "opset_version": opset,
        "do_constant_folding": True,
    }
    try:
        # Newer torch versions default to the dynamo exporter, which ignores
        # ``dynamic_axes``. Pin the TorchScript exporter for a stable contract.
        torch.onnx.export(model, dummy, str(output_path), dynamo=False, **export_kwargs)
    except TypeError:  # pragma: no cover - older torch without the flag
        torch.onnx.export(model, dummy, str(output_path), **export_kwargs)

    import onnxruntime as ort

    session = ort.InferenceSession(str(output_path), providers=["CPUExecutionProvider"])
    input_meta = session.get_inputs()[0]
    output_meta = session.get_outputs()[0]
    if input_meta.name != "images" or output_meta.name != "logits":
        raise RuntimeError(f"Unexpected ONNX names: {input_meta.name} -> {output_meta.name}")
    if output_meta.shape[-1] != taxonomy.NUM_CLASSES:
        raise RuntimeError(f"ONNX output width {output_meta.shape[-1]} != {taxonomy.NUM_CLASSES}")

    return {
        "onnx_path": str(output_path),
        "opset": opset,
        "input_name": input_meta.name,
        "input_shape": input_meta.shape,
        "input_type": input_meta.type,
        "output_name": output_meta.name,
        "output_shape": output_meta.shape,
        "output_type": output_meta.type,
        "bytes": output_path.stat().st_size,
        "sha256": _sha256(output_path),
        "providers": session.get_providers(),
        "checkpoint": str(checkpoint_path),
        "checkpoint_epoch": checkpoint.get("epoch"),
    }


def check_parity(
    checkpoint_path: Path,
    onnx_path: Path,
    rows: Sequence[ManifestRow],
    dataset_root: Path = DATASET_ROOT,
    sample_size: int = 128,
    image_size: int = IMAGE_SIZE,
    atol: float = 1e-4,
) -> dict[str, Any]:
    """Compare PyTorch and ONNX Runtime logits on identical preprocessed tensors."""

    import numpy as np
    import onnxruntime as ort
    import torch

    from .data import ManifestDataset
    from .model import build_model

    checkpoint = torch.load(Path(checkpoint_path), map_location="cpu", weights_only=False)
    model = build_model(taxonomy.NUM_CLASSES, pretrained=False)
    model.load_state_dict(checkpoint["model_state"])
    model.eval()

    sample = list(rows)[:sample_size]
    dataset = ManifestDataset(sample, root=dataset_root, train=False, image_size=image_size)
    tensors = torch.stack([dataset[index][0] for index in range(len(sample))])

    with torch.no_grad():
        torch_logits = model(tensors).numpy()

    session = ort.InferenceSession(str(onnx_path), providers=["CPUExecutionProvider"])
    input_name = session.get_inputs()[0].name
    output_name = session.get_outputs()[0].name
    onnx_logits = session.run([output_name], {input_name: tensors.numpy()})[0]

    absolute = np.abs(torch_logits - onnx_logits)
    torch_probs = torch.softmax(torch.from_numpy(torch_logits), dim=1).numpy()
    onnx_probs = torch.softmax(torch.from_numpy(onnx_logits), dim=1).numpy()

    return {
        "checked_at": datetime.now(timezone.utc).isoformat(),
        "samples": len(sample),
        "max_abs_logit_difference": float(absolute.max()) if absolute.size else 0.0,
        "mean_abs_logit_difference": float(absolute.mean()) if absolute.size else 0.0,
        "max_abs_probability_difference": float(np.abs(torch_probs - onnx_probs).max()) if absolute.size else 0.0,
        "predicted_class_agreement": float(
            np.mean(torch_logits.argmax(axis=1) == onnx_logits.argmax(axis=1))
        )
        if len(sample)
        else 1.0,
        "all_within_atol": bool(absolute.size and absolute.max() <= atol),
        "atol": atol,
        "input_signature": {
            "name": input_name,
            "shape": session.get_inputs()[0].shape,
            "type": session.get_inputs()[0].type,
        },
        "output_signature": {
            "name": output_name,
            "shape": session.get_outputs()[0].shape,
            "type": session.get_outputs()[0].type,
        },
        "preprocessing_identical": True,
        "notes": [
            "Both runtimes consumed the exact same float32 tensor, so any difference is numeric only.",
            "ONNX Runtime used the CPU execution provider.",
        ],
    }


def write_metadata(
    export_info: dict[str, Any],
    parity: dict[str, Any] | None,
    output_path: Path = MODEL_ROOT / "model_metadata.json",
    training_config: dict[str, Any] | None = None,
    model_version: str | None = None,
) -> dict[str, Any]:
    payload = {
        "model_version": model_version or MODEL_VERSION,
        "architecture": "mobilenet_v3_small",
        "task": "15-class rice disease & pest image classification",
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "onnx": export_info,
        "class_order": list(taxonomy.CLASS_IDS),
        "num_classes": taxonomy.NUM_CLASSES,
        "class_display_names": {spec.class_id: spec.display_name for spec in taxonomy.TAXONOMY},
        "class_categories": {spec.class_id: spec.category for spec in taxonomy.TAXONOMY},
        "preprocessing": preprocessing_contract(),
        "parity": parity,
        "training_config": training_config,
        "production_status": "development — NOT wired into app.main",
        "rollback": (
            "Delete the experiment directory under models/rice_disease_15class/; "
            "the 6-class service and the v2 15-class artifacts are untouched."
        ),
    }
    write_json(Path(output_path), payload)
    return payload
