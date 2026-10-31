"""Read-only root-cause audit for ``rice-disease-15class-v3-exp20``.

Nothing here trains, relabels, moves or overwrites anything. The only writes go
to a dedicated audit directory (``reports/rice_disease_15class/audit_root_cause``
by default). The production 6-class model and API are never imported.

What it checks, in the order of the audit request:

A. Reproduction -- class mapping, display names, categories, threshold, the
   exact preprocessing used by training-eval vs inference, and ONNX vs PyTorch
   agreement on real test images.
B. Dataset performance -- the held-out test split scored once, with per-class
   precision/recall/F1, a normalised confusion matrix, confidence distributions
   for correct and incorrect predictions, and results by image format.
C. Leakage -- whether any duplicate cluster (dhash/tight thumbnail cluster from
   the dataset audit) appears in more than one split.
D. Personal photos -- top-5 probabilities, threshold verdict, image property
   checks and the nearest dataset image, with no assumption that the photos are
   labelled correctly.

    python scripts/audit_root_cause_15class.py

    python scripts/audit_root_cause_15class.py ^
        --photos "C:\\Users\\me\\Pictures\\PICS\\23.jpg" ... ^
        --output-dir reports\\rice_disease_15class\\audit_root_cause
"""

from __future__ import annotations

import argparse
import csv
import json
import statistics
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable, Sequence

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.rice_disease_15class import taxonomy  # noqa: E402
from app.rice_disease_15class.audit import _difference_hash  # noqa: E402
from app.rice_disease_15class.config import (  # noqa: E402
    DATASET_ROOT,
    MODEL_ROOT,
    SERVICE_ROOT,
    SPLIT_DIR,
    MODEL_VERSION as CONFIG_MODEL_VERSION,
)
from app.rice_disease_15class.data import build_transforms, read_manifest  # noqa: E402
from app.rice_disease_15class.inference import MIN_CONFIDENCE  # noqa: E402
from app.rice_disease_15class.preprocess import (  # noqa: E402
    DRAFT_SIZE,
    batch,
    load_rgb,
    to_model_tensor,
)

CANDIDATE_DIR = SERVICE_ROOT / "models" / "rice_disease_15class" / "rice-disease-15class-v3-exp20"
AUDIT_DIR = SERVICE_ROOT / "reports" / "rice_disease_15class" / "audit_root_cause"
INDEX_PATH = SERVICE_ROOT / "reports" / "rice_disease_15class" / "dataset_index.csv"

#: Photos from the bug report; 24.png is intentionally absent (the report lists
#: 26.png). Nothing is substituted: a missing file is reported as missing.
DEFAULT_PHOTOS = [
    r"C:\Users\Sandipan Paul\Pictures\PICS\23.jpg",
    r"C:\Users\Sandipan Paul\Pictures\PICS\24.jpg",
    r"C:\Users\Sandipan Paul\Pictures\PICS\25.jpg",
    r"C:\Users\Sandipan Paul\Pictures\PICS\26.jpg",
    r"C:\Users\Sandipan Paul\Pictures\PICS\26.png",
    r"C:\Users\Sandipan Paul\Pictures\PICS\27.webp",
    r"C:\Users\Sandipan Paul\Pictures\PICS\28.jpg",
]

MAX_IMAGE_BYTES = 10 * 1024 * 1024


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")


