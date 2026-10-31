"""Export the 15-class checkpoint to ONNX and verify PyTorch/ONNX parity.

Defaults target the v2 development model:

    python scripts/export_rice_disease_15class_onnx.py --parity-only

To export a separate experiment without touching the v2 artefacts, point every
output at the experiment directory (see --metadata / --parity / --model-version):

    python scripts/export_rice_disease_15class_onnx.py \
        --checkpoint models/rice_disease_15class/rice-disease-15class-v3-exp20/best.pt \
        --output models/rice_disease_15class/rice-disease-15class-v3-exp20/rice_disease_15class.onnx \
        --metadata models/rice_disease_15class/rice-disease-15class-v3-exp20/model_metadata.json \
        --parity models/rice_disease_15class/rice-disease-15class-v3-exp20/onnx_parity.json \
        --model-version rice-disease-15class-v3-exp20

The production 6-class ONNX model is never modified.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.rice_disease_15class.config import (  # noqa: E402
    DATASET_ROOT,
    MODEL_ROOT,
    MODEL_VERSION,
    SPLIT_DIR,
    write_json,
)
from app.rice_disease_15class.data import read_manifest  # noqa: E402
from app.rice_disease_15class.export import (  # noqa: E402
    check_parity,
    export_onnx,
    write_metadata,
)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--checkpoint", type=Path, default=MODEL_ROOT / "best.pt")
    parser.add_argument("--output", type=Path, default=MODEL_ROOT / "rice_disease_15class.onnx")
    parser.add_argument(
        "--metadata",
        type=Path,
        default=None,
        help="Where model_metadata.json goes (default: next to --output).",
    )
    parser.add_argument(
        "--parity",
        type=Path,
        default=None,
        help="Where onnx_parity.json goes (default: next to --output).",
    )
    parser.add_argument(
        "--model-version",
        type=str,
        default=None,
        help="Version string stamped into the metadata (default: the checkpoint directory name).",
    )
    parser.add_argument("--test-manifest", type=Path, default=SPLIT_DIR / "test.csv")
    parser.add_argument("--dataset", type=Path, default=DATASET_ROOT)
    parser.add_argument("--opset", type=int, default=17)
    parser.add_argument("--parity-samples", type=int, default=128)
    parser.add_argument("--parity-only", action="store_true", help="Skip export; check the existing ONNX file.")
    parser.add_argument("--skip-parity", action="store_true")
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()

    # Defaults keep every artefact beside the ONNX file it describes, so an
    # experiment export can never silently overwrite the v2 metadata/parity.
    output_dir = Path(args.output).parent
    metadata_path = Path(args.metadata) if args.metadata else output_dir / "model_metadata.json"
    parity_path = Path(args.parity) if args.parity else output_dir / "onnx_parity.json"
    checkpoint_dir = Path(args.checkpoint).parent
    model_version = args.model_version or (
        MODEL_VERSION
        if output_dir.resolve() == MODEL_ROOT.resolve()
        else output_dir.name
    )

    try:
        # Hard guard: a checkpoint that is not the v2 development model must
        # never be allowed to write into the v2 directory at all.
        if checkpoint_dir.resolve() != MODEL_ROOT.resolve() and not args.parity_only:
            baseline = MODEL_ROOT.resolve()
            for label, target in (
                ("--output", Path(args.output)),
                ("--metadata", metadata_path),
                ("--parity", parity_path),
            ):
                if target.resolve().parent == baseline:
                    raise ValueError(
                        f"Refusing to write {label}={target} into the v2 directory "
                        f"{MODEL_ROOT}. Pass explicit paths inside {checkpoint_dir}."
                    )

        if args.parity_only:
            export_info = json.loads(
                metadata_path.read_text(encoding="utf-8")
            )["onnx"]
        else:
            export_info = export_onnx(
                checkpoint_path=args.checkpoint,
                output_path=args.output,
                opset=args.opset,
            )
            print(
                f"Exported {export_info['onnx_path']} "
                f"({export_info['bytes']:,} bytes, sha256={export_info['sha256'][:16]})"
            )
            print(f"ONNX IO: {export_info['input_name']}{export_info['input_shape']} -> {export_info['output_name']}{export_info['output_shape']}")

        parity = None
        if not args.skip_parity:
            if not args.test_manifest.is_file():
                raise FileNotFoundError(
                    f"Test manifest not found: {args.test_manifest}. Run the split script first."
                )
            rows = read_manifest(args.test_manifest)
            parity = check_parity(
                checkpoint_path=args.checkpoint,
                onnx_path=Path(export_info["onnx_path"]),
                rows=rows,
                dataset_root=args.dataset,
                sample_size=args.parity_samples,
            )
            # ASCII only: the Windows console code page cannot encode delta/symbols.
            print(
                f"Parity on {parity['samples']} images: max_abs_logit_diff={parity['max_abs_logit_difference']:.3e} "
                f"mean_abs_logit_diff={parity['mean_abs_logit_difference']:.3e} "
                f"argmax agreement={parity['predicted_class_agreement']:.4f} "
                f"within atol={parity['all_within_atol']}"
            )
            write_json(parity_path, parity)
            print(f"Parity report written to {parity_path}")

        # Prefer the experiment's own training_config.json (next to the
        # checkpoint); fall back to the v2 one only for the default layout.
        training_config = None
        for candidate in (
            checkpoint_dir / "training_config.json",
            MODEL_ROOT / "training_config.json",
        ):
            if candidate.is_file():
                training_config = json.loads(candidate.read_text(encoding="utf-8"))
                break
        write_metadata(
            export_info,
            parity,
            output_path=metadata_path,
            training_config=training_config,
            model_version=model_version,
        )
        print(f"Metadata (model_version={model_version}) written to {metadata_path}")
        if args.json:
            print(json.dumps({"export": export_info, "parity": parity}, indent=2))
    except (FileNotFoundError, ValueError, RuntimeError, OSError) as exc:
        print(f"Export/parity failed: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
