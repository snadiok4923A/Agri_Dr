"""Build the human label-review queue from the existing audit/evaluation reports.

    python scripts/build_review_queue.py
    python scripts/build_review_queue.py --max-images-per-case 12 --json

Reads (never writes) the dataset and these reports:

* ``reports/rice_disease_15class/dataset_audit_review.csv``
* ``reports/rice_disease_15class/dataset_index.csv``
* ``reports/rice_disease_15class/evaluation/test_misclassified.csv``
* ``reports/rice_disease_15class/splits/split_manifest.csv``

Writes, under ``reports/rice_disease_15class/review/``: ``review_cases.csv``,
``review_items.csv``, ``review_queue.json``, ``review_cases.md`` and
``review.html``. No image is moved, renamed, relabelled or deleted, and no
model, checkpoint, split manifest or API file is touched.
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
    REPORTS_ROOT,
    SPLIT_DIR,
)
from app.rice_disease_15class.review import (  # noqa: E402
    REVIEW_DIR,
    build_review_outputs,
    build_review_queue,
    format_summary,
)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--audit-review", type=Path, default=REPORTS_ROOT / "dataset_audit_review.csv")
    parser.add_argument("--index", type=Path, default=REPORTS_ROOT / "dataset_index.csv")
    parser.add_argument("--misclassified", type=Path, default=EVALUATION_DIR / "test_misclassified.csv")
    parser.add_argument("--split-manifest", type=Path, default=SPLIT_DIR / "split_manifest.csv")
    parser.add_argument("--dataset", type=Path, default=DATASET_ROOT)
    parser.add_argument("--output-dir", type=Path, default=REVIEW_DIR)
    parser.add_argument(
        "--max-images-per-case",
        type=int,
        default=24,
        help="Thumbnails shown per case; the full count is always reported.",
    )
    parser.add_argument("--json", action="store_true", help="Print the summary as JSON.")
    args = parser.parse_args()

    missing = [
        str(path)
        for path in (args.audit_review, args.index)
        if not Path(path).is_file()
    ]
    if missing:
        print(
            "Missing required report(s): " + ", ".join(missing) + "\n"
            "Run scripts/audit_rice_disease_dataset.py first.",
            file=sys.stderr,
        )
        return 1
    if not args.misclassified.is_file():
        print(
            f"Note: {args.misclassified} not found; the queue will contain duplicate evidence only.",
            file=sys.stderr,
        )

    try:
        cases = build_review_queue(
            audit_review=args.audit_review,
            index=args.index,
            misclassified=args.misclassified,
            split_manifest=args.split_manifest if args.split_manifest.is_file() else None,
            max_images_per_case=args.max_images_per_case,
        )
        summary = build_review_outputs(cases, output_dir=args.output_dir, dataset_root=args.dataset)
    except (FileNotFoundError, ValueError, OSError) as exc:
        print(f"Review queue failed: {exc}", file=sys.stderr)
        return 1

    if args.json:
        print(json.dumps(summary, indent=2))
    else:
        print(format_summary(summary))
        print("")
        print("Open this in a browser: " + summary["files"]["review.html"])
        print("No decision has been applied; no image or label was changed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
