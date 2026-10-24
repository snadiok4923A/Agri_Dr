"""Evaluate the disease ONNX model on independently collected labeled images.

Expected layout:
    dataset/
      bacterial_leaf_blight/*.jpg
      brown_spot/*.jpg
      healthy_rice_leaf/*.jpg
      leaf_blast/*.jpg
      leaf_scald/*.jpg
      sheath_blight/*.jpg

Keep this dataset separate from training and the original test set. The
script reports classification metrics and confidence bins but does not alter
the deployed model or choose a threshold automatically.
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import defaultdict
from pathlib import Path

import numpy as np
from sklearn.metrics import classification_report, confusion_matrix

from PIL import Image
import onnxruntime as ort

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.disease_service import (  # noqa: E402
    CLASS_PATH,
    _preprocess_image,
    _probabilities_from_logits,
)


def evaluate(dataset: Path) -> dict:
    class_names = json.loads(CLASS_PATH.read_text(encoding="utf-8"))
    session = ort.InferenceSession(
        str(CLASS_PATH.parent / "rice_disease_model.onnx"),
        providers=["CPUExecutionProvider"],
    )
    input_name = session.get_inputs()[0].name
    output_name = session.get_outputs()[0].name
    y_true: list[str] = []
    y_pred: list[str] = []
    confidences: list[float] = []
    for label in class_names:
        for path in sorted((dataset / label).glob("*")):
            if not path.is_file():
                continue
            with Image.open(path) as image:
                tensor = _preprocess_image(image)
            logits = session.run([output_name], {input_name: tensor})[0][0]
            probabilities = _probabilities_from_logits(logits)
            index = int(np.argmax(probabilities))
            y_true.append(label)
            y_pred.append(class_names[index])
            confidences.append(float(probabilities[index]))

    if not y_true:
        raise ValueError("No labeled images found in the expected class folders.")

    report = classification_report(
        y_true,
        y_pred,
        labels=class_names,
        output_dict=True,
        zero_division=0,
    )
    bins: dict[str, dict[str, int]] = defaultdict(lambda: {"accepted": 0, "correct": 0})
    for actual, predicted, confidence in zip(y_true, y_pred, confidences):
        lower = int(confidence * 10) / 10
        key = f"{lower:.1f}-{lower + 0.1:.1f}"
        bins[key]["accepted"] += 1
        bins[key]["correct"] += int(actual == predicted)
    calibration_error = sum(
        abs(
            values["correct"] / values["accepted"]
            - float(key.split("-")[0]) - 0.05
        )
        * values["accepted"]
        for key, values in bins.items()
    ) / len(y_true)
    return {
        "samples": len(y_true),
        "classes": class_names,
        "confusion_matrix": confusion_matrix(y_true, y_pred, labels=class_names).tolist(),
        "classification_report": report,
        "confidence_bins": dict(sorted(bins.items())),
        "expected_calibration_error": calibration_error,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("dataset", type=Path)
    args = parser.parse_args()
    print(json.dumps(evaluate(args.dataset), indent=2))


if __name__ == "__main__":
    main()