def write_csv(path: Path, rows: Sequence[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = list(rows[0].keys()) if rows else ["empty"]
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow(row)


# --------------------------------------------------------------------------- A


def check_mapping(metadata_path: Path) -> dict[str, Any]:
    """Verify the ONNX metadata against the taxonomy the API actually uses."""

    metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
    class_order = list(metadata.get("class_order") or [])
    display = dict(metadata.get("class_display_names") or {})
    categories = dict(metadata.get("class_categories") or {})

    display_mismatches = []
    category_mismatches = []
    for class_id in class_order:
        spec = taxonomy.get_spec(class_id)
        if display.get(class_id) != spec.display_name:
            display_mismatches.append(
                {"class_id": class_id, "metadata": display.get(class_id), "api": spec.display_name}
            )
        if categories.get(class_id) != spec.category:
            category_mismatches.append(
                {"class_id": class_id, "metadata": categories.get(class_id), "api": spec.category}
            )

    return {
        "metadata_path": str(metadata_path),
        "model_version": metadata.get("model_version"),
        "num_classes": metadata.get("num_classes"),
        "class_order_matches_taxonomy": class_order == list(taxonomy.CLASS_IDS),
        "class_order": class_order,
        "display_name_mismatches": display_mismatches,
        "category_mismatches": category_mismatches,
        "categories": categories,
        "threshold_used_by_api": MIN_CONFIDENCE,
        "threshold_applied_to": "softmax probability of the top class",
        "evaluate_py_hardcoded_model_version": CONFIG_MODEL_VERSION,
        "evaluate_py_version_matches_metadata": CONFIG_MODEL_VERSION
        == metadata.get("model_version"),
        "export_block": metadata.get("onnx", {}),
        "preprocessing_block": metadata.get("preprocessing", {}),
    }


def check_preprocessing(probe_image: Path) -> dict[str, Any]:
    """Prove that eval/test and inference use one implementation, not two."""

    image = load_rgb(probe_image)
    try:
        eval_transform = build_transforms(train=False)
        deterministic = eval_transform(image)
        direct = to_model_tensor(image)
        eval_tensor = np.asarray(deterministic, dtype=np.float32)
        max_diff = float(np.abs(eval_tensor - direct).max())

        train_transform = build_transforms(train=True)
        train_ops = [type(op).__name__ for op in getattr(train_transform, "transforms", [])]

        resized = image.resize((max(1, round(image.width * 256 / min(image.size))),
                                max(1, round(image.height * 256 / min(image.size)))))
        aspect = image.width / image.height
        return {
            "probe_image": str(probe_image),
            "probe_size": [image.width, image.height],
            "probe_aspect_ratio": round(aspect, 4),
            "probe_after_resize_short_edge_256": [resized.width, resized.height],
            "eval_transform_class": type(eval_transform).__name__,
            "eval_transform_is_shared_preprocess": type(eval_transform).__name__
            == "DeterministicTransform",
            "max_abs_diff_eval_vs_inference_preprocess": max_diff,
            "eval_matches_inference_preprocess": max_diff == 0.0,
            "training_transform_ops": train_ops,
            "jpeg_draft_size": DRAFT_SIZE,
            "exif_transpose": True,
            "alpha_composited_on_white": True,
            "normalization": {
                "scale": "pixel / 255.0",
                "mean": [0.485, 0.456, 0.406],
                "std": [0.229, 0.224, 0.225],
                "layout": "NCHW",
            },
            "training_vs_eval_geometry_note": (
                "Training uses RandomResizedCrop(224, scale=(0.65,1.0)) straight to 224x224; "
                "eval/inference use short-edge 256 then centre-crop 224. Same colour contract, "
                "different framing statistics - a documented train/eval convention, not a "
                "normalisation mismatch."
            ),
        }
    finally:
        image.close()


def open_session(onnx_path: Path):
    import onnxruntime as ort

    return ort.InferenceSession(str(onnx_path), providers=["CPUExecutionProvider"])


def predict_logits(session, tensor: np.ndarray) -> np.ndarray:
    return session.run(
        [session.get_outputs()[0].name], {session.get_inputs()[0].name: tensor}
    )[0]


def softmax(logits: np.ndarray) -> np.ndarray:
    shifted = logits - np.max(logits, axis=-1, keepdims=True)
    exp = np.exp(shifted)
    return exp / exp.sum(axis=-1, keepdims=True)


def tensors_for(
    paths: Iterable[Path | str], dataset_root: Path
) -> tuple[np.ndarray, list[Path], list[str]]:
    """Load images into one (N, 3, 224, 224) float32 array; skip unreadable files."""

    arrays: list[np.ndarray] = []
    kept: list[Path] = []
    errors: list[str] = []
    for raw in paths:
        path = Path(raw)
        try:
            image = load_rgb(path if path.is_absolute() else dataset_root / path)
            try:
                arrays.append(to_model_tensor(image))
            finally:
                image.close()
            kept.append(path)
        except (OSError, ValueError) as exc:  # pragma: no cover - defensive
            errors.append(f"{path}: {exc}")
    return np.stack(arrays).astype(np.float32) if arrays else np.empty((0, 3, 224, 224), np.float32), kept, errors


def check_parity(
    checkpoint_path: Path, onnx_path: Path, sample_paths: Sequence[Path], dataset_root: Path
) -> dict[str, Any]:
    """Re-run the PyTorch vs ONNX comparison instead of trusting the stored JSON."""

    import torch

    from app.rice_disease_15class.model import build_model

    checkpoint = torch.load(checkpoint_path, map_location="cpu", weights_only=False)
    model = build_model(taxonomy.NUM_CLASSES, pretrained=False)
    model.load_state_dict(checkpoint["model_state"])
    model.eval()

    tensors, kept, errors = tensors_for(sample_paths, dataset_root)
    if not len(kept):
        return {"error": "no readable sample images", "errors": errors}

    session = open_session(onnx_path)
    onnx_logits = predict_logits(session, tensors)
    with torch.no_grad():
        torch_logits = model(torch.from_numpy(tensors)).numpy()

    p_torch = softmax(torch_logits)
    p_onnx = softmax(onnx_logits)
    agreement = float((p_torch.argmax(1) == p_onnx.argmax(1)).mean())
    checkpoint_class_ids = checkpoint.get("class_ids")

    return {
        "checkpoint": str(checkpoint_path),
        "onnx": str(onnx_path),
        "samples": int(len(kept)),
        "unreadable": errors,
        "checkpoint_class_order_matches_taxonomy": checkpoint_class_ids
        == list(taxonomy.CLASS_IDS),
        "checkpoint_epoch": checkpoint.get("epoch"),
        "checkpoint_image_size": checkpoint.get("image_size"),
        "max_abs_logit_difference": float(np.abs(torch_logits - onnx_logits).max()),
        "max_abs_probability_difference": float(np.abs(p_torch - p_onnx).max()),
        "predicted_class_agreement": agreement,
        "atol": 1e-4,
        "all_within_atol": bool(
            np.allclose(torch_logits, onnx_logits, atol=1e-4, rtol=0.0)
        ),
        "preprocessing_shared_between_runtimes": True,
        "note": (
            "Both runtimes consumed the identical float32 tensor produced by "
            "app.rice_disease_15class.preprocess.to_model_tensor."
        ),
    }


# --------------------------------------------------------------------------- B


def score_test_split(
    onnx_path: Path, test_manifest: Path, dataset_root: Path, batch_size: int = 32
) -> dict[str, Any]:
    """Score every test image once with the exported ONNX model."""

    from sklearn.metrics import (
        accuracy_score,
        balanced_accuracy_score,
        classification_report,
        confusion_matrix,
        precision_recall_fscore_support,
    )

    rows = read_manifest(test_manifest)
    class_ids = list(taxonomy.CLASS_IDS)
    index_of = {class_id: position for position, class_id in enumerate(class_ids)}

    session = open_session(onnx_path)
    row_by_path = {Path(row.relative_path).as_posix(): row for row in rows}
    y_true: list[int] = []
    y_pred: list[int] = []
    confidences: list[float] = []
    files: list[str] = []
    labels: list[str] = []
    unreadable: list[str] = []

    for start in range(0, len(rows), batch_size):
        chunk = rows[start : start + batch_size]
        tensors, kept, errors = tensors_for([row.relative_path for row in chunk], dataset_root)
        unreadable.extend(errors)
        if not len(kept):
            continue
        probabilities = softmax(predict_logits(session, tensors))
        predictions = probabilities.argmax(1)
        for offset, path in enumerate(kept):
            row = row_by_path[path.as_posix()]
            files.append(path.as_posix())
            labels.append(row.class_id)
            y_true.append(index_of[row.class_id])
            y_pred.append(int(predictions[offset]))
            confidences.append(float(probabilities[offset].max()))
        if start and start % 2000 == 0:
            print(f"  scored {start}/{len(rows)}", flush=True)

    truth = np.asarray(y_true)
    predicted = np.asarray(y_pred)
    confidence = np.asarray(confidences, dtype=float)
    correct = truth == predicted
    label_range = list(range(len(class_ids)))

    precision, recall, f1, support = precision_recall_fscore_support(
        truth, predicted, labels=label_range, zero_division=0
    )
    matrix = confusion_matrix(truth, predicted, labels=label_range)
    report = classification_report(
        truth, predicted, labels=label_range, target_names=class_ids,
        output_dict=True, zero_division=0,
    )

    per_class = []
    for position, class_id in enumerate(class_ids):
        mask = truth == position
        accepted = mask & (confidence >= MIN_CONFIDENCE)
        per_class.append(
            {
                "class_id": class_id,
                "support": int(support[position]),
                "precision": round(float(precision[position]), 4),
                "recall": round(float(recall[position]), 4),
                "f1": round(float(f1[position]), 4),
                "mean_confidence": round(float(confidence[mask].mean()), 4) if mask.any() else None,
                "coverage_at_threshold": round(float(accepted.sum() / mask.sum()), 4)
                if mask.any()
                else None,
                "accuracy_on_accepted": round(float(correct[accepted].mean()), 4)
                if accepted.any()
                else None,
            }
        )

    confusions = []
    for t_index in label_range:
        for p_index in label_range:
            if t_index == p_index:
                continue
            count = int(matrix[t_index, p_index])
            if count:
                confusions.append(
                    {
                        "true_class": class_ids[t_index],
                        "predicted_class": class_ids[p_index],
                        "count": count,
                        "share_of_true_class": round(count / max(int(support[t_index]), 1), 4),
                    }
                )
    confusions.sort(key=lambda row: (-row["count"], row["true_class"], row["predicted_class"]))

    normalised = []
    for t_index, class_id in enumerate(class_ids):
        total = int(matrix[t_index].sum())
        normalised.append(
            {
                "true_class": class_id,
                "support": total,
                **{
                    class_ids[p_index]: (round(int(matrix[t_index, p_index]) / total, 4) if total else 0.0)
                    for p_index in label_range
                },
            }
        )

    def distribution(values: np.ndarray) -> dict[str, Any]:
        if not values.size:
            return {"count": 0}
        return {
            "count": int(values.size),
            "mean": round(float(values.mean()), 4),
            "median": round(float(np.median(values)), 4),
            "p10": round(float(np.percentile(values, 10)), 4),
            "p25": round(float(np.percentile(values, 25)), 4),
            "p75": round(float(np.percentile(values, 75)), 4),
            "p90": round(float(np.percentile(values, 90)), 4),
            "share_at_or_above_threshold": round(float((values >= MIN_CONFIDENCE).mean()), 4),
            "share_at_or_above_0.90": round(float((values >= 0.9).mean()), 4),
        }

    accepted = confidence >= MIN_CONFIDENCE
    gate = {
        "threshold": MIN_CONFIDENCE,
        "accepted": int(accepted.sum()),
        "coverage": round(float(accepted.mean()), 4),
        "accuracy_on_accepted": round(float(correct[accepted].mean()), 4) if accepted.any() else None,
        "accepted_but_wrong": int((accepted & ~correct).sum()),
        "rejected_but_right": int((~accepted & correct).sum()),
    }

    index = read_dataset_index()
    format_counts: dict[str, list[int]] = defaultdict(lambda: [0, 0])
    aspect_ratios: list[float] = []
    dims_by_class: dict[str, list[tuple[int, int]]] = defaultdict(list)
    for path, is_correct in zip(files, correct.tolist()):
        entry = index.get(path)
        if not entry:
            continue
        entry_format = entry["image_format"] or "unknown"
        format_counts[entry_format][0] += 1
        format_counts[entry_format][1] += int(is_correct)
        if entry["width"] and entry["height"]:
            aspect = entry["width"] / entry["height"]
            aspect_ratios.append(aspect)
            dims_by_class[entry["class_id"] or "unknown"].append((entry["width"], entry["height"]))

    format_rows = [
        {
            "image_format": name,
            "images": counts[0],
            "correct": counts[1],
            "accuracy": round(counts[1] / counts[0], 4) if counts[0] else None,
        }
        for name, counts in sorted(format_counts.items(), key=lambda item: -item[1][0])
    ]

    def size_summary(pairs: Sequence[tuple[int, int]]) -> dict[str, Any]:
        if not pairs:
            return {}
        widths = sorted(width for width, _ in pairs)
        heights = sorted(height for _, height in pairs)
        ratios = sorted(width / height for width, height in pairs)
        return {
            "images": len(pairs),
            "width_median": int(statistics.median(widths)),
            "height_median": int(statistics.median(heights)),
            "aspect_ratio_p10": round(float(np.percentile(ratios, 10)), 3),
            "aspect_ratio_median": round(float(np.median(ratios)), 3),
            "aspect_ratio_p90": round(float(np.percentile(ratios, 90)), 3),
            "share_wider_than_2_to_1": round(float(np.mean([ratio > 2.0 for ratio in ratios])), 4),
            "share_smaller_than_400px_short_edge": round(
                float(np.mean([min(width, height) < 400 for width, height in pairs])), 4
            ),
        }

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "scoring_runtime": "ONNX Runtime, CPUExecutionProvider",
        "onnx": str(onnx_path),
        "test_manifest": str(test_manifest),
        "test_images": int(truth.size),
        "unreadable": unreadable,
        "overall": {
            "accuracy": round(float(accuracy_score(truth, predicted)), 4),
            "balanced_accuracy": round(float(balanced_accuracy_score(truth, predicted)), 4),
            "macro_precision": round(float(precision.mean()), 4),
            "macro_recall": round(float(recall.mean()), 4),
            "macro_f1": round(float(report["macro avg"]["f1-score"]), 4),
            "weighted_f1": round(float(report["weighted avg"]["f1-score"]), 4),
            "misclassified": int((~correct).sum()),
            "mean_confidence": round(float(confidence.mean()), 4),
        },
        "per_class": per_class,
        "confusion_matrix": {"labels": class_ids, "matrix": matrix.tolist()},
        "confusion_matrix_normalised": normalised,
        "top_confusions": confusions[:25],
        "confidence_distribution": {
            "correct": distribution(confidence[correct]),
            "incorrect": distribution(confidence[~correct]),
        },
        "confidence_histogram": [
            {
                "bin": f"{low / 10:.1f}-{(low + 1) / 10:.1f}",
                "correct": int((correct & (confidence >= low / 10) & (confidence < (low + 1) / 10)).sum()),
                "incorrect": int(
                    ((~correct) & (confidence >= low / 10) & (confidence < (low + 1) / 10)).sum()
                ),
            }
            for low in range(10)
        ],
        "confidence_gate": gate,
        "by_image_format": format_rows,
        "dataset_geometry": {
            "test_split": size_summary(
                [(entry["width"], entry["height"]) for entry in index.values()
                 if entry["width"] and entry["height"]]
            ),
            "per_class": {
                class_id: size_summary(pairs) for class_id, pairs in sorted(dims_by_class.items())
            },
        },
        "predictions_csv": "test_predictions.csv",
        "_rows": [
            {
                "relative_path": files[position],
                "true_class": labels[position],
                "predicted_class": class_ids[predicted[position]],
                "confidence": round(float(confidence[position]), 4),
                "correct": bool(correct[position]),
                "accepted_at_threshold": bool(confidence[position] >= MIN_CONFIDENCE),
            }
            for position in range(len(files))
        ],
    }


def read_dataset_index() -> dict[str, dict[str, Any]]:
    """relative_path -> row from the existing dataset index (built by the audit)."""

    if not INDEX_PATH.is_file():
        return {}
    out: dict[str, dict[str, Any]] = {}
    with INDEX_PATH.open("r", encoding="utf-8", newline="") as handle:
        for row in csv.DictReader(handle):
            try:
                width = int(row.get("width") or 0)
                height = int(row.get("height") or 0)
            except ValueError:
                width = height = 0
            out[row["relative_path"].replace("\\", "/")] = {
                "class_id": row.get("class_id"),
                "image_format": (row.get("image_format") or "").upper(),
                "width": width,
                "height": height,
                "sha256": row.get("sha256"),
                "dhash": row.get("dhash"),
                "cluster_id": row.get("cluster_id"),
            }
    return out


# --------------------------------------------------------------------------- C


def diagnose_framing(
    onnx_path: Path,
    validation_manifest: Path,
    dataset_root: Path,
    samples: int = 400,
    seed: int = 42,
) -> dict[str, Any]:
    """How much accuracy/confidence is lost under the conditions of the failing photos?

    Runs on the VALIDATION split, never the test split, and changes nothing:
    the same exported model scores degraded copies of the same images, so the
    only variable is the image statistics that separate phone/stock photos from
    the dataset (resolution, JPEG compression, a wider field of view).
    """

    from io import BytesIO

    from PIL import Image, ImageOps

    rows = read_manifest(validation_manifest)
    if not rows or samples <= 0:
        return {"skipped": True}
    rng = np.random.default_rng(seed)
    positions = np.sort(
        rng.choice(len(rows), size=min(samples, len(rows)), replace=False)
    )
    class_ids = list(taxonomy.CLASS_IDS)
    index_of = {class_id: position for position, class_id in enumerate(class_ids)}
    session = open_session(onnx_path)

    def low_res(image: Image.Image) -> Image.Image:
        scale = 224 / min(image.size)
        return image.resize(
            (max(1, round(image.width * scale)), max(1, round(image.height * scale))),
            Image.Resampling.BILINEAR,
        )

    def jpeg_q30(image: Image.Image) -> Image.Image:
        buffer = BytesIO()
        image.save(buffer, format="JPEG", quality=30)
        buffer.seek(0)
        with Image.open(buffer) as reopened:
            return reopened.convert("RGB")

    def reframe_3_2(image: Image.Image) -> Image.Image:
        target_width = int(round(image.height * 1.5))
        if target_width <= image.width:
            return image
        pad = (target_width - image.width) // 2
        canvas = ImageOps.expand(image, border=(pad, 0, target_width - image.width - pad, 0), fill=0)
        mirrored = ImageOps.mirror(image)
        canvas.paste(mirrored.crop((0, 0, pad, image.height)), (0, 0))
        canvas.paste(
            mirrored.crop((mirrored.width - (target_width - image.width - pad), 0, mirrored.width, image.height)),
            (image.width + pad, 0),
        )
        return canvas

    conditions = {
        "native": lambda image: image,
        "low_res_short_edge_224": low_res,
        "jpeg_quality_30": jpeg_q30,
        "reframe_to_3_2_with_background": reframe_3_2,
    }

    results: dict[str, Any] = {}
    for name, transform in conditions.items():
        truths: list[int] = []
        predictions: list[int] = []
        confidences: list[float] = []
        entropies: list[float] = []
        for position in positions:
            row = rows[int(position)]
            path = dataset_root / row.relative_path
            try:
                image = load_rgb(path)
            except (OSError, ValueError):
                continue
            try:
                try:
                    variant = transform(image)
                except (OSError, ValueError):
                    variant = image
                try:
                    tensor = to_model_tensor(variant)
                finally:
                    if variant is not image:
                        variant.close()
            finally:
                image.close()
            probabilities = softmax(predict_logits(session, batch(tensor)))[0]
            truths.append(index_of[row.class_id])
            predictions.append(int(probabilities.argmax()))
            confidences.append(float(probabilities.max()))
            entropies.append(float(-(probabilities * np.log2(np.clip(probabilities, 1e-12, 1))).sum()))

        truth = np.asarray(truths)
        predicted = np.asarray(predictions)
        confidence = np.asarray(confidences, dtype=float)
        if not truth.size:
            results[name] = {"images": 0}
            continue
        correct = truth == predicted
        results[name] = {
            "images": int(truth.size),
            "accuracy": round(float(correct.mean()), 4),
            "mean_confidence": round(float(confidence.mean()), 4),
            "median_confidence": round(float(np.median(confidence)), 4),
            "share_at_or_above_threshold": round(float((confidence >= MIN_CONFIDENCE).mean()), 4),
            "mean_entropy_bits": round(float(np.mean(entropies)), 4),
            "accuracy_on_accepted": round(float(correct[confidence >= MIN_CONFIDENCE].mean()), 4)
            if (confidence >= MIN_CONFIDENCE).any()
            else None,
        }

    baseline = results.get("native", {})
    for name, block in results.items():
        if name == "native" or not block.get("images") or not baseline.get("accuracy"):
            continue
        block["accuracy_drop_vs_native"] = round(baseline["accuracy"] - block["accuracy"], 4)
        block["confidence_drop_vs_native"] = round(
            baseline["mean_confidence"] - block["mean_confidence"], 4
        )

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "split_used": str(validation_manifest),
        "samples": int(sum(block.get("images", 0) for block in results.values())) // max(len(results), 1),
        "conditions": results,
        "note": (
            "Validation split only (no test images, no tuning). Each condition re-scores the same "
            "images through the same exported model, so a drop isolates image statistics rather "
            "than the model or the mapping."
        ),
    }


