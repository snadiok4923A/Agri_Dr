"""Evaluate the 15-class checkpoint on the untouched test split.

    python scripts/evaluate_rice_disease_15class.py

Writes JSON/CSV/Markdown reports to reports/rice_disease_15class/evaluation/.
The test split is not used for any model selection.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.rice_disease_15class.config import (  # noqa: E402
    DATASET_ROOT,
    EVALUATION_DIR,
    MODEL_ROOT,
    SPLIT_DIR,
)
from app.rice_disease_15class.evaluate import evaluate_checkpoint  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--checkpoint", type=Path, default=MODEL_ROOT / "best.pt")
    parser.add_argument("--test-manifest", type=Path, default=SPLIT_DIR / "test.csv")
    parser.add_argument("--train-manifest", type=Path, default=SPLIT_DIR / "train.csv")
    parser.add_argument("--dataset", type=Path, default=DATASET_ROOT)
    parser.add_argument("--output-dir", type=Path, default=EVALUATION_DIR)
    parser.add_argument("--batch-size", type=int, default=64)
    parser.add_argument("--workers", type=int, default=0)
    parser.add_argument(
        "--max-per-class",
        type=int,
        default=None,
        help="Optional cap for quick checks; omit for the real reported evaluation.",
    )
    args = parser.parse_args()

    try:
        metrics = evaluate_checkpoint(
            checkpoint_path=args.checkpoint,
            test_manifest=args.test_manifest,
            train_manifest=args.train_manifest,
            dataset_root=args.dataset,
            output_dir=args.output_dir,
            batch_size=args.batch_size,
            workers=args.workers,
            max_per_class=args.max_per_class,
        )
    except (FileNotFoundError, ValueError, RuntimeError) as exc:
        print(f"Evaluation failed: {exc}", file=sys.stderr)
        return 1

    overall = metrics["overall"]
    print(
        f"test images={metrics['test_images']} accuracy={overall['accuracy']:.4f} "
        f"macro_f1={overall['macro_f1']:.4f} weighted_f1={overall['weighted_f1']:.4f} "
        f"balanced_acc={overall['balanced_accuracy']:.4f}"
    )
    print(f"Reports written to {args.output_dir}")
    gate = metrics.get("confidence_gate") or {}
    for row in gate.get("thresholds", []):
        accuracy_cell = "n/a" if row["accuracy_on_accepted"] is None else f"{row['accuracy_on_accepted']:.4f}"
        print(
            f"gate {row['threshold']:.2f}: coverage={row['coverage']:.4f} "
            f"accuracy_on_accepted={accuracy_cell}"
        )
    print(json.dumps(metrics["baselines"], indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
