"""Audit the 15-class rice disease & pest dataset (read-only).

Examples (PowerShell, from KRISIVEDA-ML):

    python scripts/audit_rice_disease_dataset.py
    python scripts/audit_rice_disease_dataset.py --workers 1 --near-dup-distance 6

The source images are never modified, moved, relabelled or deleted.
Reports are written to ``reports/rice_disease_15class/``.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.rice_disease_15class.audit import (  # noqa: E402
    DEFAULT_NEAR_DUPLICATE_DISTANCE,
    audit_dataset,
    format_summary,
)
from app.rice_disease_15class.config import DATASET_ROOT, REPORTS_ROOT  # noqa: E402
from app.rice_disease_15class.taxonomy import TaxonomyError  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dataset", type=Path, default=DATASET_ROOT)
    parser.add_argument("--output-dir", type=Path, default=REPORTS_ROOT)
    parser.add_argument(
        "--workers",
        type=int,
        default=min(4, max(1, (os.cpu_count() or 2) // 2)),
        help="Worker processes for image probing (1 = in-process).",
    )
    parser.add_argument(
        "--near-dup-distance",
        type=int,
        default=DEFAULT_NEAR_DUPLICATE_DISTANCE,
        help="dHash Hamming distance treated as a near duplicate (0 disables).",
    )
    parser.add_argument("--json", action="store_true", help="Print the full JSON report.")
    args = parser.parse_args()

    try:
        report = audit_dataset(
            root=args.dataset,
            output_dir=args.output_dir,
            workers=args.workers,
            near_duplicate_distance=args.near_dup_distance,
        )
    except (FileNotFoundError, TaxonomyError) as exc:
        print(f"Audit failed: {exc}", file=sys.stderr)
        return 2

    print(format_summary(report))
    print()
    print(f"Reports written to {args.output_dir}")
    if args.json:
        print(json.dumps(report, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
