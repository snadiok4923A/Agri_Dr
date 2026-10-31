"""Held-out evaluation of the 15-class checkpoint.

The test split is used once per evaluated checkpoint. No hyperparameter is
chosen from it: model selection happened on the validation split during
training.

Reports land in ``reports/rice_disease_15class/evaluation/``.
"""

from __future__ import annotations

import csv
import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Sequence

from . import taxonomy
from .config import (
    DATASET_ROOT,
    EVALUATION_DIR,
    MODEL_VERSION,
    write_json,
)
from .data import ManifestDataset, ManifestRow, read_manifest, subsample_manifest


def _write_csv(path: Path, rows: Sequence[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = list(rows[0].keys()) if rows else ["empty"]
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow(row)


def _load_checkpoint(path: Path):
    import torch

    if not Path(path).is_file():
        raise FileNotFoundError(f"Checkpoint not found: {path}")
    checkpoint = torch.load(Path(path), map_location="cpu", weights_only=True)
    class_ids = checkpoint.get("class_ids")
    if class_ids != list(taxonomy.CLASS_IDS):
        raise ValueError(
            "Checkpoint class order does not match the current taxonomy; refusing to evaluate "
            f"with a mismatched mapping: {class_ids}"
        )
    return checkpoint


def collect_predictions(
    checkpoint_path: Path,
    rows: Sequence[ManifestRow],
    dataset_root: Path = DATASET_ROOT,
    batch_size: int = 64,
    workers: int = 0,
    image_size: int | None = None,
) -> tuple[list[int], list[int], list[float], list[list[float]], list[str]]:
    """Run the checkpoint over ``rows`` and return prediction arrays."""

    import torch
    from torch.utils.data import DataLoader

    from .model import build_model

    checkpoint = _load_checkpoint(checkpoint_path)
    size = image_size or int(checkpoint.get("image_size", 224))
    model = build_model(taxonomy.NUM_CLASSES, pretrained=False)
    model.load_state_dict(checkpoint["model_state"])
    model.eval()

    dataset = ManifestDataset(rows, root=dataset_root, train=False, image_size=size)
    loader = DataLoader(dataset, batch_size=batch_size, shuffle=False, num_workers=workers)

    y_true: list[int] = []
    y_pred: list[int] = []
    confidences: list[float] = []
    probabilities: list[list[float]] = []
    with torch.no_grad():
        for inputs, targets, _indices in loader:
            logits = model(inputs)
            probs = torch.softmax(logits, dim=1)
            predictions = probs.argmax(dim=1)
            y_true.extend(targets.tolist())
            y_pred.extend(predictions.tolist())
            confidences.extend(probs.max(dim=1).values.tolist())
            probabilities.extend(probs.tolist())
    return y_true, y_pred, confidences, probabilities, [row.relative_path for row in rows]


def evaluate_checkpoint(
    checkpoint_path: Path,
    test_manifest: Path,
    train_manifest: Path | None = None,
    dataset_root: Path = DATASET_ROOT,
    output_dir: Path = EVALUATION_DIR,
    batch_size: int = 64,
    workers: int = 0,
    max_per_class: int | None = None,
    seed: int = 42,
) -> dict[str, Any]:
    import numpy as np
    from sklearn.metrics import (
        accuracy_score,
        balanced_accuracy_score,
        classification_report,
        confusion_matrix,
        precision_recall_fscore_support,
    )

    rows = subsample_manifest(read_manifest(test_manifest), max_per_class, seed)
    if not rows:
        raise ValueError("Test manifest is empty.")

    y_true, y_pred, confidences, probabilities, paths = collect_predictions(
        checkpoint_path, rows, dataset_root=dataset_root, batch_size=batch_size, workers=workers
    )

    labels = list(range(taxonomy.NUM_CLASSES))
    accuracy = float(accuracy_score(y_true, y_pred))
    balanced = float(balanced_accuracy_score(y_true, y_pred))
    report = classification_report(
        y_true, y_pred, labels=labels, target_names=list(taxonomy.CLASS_IDS), output_dict=True, zero_division=0
    )
    precision, recall, f1, support = precision_recall_fscore_support(
        y_true, y_pred, labels=labels, zero_division=0
    )
    matrix = confusion_matrix(y_true, y_pred, labels=labels)

    per_class_rows: list[dict[str, Any]] = []
    for index, class_id in enumerate(taxonomy.CLASS_IDS):
        per_class_rows.append(
            {
                "class_id": class_id,
                "folder_label": taxonomy.get_spec(class_id).folder_name,
                "category": taxonomy.get_spec(class_id).category,
                "support": int(support[index]),
                "precision": round(float(precision[index]), 4),
                "recall": round(float(recall[index]), 4),
                "f1": round(float(f1[index]), 4),
            }
        )

    confusions: list[dict[str, Any]] = []
    for true_index in labels:
        for predicted_index in labels:
            if true_index == predicted_index:
                continue
            count = int(matrix[true_index, predicted_index])
            if count:
                confusions.append(
                    {
                        "true_class": taxonomy.CLASS_IDS[true_index],
                        "predicted_class": taxonomy.CLASS_IDS[predicted_index],
                        "count": count,
                        "share_of_true_class": round(count / max(int(support[true_index]), 1), 4),
                    }
                )
    confusions.sort(key=lambda row: (-row["count"], row["true_class"], row["predicted_class"]))

    majority_class_id: str | None = None
    majority_baseline_accuracy: float | None = None
    if train_manifest is not None and Path(train_manifest).is_file():
        train_rows = read_manifest(train_manifest)
        if train_rows:
            majority_class_id = Counter(row.class_id for row in train_rows).most_common(1)[0][0]
            majority_index = taxonomy.CLASS_IDS.index(majority_class_id)
            majority_baseline_accuracy = float(np.mean([1.0 if label == majority_index else 0.0 for label in y_true]))

    misclassified = [
        {
            "relative_path": paths[index],
            "true_class": taxonomy.CLASS_IDS[y_true[index]],
            "predicted_class": taxonomy.CLASS_IDS[y_pred[index]],
            "confidence": round(float(confidences[index]), 4),
            "runner_up_class": taxonomy.CLASS_IDS[int(np.argsort(probabilities[index])[-2])],
            "runner_up_confidence": round(float(sorted(probabilities[index])[-2]), 4),
        }
        for index in range(len(y_true))
        if y_true[index] != y_pred[index]
    ]
    misclassified.sort(key=lambda row: (-row["confidence"], row["relative_path"]))

    selective = _selective_metrics(
        np.asarray(y_true), np.asarray(y_pred), np.asarray(confidences, dtype=float)
    )

    metrics = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "model_version": MODEL_VERSION,
        "checkpoint": str(Path(checkpoint_path)),
        "test_manifest": str(Path(test_manifest)),
        "test_images": len(y_true),
        "class_order": list(taxonomy.CLASS_IDS),
        "overall": {
            "accuracy": round(accuracy, 4),
            "balanced_accuracy": round(balanced, 4),
            "macro_precision": round(float(precision.mean()), 4),
            "macro_recall": round(float(recall.mean()), 4),
            "macro_f1": round(float(f1.mean()), 4),
            "weighted_precision": round(float(report["weighted avg"]["precision"]), 4),
            "weighted_recall": round(float(report["weighted avg"]["recall"]), 4),
            "weighted_f1": round(float(report["weighted avg"]["f1-score"]), 4),
            "mean_confidence": round(float(np.mean(confidences)) if confidences else 0.0, 4),
            "misclassified": len(misclassified),
        },
        "per_class": per_class_rows,
        "confusion_matrix": {
            "labels": list(taxonomy.CLASS_IDS),
            "matrix": matrix.tolist(),
        },
        "top_confusions": confusions[:20],
        "confidence_gate": selective,
        "baselines": {
            "majority_class": majority_class_id,
            "majority_class_accuracy": round(majority_baseline_accuracy, 4)
            if majority_baseline_accuracy is not None
            else None,
            "uniform_random_accuracy": round(1.0 / taxonomy.NUM_CLASSES, 4),
        },
        "limitations": [
            "Metrics describe this dataset's labels, not field-verified agronomic ground truth.",
            "Images were split at image level; plants/fields cannot be fully separated because the dataset has no capture identifiers.",
            "Classes marked low-count have very high metric variance.",
            "The class set mixes diseases, pest damage and healthy leaves; a prediction is a label, not a causal diagnosis.",
            "Test performance does not establish real-world diagnostic suitability.",
        ],
    }

    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    write_json(output_dir / "test_metrics.json", metrics)
    _write_csv(output_dir / "test_per_class.csv", per_class_rows)
    _write_csv(output_dir / "test_misclassified.csv", misclassified)
    matrix_rows = [
        {"true_class": class_id, **{predicted: int(matrix[index, position])
                                    for position, predicted in enumerate(taxonomy.CLASS_IDS)}}
        for index, class_id in enumerate(taxonomy.CLASS_IDS)
    ]
    _write_csv(output_dir / "test_confusion_matrix.csv", matrix_rows)
    (output_dir / "test_confusion_matrix.md").write_text(_confusion_markdown(matrix), encoding="utf-8")
    (output_dir / "report.md").write_text(_markdown_report(metrics), encoding="utf-8")
    return metrics


def _selective_metrics(y_true, y_pred, confidences) -> dict[str, Any]:
    """Coverage/accuracy if low-confidence predictions were sent to a human.

    ``inference.MIN_CONFIDENCE`` is the gate the API-level helper uses; the
    surrounding thresholds show how sensitive that choice is.
    """

    from app.rice_disease_15class.inference import MIN_CONFIDENCE

    correct = y_true == y_pred
    thresholds = sorted({0.5, round(MIN_CONFIDENCE, 4), 0.7, 0.8})
    table: list[dict[str, Any]] = []
    for threshold in thresholds:
        accepted = confidences >= threshold
        count = int(accepted.sum())
        table.append(
            {
                "threshold": round(float(threshold), 4),
                "accepted": count,
                "coverage": round(count / len(y_true), 4) if len(y_true) else 0.0,
                "accuracy_on_accepted": round(float(correct[accepted].mean()), 4) if count else None,
            }
        )

    gate = confidences >= MIN_CONFIDENCE
    per_class: list[dict[str, Any]] = []
    for index, class_id in enumerate(taxonomy.CLASS_IDS):
        mask = y_true == index
        if not mask.any():
            continue
        accepted = mask & gate
        count = int(accepted.sum())
        per_class.append(
            {
                "class_id": class_id,
                "support": int(mask.sum()),
                "accepted": count,
                "coverage": round(count / int(mask.sum()), 4),
                "accuracy_on_accepted": round(float(correct[accepted].mean()), 4) if count else None,
            }
        )

    return {
        "threshold_used_by_inference": round(float(MIN_CONFIDENCE), 4),
        "thresholds": table,
        "per_class_at_threshold": per_class,
        "note": "A prediction below the threshold is returned as 'uncertain', not as a diagnosis.",
    }


def _confusion_markdown(matrix) -> str:
    short = [class_id[:10] for class_id in taxonomy.CLASS_IDS]
    header = "| true \\ predicted | " + " | ".join(short) + " |"
    separator = "| --- |" + " --- |" * len(short)
    lines = [header, separator]
    for index, row in enumerate(matrix):
        lines.append(f"| {short[index]} | " + " | ".join(str(int(value)) for value in row) + " |")
    return "\n".join(lines) + "\n"


def _markdown_report(metrics: dict[str, Any]) -> str:
    overall = metrics["overall"]
    lines = [
        "# Rice disease & pest 15-class model — held-out test report",
        "",
        f"Generated: {metrics['generated_at']}",
        f"Checkpoint: `{metrics['checkpoint']}`",
        f"Test images: {metrics['test_images']}",
        "",
        "## Overall",
        "",
        "| metric | value |",
        "| --- | --- |",
        f"| accuracy | {overall['accuracy']:.4f} |",
        f"| balanced accuracy | {overall['balanced_accuracy']:.4f} |",
        f"| macro F1 | {overall['macro_f1']:.4f} |",
        f"| weighted F1 | {overall['weighted_f1']:.4f} |",
        f"| misclassified | {overall['misclassified']} |",
        "",
        "## Per class",
        "",
        "| class | support | precision | recall | F1 |",
        "| --- | --- | --- | --- | --- |",
    ]
    for row in metrics["per_class"]:
        lines.append(
            f"| {row['class_id']} | {row['support']} | {row['precision']:.3f} | {row['recall']:.3f} | {row['f1']:.3f} |"
        )
    lines.extend(["", "## Baselines", ""])
    baselines = metrics["baselines"]
    lines.append(f"- always predict `{baselines['majority_class']}`: {baselines['majority_class_accuracy']}")
    lines.append(f"- uniform random guess: {baselines['uniform_random_accuracy']}")
    gate = metrics.get("confidence_gate")
    if gate:
        lines.extend(
            [
                "",
                f"## Confidence gate (uncertain below {gate['threshold_used_by_inference']:.2f})",
                "",
                "| threshold | accepted | coverage | accuracy on accepted |",
                "| --- | --- | --- | --- |",
            ]
        )
        for row in gate["thresholds"]:
            accuracy_cell = "n/a" if row["accuracy_on_accepted"] is None else f"{row['accuracy_on_accepted']:.4f}"
            lines.append(
                f"| {row['threshold']:.2f} | {row['accepted']} | {row['coverage']:.4f} | {accuracy_cell} |"
            )

    lines.extend(["", "## Most frequent confusions", ""])
    for row in metrics["top_confusions"][:10]:
        lines.append(
            f"- {row['true_class']} -> {row['predicted_class']}: {row['count']} "
            f"({row['share_of_true_class'] * 100:.1f}% of that class)"
        )
    lines.extend(["", "## Limitations", ""])
    for limitation in metrics["limitations"]:
        lines.append(f"- {limitation}")
    return "\n".join(lines) + "\n"


def load_metrics(path: Path) -> dict[str, Any]:
    return json.loads(Path(path).read_text(encoding="utf-8"))