# --------------------------------------------------------------------------- C


def check_split_leakage(split_dir: Path) -> dict[str, Any]:
    """Do duplicate clusters stay inside one split?"""

    index = read_dataset_index()
    clusters: dict[str, set[str]] = defaultdict(set)
    cluster_members: dict[str, list[str]] = defaultdict(list)
    per_split: dict[str, int] = {}

    for split_name in ("train", "validation", "test"):
        path = split_dir / f"{split_name}.csv"
        if not path.is_file():
            continue
        rows = read_manifest(path)
        per_split[split_name] = len(rows)
        for row in rows:
            cluster = index.get(row.relative_path.replace("\\", "/"), {}).get("cluster_id")
            if not cluster:
                continue
            clusters[cluster].add(split_name)
            cluster_members[cluster].append(f"{split_name}:{row.relative_path}")

    spanning = {cluster: sorted(splits) for cluster, splits in clusters.items() if len(splits) > 1}
    examples = [
        {"cluster_id": cluster, "splits": splits, "images": cluster_members[cluster][:6]}
        for cluster, splits in list(spanning.items())[:10]
    ]

    class_by_cluster: dict[str, set[str]] = defaultdict(set)
    for entry in index.values():
        if entry["cluster_id"]:
            class_by_cluster[entry["cluster_id"]].add(entry["class_id"] or "unknown")
    cross_class = {
        cluster: sorted(names)
        for cluster, names in class_by_cluster.items()
        if len(names) > 1
    }

    total_clusters = len(clusters)
    return {
        "split_dir": str(split_dir),
        "images_per_split": per_split,
        "clusters_seen": total_clusters,
        "clusters_spanning_splits": len(spanning),
        "share_of_clusters_leaking": round(len(spanning) / total_clusters, 6) if total_clusters else 0.0,
        "examples": examples,
        "known_cross_class_clusters": {
            cluster: names for cluster, names in list(cross_class.items())[:10]
        },
        "cross_class_cluster_count": len(cross_class),
        "interpretation": (
            "Clusters come from the dataset audit (identical bytes plus tight perceptual matches) "
            "and were assigned whole to one split, so near-duplicate leakage across splits is "
            "measured here, not assumed. The dataset has no plant/field identifier, so images of "
            "the same plant that are not near-duplicates can still span splits - that independence "
            "cannot be claimed."
        ),
    }


