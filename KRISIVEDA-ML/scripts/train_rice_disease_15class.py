"""Train the 15-class rice disease & pest model on CPU.

Prerequisites (from KRISIVEDA-ML):

    python scripts/audit_rice_disease_dataset.py
    python scripts/split_rice_disease_dataset.py

Example CPU run:

    python scripts/train_rice_disease_15class.py --epochs 6 --batch-size 64 --workers 2

Artefacts are written to models/rice_disease_15class/rice-disease-15class-v2/.
The 6-class production model is never read or written here.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.rice_disease_15class.config import (  # noqa: E402
    DATASET_ROOT,
    DEFAULT_SEED,
    MODEL_ROOT,
    MODEL_VERSION,
    SPLIT_DIR,
)
from app.rice_disease_15class.train import TrainConfig, TrainResult, train_model  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--train-manifest", type=Path, default=SPLIT_DIR / "train.csv")
    parser.add_argument("--val-manifest", type=Path, default=SPLIT_DIR / "validation.csv")
    parser.add_argument("--dataset", type=Path, default=DATASET_ROOT)
    parser.add_argument("--output-dir", type=Path, default=MODEL_ROOT)
    parser.add_argument("--epochs", type=int, default=6)
    parser.add_argument("--batch-size", type=int, default=64)
    parser.add_argument("--lr", type=float, default=1e-3)
    parser.add_argument("--weight-decay", type=float, default=1e-4)
    parser.add_argument("--freeze-epochs", type=int, default=1)
    parser.add_argument("--patience", type=int, default=3)
    parser.add_argument("--workers", type=int, default=2, help="DataLoader workers (0 = main process).")
    parser.add_argument("--threads", type=int, default=0, help="torch CPU threads (0 = library default).")
    parser.add_argument("--image-size", type=int, default=224)
    parser.add_argument(
        "--max-train-per-class",
        type=int,
        default=None,
        help="Optional per-class cap for CPU-budgeted runs (reported in the training config).",
    )
    parser.add_argument("--max-val-per-class", type=int, default=None)
    parser.add_argument("--seed", type=int, default=DEFAULT_SEED)
    parser.add_argument(
        "--model-version",
        default=MODEL_VERSION,
        help=(
            "Version string stamped into checkpoints/config. Set it when the output "
            "directory is a new experiment, so files do not claim to be the released model."
        ),
    )
    parser.add_argument("--no-class-weights", action="store_true")
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()

    for manifest in (args.train_manifest, args.val_manifest):
        if not manifest.is_file():
            print(
                f"Missing split manifest: {manifest}\n"
                "Run: python scripts/audit_rice_disease_dataset.py && "
                "python scripts/split_rice_disease_dataset.py",
                file=sys.stderr,
            )
            return 2

    config = TrainConfig(
        train_manifest=args.train_manifest,
        val_manifest=args.val_manifest,
        output_dir=args.output_dir,
        dataset_root=args.dataset,
        epochs=args.epochs,
        batch_size=args.batch_size,
        learning_rate=args.lr,
        weight_decay=args.weight_decay,
        freeze_epochs=args.freeze_epochs,
        patience=args.patience,
        workers=args.workers,
        threads=args.threads,
        max_train_per_class=args.max_train_per_class,
        max_val_per_class=args.max_val_per_class,
        class_weights=not args.no_class_weights,
        image_size=args.image_size,
        seed=args.seed,
        model_version=args.model_version,
    )

    try:
        result: TrainResult = train_model(config)
    except KeyboardInterrupt:
        print(
            "\nInterrupted. The last completed epoch was written to last.pt / training_history.json; "
            "re-run to start a fresh run (no resume mode yet).",
            file=sys.stderr,
        )
        return 130
    except (RuntimeError, ValueError, OSError) as exc:
        print(f"Training failed: {exc}", file=sys.stderr)
        return 1

    print(
        f"status={result.status} epochs={result.epochs_completed} "
        f"best_epoch={result.best_epoch} best_val_macro_f1={result.best_val_macro_f1}"
    )
    if args.json:
        print(json.dumps(result.history, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
