"""Validate human label-review decisions and write a proposed override file.

    python scripts/apply_label_decisions.py reports/rice_disease_15class/review/review_decisions.csv

The decision file comes from the review page's "Export decisions CSV" button
(or a hand-filled ``review_cases.csv``). Every row is validated; one bad row
aborts the whole run so a partially-applied review cannot happen.

Output (``reports/rice_disease_15class/labels/``):

* ``label_overrides_proposed.csv`` — ``relative_path`` -> corrected class for
  the images a human marked wrong;
* ``label_overrides_summary.json`` — counts, per-class moves, next steps.

This does **not** relabel, move, rename, delete or overwrite any image, and it
does not touch the audit, the split manifests, the checkpoints, the ONNX model
or the API. Labels on disk are folder names; the override file is what a future
versioned dataset consumes.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.rice_disease_15class.config import DATASET_ROOT  # noqa: E402
from app.rice_disease_15class.review import LABELS_DIR, apply_decisions  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("decisions", type=Path)
    parser.add_argument("--dataset", type=Path, default=DATASET_ROOT)
    parser.add_argument("--output-dir", type=Path, default=LABELS_DIR)
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()

    if not args.decisions.is_file():
        print(f"Decision file not found: {args.decisions}", file=sys.stderr)
        return 1

    try:
        summary = apply_decisions(args.decisions, output_dir=args.output_dir, dataset_root=args.dataset)
    except (FileNotFoundError, ValueError, OSError) as exc:
        print(f"Decisions rejected: {exc}", file=sys.stderr)
        existing = Path(args.output_dir) / "label_overrides_proposed.csv"
        if existing.is_file():
            print(
                f"Nothing was written. {existing} is unchanged and still reflects an earlier run.",
                file=sys.stderr,
            )
        return 1

    if args.json:
        print(json.dumps(summary, indent=2))
    else:
        print(
            f"Read {summary['rows_read']} rows for {summary['images_reviewed']} images: "
            + ", ".join(f"{key}={value}" for key, value in summary["decisions"].items())
        )
        print(f"Corrections proposed: {summary['corrections']}")
        for move in summary["moves"][:10]:
            print(f"  {move['from']} -> {move['to']}: {move['images']} images")
        print(f"Wrote {Path(args.output_dir) / 'label_overrides_proposed.csv'}")
        print("Status: proposed only. No dataset, split, model or API was modified.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