# --------------------------------------------------------------------------- D


def inspect_photos(
    photos: Sequence[Path], onnx_path: Path, index: dict[str, dict[str, Any]], top_k: int = 5
) -> dict[str, Any]:
    """Top-k predictions plus image-property and provenance checks, read only."""

    import hashlib

    from PIL import Image

    session = open_session(onnx_path)
    class_ids = list(taxonomy.CLASS_IDS)
    dataset_geometry = [
        (entry["width"], entry["height"]) for entry in index.values() if entry["width"] and entry["height"]
    ]
    dataset_ratios = [width / height for width, height in dataset_geometry]
    dataset_short = [min(width, height) for width, height in dataset_geometry]
    dhash_index = {
        entry["dhash"]: (path, entry["class_id"])
        for path, entry in index.items()
        if entry["dhash"] and entry["class_id"]
    }
    sha_index = {entry["sha256"]: entry["class_id"] for entry in index.values() if entry["sha256"]}

    results = []
    for photo in photos:
        record: dict[str, Any] = {"path": str(photo), "exists": photo.is_file()}
        if not record["exists"]:
            record["error"] = "file not found (not substituted)"
            results.append(record)
            continue

        size_bytes = photo.stat().st_size
        digest = hashlib.sha256(photo.read_bytes()).hexdigest()
        record["size_bytes"] = size_bytes
        record["sha256"] = digest
        record["in_dataset_by_sha256"] = sha_index.get(digest)

        with Image.open(photo) as probe:
            record["format"] = probe.format
            record["mode"] = probe.mode
            width, height = probe.size
            record["width"] = width
            record["height"] = height
            record["aspect_ratio"] = round(width / height, 4)
            record["short_edge"] = min(width, height)
            record["exif_orientation"] = (probe.getexif() or {}).get(274)
            dhash = _difference_hash(probe)
        record["dhash"] = f"{dhash:016x}"

        nearest_distance = 64
        nearest_label = None
        nearest_path = None
        for candidate_hash, (candidate_path, candidate_label) in dhash_index.items():
            try:
                distance = bin(dhash ^ int(candidate_hash, 16)).count("1")
            except ValueError:
                continue
            if distance < nearest_distance:
                nearest_distance, nearest_label, nearest_path = distance, candidate_label, candidate_path
        record["nearest_dataset_dhash_distance"] = nearest_distance
        record["nearest_dataset_class"] = nearest_label
        record["nearest_dataset_path"] = nearest_path
        record["is_near_duplicate_of_dataset_image"] = nearest_distance <= 6

        record["dataset_comparison"] = {
            "aspect_ratio_p10_p90": [
                round(float(np.percentile(dataset_ratios, 10)), 3),
                round(float(np.percentile(dataset_ratios, 90)), 3),
            ],
            "dataset_median_aspect_ratio": round(float(np.median(dataset_ratios)), 3),
            "dataset_median_short_edge": int(np.median(dataset_short)),
            "photo_outside_dataset_aspect_p10_p90": bool(
                record["aspect_ratio"] < float(np.percentile(dataset_ratios, 10))
                or record["aspect_ratio"] > float(np.percentile(dataset_ratios, 90))
            ),
            "photo_short_edge_below_dataset_median": bool(
                record["short_edge"] < float(np.median(dataset_short))
            ),
        }

        try:
            if size_bytes > MAX_IMAGE_BYTES:
                raise ValueError("file exceeds the 10 MB upload limit")
            image = load_rgb(photo)
            try:
                tensor = batch(to_model_tensor(image))
            finally:
                image.close()
        except (OSError, ValueError) as exc:
            record["error"] = str(exc)
            results.append(record)
            continue

        probabilities = softmax(predict_logits(session, tensor))[0]
        ranked = np.argsort(probabilities)[::-1][:top_k]
        confidence = float(probabilities[ranked[0]])
        record["model_version"] = json.loads(
            (onnx_path.parent / "model_metadata.json").read_text(encoding="utf-8")
        ).get("model_version")
        record["top_predictions"] = [
            {
                "rank": position + 1,
                "class_id": class_ids[int(index_)],
                "display_name": taxonomy.get_spec(class_ids[int(index_)]).display_name,
                "category": taxonomy.get_spec(class_ids[int(index_)]).category,
                "probability": round(float(probabilities[index_]), 4),
            }
            for position, index_ in enumerate(ranked)
        ]
        record["top1_confidence"] = round(confidence, 4)
        record["passes_threshold"] = bool(confidence >= MIN_CONFIDENCE)
        record["api_status"] = "ok" if confidence >= MIN_CONFIDENCE else "uncertain"
        record["margin_top1_minus_top2"] = round(
            float(probabilities[ranked[0]] - probabilities[ranked[1]]), 4
        )
        record["entropy_bits"] = round(
            float(-(probabilities * np.log2(np.clip(probabilities, 1e-12, 1))).sum()), 4
        )
        results.append(record)

    existing = [record for record in results if record.get("exists") and "error" not in record]
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "threshold": MIN_CONFIDENCE,
        "photos_requested": len(photos),
        "photos_found": sum(1 for record in results if record.get("exists")),
        "photos_scored": len(existing),
        "passing_threshold": sum(1 for record in existing if record.get("passes_threshold")),
        "results": results,
        "note": (
            "Ground truth for these photos is unverified. A low probability is reported as "
            "'uncertain'; it is not evidence that the photo's presumed class is wrong, nor that "
            "the model's top label is right."
        ),
    }


