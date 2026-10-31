"""Read-only side-by-side comparison of two 15-class model versions.

Runs the v2 development model (8 epochs) and Experiment A
(``rice-disease-15class-v3-exp20``) on the same images with the same
preprocessing and the same confidence threshold, so the only thing that varies
is the model.

    python scripts/compare_rice_disease_versions.py "C:\\path\\23.jpg" "C:\\path\\24.jpg"

    # one image at a time, showing the exact path
    python scripts/compare_rice_disease_versions.py --top-k 5 img1.jpg img2.png

Both models are written nowhere, no image is modified, and the production
6-class service is never imported. Each model is loaded from its own directory
together with the metadata file that sits beside it; the default inference
paths in :mod:`app.rice_disease_15class.inference` are deliberately not used.
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Sequence

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.rice_disease_15class import taxonomy  # noqa: E402
from app.rice_disease_15class.config import MODEL_ROOT, SERVICE_ROOT  # noqa: E402
from app.rice_disease_15class.inference import MIN_CONFIDENCE  # noqa: E402
from app.rice_disease_15class.preprocess import batch, load_rgb, to_model_tensor  # noqa: E402

#: Experiment A lives beside the v2 development model, never on top of it.
CANDIDATE_ROOT = (
    SERVICE_ROOT / "models" / "rice_disease_15class" / "rice-disease-15class-v3-exp20"
)

MAX_IMAGE_BYTES = 10 * 1024 * 1024


class ComparisonError(RuntimeError):
    """Raised when a model directory cannot be used for comparison."""


@dataclass(frozen=True)
class ModelArtifacts:
    """One model directory resolved to its ONNX file and matching metadata."""

    label: str
    directory: Path
    onnx_path: Path
    metadata_path: Path


def resolve_artifacts(label: str, directory: str | Path) -> ModelArtifacts:
    """Find the single ``*.onnx`` and ``model_metadata.json`` inside ``directory``.

    Resolution is directory-scoped on purpose: a model is never paired with
    metadata from a different folder, which would silently misuse the class
    order.
    """

    directory = Path(directory)
    if not directory.is_dir():
        raise ComparisonError(f"[{label}] model directory not found: {directory}")

    onnx_files = sorted(directory.glob("*.onnx"))
    if not onnx_files:
        raise ComparisonError(f"[{label}] no .onnx file inside {directory}")
    if len(onnx_files) > 1:
        names = ", ".join(path.name for path in onnx_files)
        raise ComparisonError(
            f"[{label}] expected exactly one .onnx inside {directory}, found {len(onnx_files)} ({names})"
        )

    metadata_path = directory / "model_metadata.json"
    if not metadata_path.is_file():
        raise ComparisonError(f"[{label}] metadata not found beside the model: {metadata_path}")

    return ModelArtifacts(
        label=label,
        directory=directory,
        onnx_path=onnx_files[0],
        metadata_path=metadata_path,
    )


class ModelRunner:
    """A loaded model + its own metadata. Predicts on a shared input tensor."""

    def __init__(self, artifacts: ModelArtifacts) -> None:
        import onnxruntime as ort

        try:
            metadata = json.loads(artifacts.metadata_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            raise ComparisonError(
                f"[{artifacts.label}] unreadable metadata {artifacts.metadata_path}: {exc}"
            ) from exc

        class_ids = list(metadata.get("class_order") or [])
        if class_ids != list(taxonomy.CLASS_IDS):
            raise ComparisonError(
                f"[{artifacts.label}] metadata class order does not match the 15-class taxonomy"
            )

        self.artifacts = artifacts
        self.class_ids = class_ids
        self.version = str(metadata.get("model_version") or artifacts.directory.name)
        self.display_names = dict(metadata.get("class_display_names") or {})

        self.session = ort.InferenceSession(
            str(artifacts.onnx_path), providers=["CPUExecutionProvider"]
        )
        self.input_name = self.session.get_inputs()[0].name
        self.output_name = self.session.get_outputs()[0].name
        width = self.session.get_outputs()[0].shape[-1]
        if width != len(class_ids):
            raise ComparisonError(
                f"[{artifacts.label}] ONNX output width {width} != {len(class_ids)} classes"
            )

    def predict(self, tensor: np.ndarray, top_k: int = 3) -> dict[str, Any]:
        """Softmax probabilities for one prepared ``(1, 3, 224, 224)`` tensor."""

        logits = self.session.run([self.output_name], {self.input_name: tensor})[0][0]
        shifted = logits - np.max(logits)
        probabilities = np.exp(shifted) / np.exp(shifted).sum()

        ranked = np.argsort(probabilities)[::-1][:top_k]
        best = int(ranked[0])
        confidence = float(probabilities[best])
        accepted = confidence >= MIN_CONFIDENCE

        return {
            "status": "ok" if accepted else "uncertain",
            "class_id": self.class_ids[best] if accepted else None,
            "confidence": round(confidence, 4),
            "top_predictions": [
                {
                    "class_id": self.class_ids[int(index)],
                    "display_name": self.display_names.get(
                        self.class_ids[int(index)], self.class_ids[int(index)]
                    ),
                    "confidence": round(float(probabilities[index]), 4),
                }
                for index in ranked
            ],
        }


def load_runners(
    baseline_dir: str | Path = MODEL_ROOT,
    candidate_dir: str | Path = CANDIDATE_ROOT,
    baseline_label: str = "v2",
    candidate_label: str = "A",
) -> tuple[ModelRunner, ModelRunner]:
    """Load both models independently, each from its own directory."""

    baseline = ModelRunner(resolve_artifacts(baseline_label, baseline_dir))
    candidate = ModelRunner(resolve_artifacts(candidate_label, candidate_dir))
    if baseline.artifacts.onnx_path.resolve() == candidate.artifacts.onnx_path.resolve():
        raise ComparisonError("Both labels resolved to the same ONNX file; nothing to compare.")
    return baseline, candidate


def prepare_tensor(path: Path) -> np.ndarray:
    """One shared model input for both models; raises ``ValueError`` if unusable."""

    if not path.is_file():
        raise ValueError(f"file not found: {path}")
    if path.stat().st_size > MAX_IMAGE_BYTES:
        raise ValueError(f"file exceeds the 10 MB limit: {path}")

    image = load_rgb(path)  # RGB / RGBA / grayscale / palette -> 3-channel RGB
    try:
        return batch(to_model_tensor(image))
    finally:
        image.close()


def _format_predictions(predictions: Sequence[dict[str, Any]], name_width: int) -> str:
    return "  ".join(
        f"{prediction['class_id'].ljust(name_width)} {prediction['confidence']:.4f}"
        for prediction in predictions
    ) or "-"


def _same_top1(first: dict[str, Any], second: dict[str, Any]) -> bool:
    first_top = first["top_predictions"][0]["class_id"] if first["top_predictions"] else None
    second_top = second["top_predictions"][0]["class_id"] if second["top_predictions"] else None
    return first_top == second_top


def compare(
    images: Sequence[Path],
    baseline: ModelRunner,
    candidate: ModelRunner,
    top_k: int = 3,
) -> dict[str, Any]:
    """Print one block per image and return a small summary."""

    label_width = max(len(baseline.artifacts.label), len(candidate.artifacts.label))
    name_width = max(len(class_id) for class_id in baseline.class_ids) + 2

    print("Model comparison (read only)")
    print(f"  {baseline.artifacts.label.ljust(label_width)}  {baseline.version}")
    print(f"  {' ' * label_width}  {baseline.artifacts.onnx_path}")
    print(f"  {candidate.artifacts.label.ljust(label_width)}  {candidate.version}")
    print(f"  {' ' * label_width}  {candidate.artifacts.onnx_path}")
    print(
        f"  threshold {MIN_CONFIDENCE:.2f} (shared) | preprocessing: shared | top-{top_k}"
    )
    print()

    compared = 0
    identical_top1 = 0
    status_flips = 0
    unreadable = 0

    for image_path in images:
        print(image_path)
        try:
            tensor = prepare_tensor(Path(image_path))
        except (ValueError, OSError) as exc:
            unreadable += 1
            print(f"  ERROR  {exc}")
            print()
            continue

        results = {
            baseline.artifacts.label: baseline.predict(tensor, top_k=top_k),
            candidate.artifacts.label: candidate.predict(tensor, top_k=top_k),
        }
        for label, result in results.items():
            print(
                f"  {label.ljust(label_width)}  {result['status'].ljust(9)}  "
                f"{_format_predictions(result['top_predictions'], name_width)}"
            )

        baseline_result = results[baseline.artifacts.label]
        candidate_result = results[candidate.artifacts.label]
        compared += 1
        if _same_top1(baseline_result, candidate_result):
            identical_top1 += 1
            verdict = "same top-1"
        else:
            verdict = "DIFFERENT top-1"
        if baseline_result["status"] != candidate_result["status"]:
            status_flips += 1
            verdict += f" | status {baseline_result['status']} -> {candidate_result['status']}"
        print(f"  -> {verdict}")
        print()

    print("Summary")
    print(f"  images compared : {compared}")
    print(f"  unreadable      : {unreadable}")
    print(f"  same top-1      : {identical_top1}/{compared}" if compared else "  same top-1      : n/a")
    print(f"  status flips    : {status_flips}")
    print(
        "  NOTE: neither model is production. A low confidence result means "
        "'uncertain', not a diagnosis."
    )
    return {
        "compared": compared,
        "unreadable": unreadable,
        "identical_top1": identical_top1,
        "status_flips": status_flips,
    }


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("images", nargs="+", type=Path, help="Image files to compare.")
    parser.add_argument("--baseline-dir", type=Path, default=MODEL_ROOT)
    parser.add_argument("--candidate-dir", type=Path, default=CANDIDATE_ROOT)
    parser.add_argument("--baseline-label", default="v2")
    parser.add_argument("--candidate-label", default="A")
    parser.add_argument("--top-k", type=int, default=3)
    args = parser.parse_args(argv)

    if args.top_k < 1 or args.top_k > len(taxonomy.CLASS_IDS):
        print(f"--top-k must be between 1 and {len(taxonomy.CLASS_IDS)}", file=sys.stderr)
        return 2

    try:
        baseline, candidate = load_runners(
            baseline_dir=args.baseline_dir,
            candidate_dir=args.candidate_dir,
            baseline_label=args.baseline_label,
            candidate_label=args.candidate_label,
        )
    except ComparisonError as exc:
        print(f"Cannot load models: {exc}", file=sys.stderr)
        return 1

    summary = compare(args.images, baseline, candidate, top_k=args.top_k)
    return 1 if summary["unreadable"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
