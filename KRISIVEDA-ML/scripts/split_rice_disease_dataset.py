"""Create reproducible train/validation/test manifests for the 15-class dataset.

Requires ``reports/rice_disease_15class/dataset_index.csv`` from the audit.
Only CSV manifests are written; source images are never copied or moved.

PowerShell example (from KRISIVEDA-ML):

    python scripts/split_rice_disease_dataset.py --seed 42
    python scripts/split_rice_disease_dataset.py --verify-only
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.rice_disease_15class.config import DEFAULT_SEED, REPORTS_ROOT, SPLIT_DIR  # noqa: E402
from app.rice_disease_15class.splitting import (  # noqa: E402
    DEFAULT_RATIOS,
    build_split,
    read_index,
    verify_splits,
    write_split_manifests,
)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--index",
        type=Path,
        default=REPORTS_ROOT / "dataset_index.csv",
        help="Dataset index CSV produced by the audit.",
    )
    parser.add_argument("--output-dir", type=Path, default=SPLIT_DIR)
    parser.add_argument("--seed", type=int, default=DEFAULT_SEED)
    parser.add_argument("--train-ratio", type=float, default=DEFAULT_RATIOS["train"])
    parser.add_argument("--validation-ratio", type=float, default=DEFAULT_RATIOS["validation"])
    parser.add_argument("--test-ratio", type=float, default=DEFAULT_RATIOS["test"])
    parser.add_argument("--verify-only", action="store_true")
    parser.add_argument("--json", action="store_true", help="Print the full summary JSON.")
    args = parser.parse_args()

    if args.verify_only:
        result = verify_splits(args.output_dir)
        print(json.dumps(result, indent=2))
        return 0 if result["valid"] else 1

    try:
        records = read_index(args.index)
    except (FileNotFoundError, ValueError) as exc:
        print(f"Split failed: {exc}", file=sys.stderr)
        return 2

    ratios = {
        "train": args.train_ratio,
        "validation": args.validation_ratio,
        "test": args.test_ratio,
    }
    result = build_split(records, seed=args.seed, ratios=ratios)
    paths = write_split_manifests(records, result, args.output_dir)
    verification = verify_splits(args.output_dir)

    print(f"Total images: {result.summary['total_images']}")
    print(
        "Achieved ratios: "
        + ", ".join(f"{name}={value:.3f}" for name, value in result.summary["ratios_achieved"].items())
    )
    for split in ("train", "validation", "test"):
        print(f"  {split:10s} {result.summary['totals'][split]:6d}  -> {paths[split]}")
    if result.summary["insufficient_cluster_classes"]:
        print(f"Classes kept in train only: {result.summary['insufficient_cluster_classes']}")
    for limitation in result.summary["limitations"]:
        print(f"  note: {limitation}")
    print(f"Leak check: {'PASS' if verification['valid'] else 'FAIL'}")
    for error in verification["errors"]:
        print(f"  error: {error}")
    if args.json:
        print(json.dumps(result.summary, indent=2))
    return 0 if verification["valid"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