# ------------------------------------------------------------------------- entry


def markdown_summary(report: dict[str, Any]) -> str:
    mapping = report["mapping"]
    pre = report["preprocessing"]
    parity = report["parity"]
    test = report["test"]
    leakage = report["leakage"]
    photos = report["photos"]

    lines = [
        "# Root-cause audit -- rice-disease-15class-v3-exp20",
        "",
        f"Generated: {report['generated_at']}",
        "",
        "Read-only. No image, label, checkpoint, ONNX file or split manifest was written.",
        "",
        "## A. Reproduction checks",
        "",
        "| check | result |",
        "| --- | --- |",
        f"| metadata model_version | `{mapping['model_version']}` |",
        f"| class order matches taxonomy | {mapping['class_order_matches_taxonomy']} |",
        f"| display-name mismatches | {len(mapping['display_name_mismatches'])} |",
        f"| category mismatches | {len(mapping['category_mismatches'])} |",
        f"| eval transform is shared preprocess | {pre['eval_transform_is_shared_preprocess']} |",
        f"| eval vs inference max abs diff | {pre['max_abs_diff_eval_vs_inference_preprocess']} |",
        f"| ONNX/PyTorch agreement ({parity.get('samples')} images) | {parity.get('predicted_class_agreement')} |",
        f"| max abs logit diff | {parity.get('max_abs_logit_difference')} |",
        f"| threshold | {mapping['threshold_used_by_api']} on {mapping['threshold_applied_to']} |",
        f"| evaluate.py writes model_version | `{mapping['evaluate_py_hardcoded_model_version']}` "
        f"(matches metadata: {mapping['evaluate_py_version_matches_metadata']}) |",
        "",
        "## B. Held-out test split (scored once, ONNX CPU)",
        "",
        f"- images: {test['test_images']}",
        f"- accuracy: {test['overall']['accuracy']}",
        f"- macro F1: {test['overall']['macro_f1']}",
        f"- weighted F1: {test['overall']['weighted_f1']}",
        f"- balanced accuracy: {test['overall']['balanced_accuracy']}",
        f"- accepted at {MIN_CONFIDENCE}: {test['confidence_gate']['accepted']} "
        f"(coverage {test['confidence_gate']['coverage']}), "
        f"accuracy on accepted {test['confidence_gate']['accuracy_on_accepted']}, "
        f"accepted-but-wrong {test['confidence_gate']['accepted_but_wrong']}",
        "",
        "| class | support | precision | recall | F1 | mean conf | coverage | acc on accepted |",
        "| --- | --- | --- | --- | --- | --- | --- | --- |",
    ]
    for row in test["per_class"]:
        lines.append(
            f"| {row['class_id']} | {row['support']} | {row['precision']:.3f} | {row['recall']:.3f} | "
            f"{row['f1']:.3f} | {row['mean_confidence']:.3f} | {row['coverage_at_threshold']:.3f} | "
            f"{row['accuracy_on_accepted']:.3f} |"
        )

    lines.extend(["", "### Top confusions", ""])
    for row in test["top_confusions"][:12]:
        lines.append(
            f"- {row['true_class']} -> {row['predicted_class']}: {row['count']} "
            f"({row['share_of_true_class'] * 100:.1f}% of the class)"
        )

    dist = test["confidence_distribution"]
    lines.extend(
        [
            "",
            "### Confidence distribution",
            "",
            "| group | count | mean | p10 | median | p90 | share >= threshold |",
            "| --- | --- | --- | --- | --- | --- | --- |",
            f"| correct | {dist['correct']['count']} | {dist['correct']['mean']} | "
            f"{dist['correct']['p10']} | {dist['correct']['median']} | {dist['correct']['p90']} | "
            f"{dist['correct']['share_at_or_above_threshold']} |",
            f"| incorrect | {dist['incorrect']['count']} | {dist['incorrect']['mean']} | "
            f"{dist['incorrect']['p10']} | {dist['incorrect']['median']} | {dist['incorrect']['p90']} | "
            f"{dist['incorrect']['share_at_or_above_threshold']} |",
            "",
            "### By image format",
            "",
            "| format | images | correct | accuracy |",
            "| --- | --- | --- | --- |",
        ]
    )
    for row in test["by_image_format"]:
        lines.append(
            f"| {row['image_format']} | {row['images']} | {row['correct']} | {row['accuracy']} |"
        )

    geometry = test["dataset_geometry"]["test_split"]
    lines.extend(
        [
            "",
            "### Dataset geometry (test split)",
            "",
            f"- median size: {geometry.get('width_median')} x {geometry.get('height_median')}",
            f"- aspect ratio p10 / median / p90: {geometry.get('aspect_ratio_p10')} / "
            f"{geometry.get('aspect_ratio_median')} / {geometry.get('aspect_ratio_p90')}",
            f"- share wider than 2:1: {geometry.get('share_wider_than_2_to_1')}",
            f"- share below 400 px short edge: {geometry.get('share_smaller_than_400px_short_edge')}",
            "",
            "### Robustness probe (validation split, same model, degraded copies)",
            "",
            "| condition | images | accuracy | acc drop | mean conf | share >= threshold | accuracy on accepted |",
            "| --- | --- | --- | --- | --- | --- | --- |",
        ]
    )
    for name, block in (report.get("framing_probe") or {}).get("conditions", {}).items():
        if not block.get("images"):
            continue
        accept = block.get("accuracy_on_accepted")
        lines.append(
            f"| {name} | {block['images']} | {block['accuracy']:.4f} | "
            f"{block.get('accuracy_drop_vs_native', 0.0):+.4f} | {block['mean_confidence']:.4f} | "
            f"{block['share_at_or_above_threshold']:.4f} | "
            f"{'n/a' if accept is None else f'{accept:.4f}'} |"
        )

    lines.extend(
        [
            "",
            "## C. Split leakage",
            "",
            f"- clusters spanning more than one split: {leakage['clusters_spanning_splits']} "
            f"of {leakage['clusters_seen']}",
            f"- cross-class clusters in the dataset: {leakage['cross_class_cluster_count']}",
            "",
            "## D. Personal photos",
            "",
            f"- requested {photos['photos_requested']}, found {photos['photos_found']}, "
            f"scored {photos['photos_scored']}, passing the threshold {photos['passing_threshold']}",
            "",
            "| photo | size | aspect | short edge | nearest dataset class (dhash) | top-1 | p | verdict |",
            "| --- | --- | --- | --- | --- | --- | --- | --- |",
        ]
    )
    for record in photos["results"]:
        if not record.get("exists"):
            lines.append(f"| {record['path']} | missing | - | - | - | - | - | - |")
            continue
        if "error" in record:
            lines.append(
                f"| {Path(record['path']).name} | {record['width']}x{record['height']} | - | - | "
                f"- | - | - | error: {record['error']} |"
            )
            continue
        top = record["top_predictions"][0]
        lines.append(
            f"| {Path(record['path']).name} | {record['width']}x{record['height']} | "
            f"{record['aspect_ratio']:.2f} | {record['short_edge']} | "
            f"{record['nearest_dataset_class']} (d={record['nearest_dataset_dhash_distance']}) | "
            f"{top['class_id']} | {top['probability']:.4f} | {record['api_status']} |"
        )
    lines.append("")
    return "\n".join(lines)


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--checkpoint", type=Path, default=CANDIDATE_DIR / "best.pt")
    parser.add_argument("--onnx", type=Path, default=CANDIDATE_DIR / "rice_disease_15class.onnx")
    parser.add_argument("--metadata", type=Path, default=CANDIDATE_DIR / "model_metadata.json")
    parser.add_argument("--test-manifest", type=Path, default=SPLIT_DIR / "test.csv")
    parser.add_argument("--validation-manifest", type=Path, default=SPLIT_DIR / "validation.csv")
    parser.add_argument("--framing-samples", type=int, default=400, help="0 disables the robustness probe.")
    parser.add_argument("--split-dir", type=Path, default=SPLIT_DIR)
    parser.add_argument("--dataset", type=Path, default=DATASET_ROOT)
    parser.add_argument("--output-dir", type=Path, default=AUDIT_DIR)
    parser.add_argument("--parity-samples", type=int, default=128)
    parser.add_argument("--photos", nargs="*", type=Path, default=[Path(p) for p in DEFAULT_PHOTOS])
    parser.add_argument("--skip-test-split", action="store_true", help="Skip the full test-split scoring.")
    args = parser.parse_args(argv)

    for required in (args.onnx, args.metadata):
        if not required.is_file():
            print(f"missing artefact: {required}", file=sys.stderr)
            return 1

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    metadata = json.loads(args.metadata.read_text(encoding="utf-8"))

    print("A. mapping ...", flush=True)
    mapping = check_mapping(args.metadata)
    write_json(output_dir / "mapping_check.json", mapping)

    print("A. preprocessing ...", flush=True)
    probe = next(
        (row for row in read_manifest(args.test_manifest)[:1]),
        None,
    )
    probe_path = args.dataset / probe.relative_path if probe else args.dataset
    preprocessing = check_preprocessing(probe_path)
    write_json(output_dir / "preprocessing_check.json", preprocessing)

    print("A. ONNX vs PyTorch parity ...", flush=True)
    test_rows = read_manifest(args.test_manifest)
    rng = np.random.default_rng(42)
    sample_positions = rng.choice(
        len(test_rows), size=min(args.parity_samples, len(test_rows)), replace=False
    )
    parity = check_parity(
        args.checkpoint,
        args.onnx,
        [Path(test_rows[int(position)].relative_path) for position in sorted(sample_positions)],
        args.dataset,
    )
    parity["checkpoint_sha256_note"] = (
        "Checkpoint file itself is hashed only in the model metadata; this audit does not rewrite it."
    )
    write_json(output_dir / "parity_torch_onnx.json", parity)

    report: dict[str, Any] = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "audit_scope": "read-only; no training, relabelling, movement or overwrite",
        "artifacts": {
            "checkpoint": str(args.checkpoint),
            "onnx": str(args.onnx),
            "onnx_sha256_in_metadata": metadata.get("onnx", {}).get("sha256"),
            "metadata": str(args.metadata),
        },
        "mapping": mapping,
        "preprocessing": preprocessing,
        "parity": parity,
    }

    if args.skip_test_split:
        print("B. test split skipped (--skip-test-split)")
    else:
        print(f"B. scoring {len(test_rows)} test images with ONNX ...", flush=True)
        test = score_test_split(args.onnx, args.test_manifest, args.dataset)
        rows = test.pop("_rows")
        write_csv(output_dir / "test_predictions.csv", rows)
        write_json(output_dir / "test_metrics_onnx.json", test)
        report["test"] = test
        print(
            f"   accuracy={test['overall']['accuracy']} macro_f1={test['overall']['macro_f1']} "
            f"coverage={test['confidence_gate']['coverage']}",
            flush=True,
        )

    print("C. split leakage ...", flush=True)
    report["leakage"] = check_split_leakage(args.split_dir)
    write_json(output_dir / "split_leakage.json", report["leakage"])

    print(f"C. framing/scale probe on validation ({args.framing_samples} images) ...", flush=True)
    report["framing_probe"] = diagnose_framing(
        args.onnx, args.validation_manifest, args.dataset, samples=args.framing_samples
    )
    write_json(output_dir / "framing_probe.json", report["framing_probe"])

    print("D. personal photos ...", flush=True)
    photos = inspect_photos(args.photos, args.onnx, read_dataset_index())
    write_json(output_dir / "personal_photos.json", photos)
    photo_rows = []
    for record in photos["results"]:
        row = {key: value for key, value in record.items() if key not in {"top_predictions", "dataset_comparison"}}
        for position in range(5):
            try:
                prediction = record.get("top_predictions", [])[position]
            except IndexError:
                prediction = None
            row[f"top{position + 1}_class"] = prediction["class_id"] if prediction else ""
            row[f"top{position + 1}_probability"] = prediction["probability"] if prediction else ""
        photo_rows.append(row)
    write_csv(output_dir / "personal_photos.csv", photo_rows)
    report["photos"] = photos

    if "test" in report:
        (output_dir / "audit_metrics.md").write_text(markdown_summary(report), encoding="utf-8")
    write_json(output_dir / "audit_report.json", report)
    print(f"Audit written to {output_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
