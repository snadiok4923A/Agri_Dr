"""Train the 15-class rice disease & pest model **from scratch**.

This is a separate experiment, not a replacement for
``scripts/train_rice_disease_15class.py`` (which fine-tunes ImageNet weights).
Here every weight starts from random initialization: no ImageNet download, no
existing checkpoint, no frozen backbone.

``--init-from PATH`` turns a run into a **warm start**, not an exact resume: the
weights of an existing from-scratch checkpoint are loaded and training continues
at the next epoch, but the optimizer and learning-rate schedule are
re-initialised from scratch (the v1 checkpoints never stored their state), so
AdamW moments, schedule position and RNG state all restart. Warm starts
therefore default to a lower learning rate (3e-4) and always write to a new
directory. New checkpoints do record optimizer/scheduler state, so a future
*exact* resume can be built on them.

What is reused (unchanged, imported): the MobileNetV3-Small builder in
:mod:`app.rice_disease_15class.model`, the manifest dataset and training
augmentation in :mod:`app.rice_disease_15class.data`, the deterministic
preprocessing contract in :mod:`app.rice_disease_15class.preprocess`, the
15-class taxonomy and the shared seed/version constants.

Safety:

* outputs go to ``models/rice_disease_scratch_v1/`` (or ``--output-dir``), a
  brand-new directory that refuses to overwrite existing files without
  ``--overwrite``;
* the production 6-class artifacts and the existing 15-class v2/v3 artifact
  directories are rejected as output targets;
* the test manifest is never read — only train and validation CSV files.

Example (smoke test, ~1 minute, NOT a final model):

    python scripts/train_rice_disease_scratch.py --smoke --epochs 1 \\
        --output-dir models/rice_disease_scratch_smoke

Example (full run on the RTX 3050):

    python scripts/train_rice_disease_scratch.py --epochs 40 --batch-size 16 \\
        --workers 4

Example (warm start from a finished epoch-3 checkpoint, 10 more epochs):

    python scripts/train_rice_disease_scratch.py \\
        --init-from models/rice_disease_scratch_v1/last.pt --epochs 10

Artefacts: ``best.pt``, ``last.pt``, ``training_history.json``,
``training_history.csv``, ``training_config.json``, ``class_mapping.json``,
``training.log`` and — for warm starts — ``previous_run.json`` (the source
checkpoint's provenance and history, preserved verbatim).
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import platform
import random
import sys
import time
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Sequence

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.rice_disease_15class import taxonomy  # noqa: E402
from app.rice_disease_15class.config import (  # noqa: E402
    DATASET_ROOT,
    DEFAULT_SEED,
    IMAGE_SIZE,
    IMAGENET_MEAN,
    IMAGENET_STD,
    RESIZE_SIZE,
    SERVICE_ROOT,
    SPLIT_DIR,
    write_json,
)
from app.rice_disease_15class.data import (  # noqa: E402
    ManifestDataset,
    ManifestRow,
    class_counts,
    read_manifest,
    subsample_manifest,
)
from app.rice_disease_15class.preprocess import to_model_tensor, to_rgb  # noqa: E402

#: Stamped into checkpoints and config so a scratch run is never mistaken for
#: the released transfer-learned model.
MODEL_VERSION = "rice-disease-scratch-v1"
SCRATCH_MODEL_ROOT = SERVICE_ROOT / "models" / "rice_disease_scratch_v1"

#: Stamp for warm-start runs, so they are distinguishable from both the
#: original from-scratch run and the transfer-learned v2/v3 models.
WARMSTART_MODEL_VERSION = "rice-disease-warmstart-v1"
WARMSTART_MODEL_ROOT = SERVICE_ROOT / "models" / "rice_disease_warmstart_v1"

#: Conservative warm-start learning rate. The source checkpoint's optimizer
#: state is gone, so restarting at the original 1e-3 would risk destroying the
#: weights that were already learned.
WARMSTART_LR = 3e-4
SCRATCH_LR = 1e-3

#: Checkpoint ``training_mode`` values a warm start may continue from. A
#: transfer-learned or unknown source is a different experiment and is refused.
SUPPORTED_INIT_MODES = ("from_scratch", "warm_start")

#: Checkpoint format written by this script. Bumped when the payload changes,
#: so a future exact-resume loader can check what it is reading.
CHECKPOINT_FORMAT_VERSION = 2

MODELS_ROOT = SERVICE_ROOT / "models"
#: Existing 15-class artifact root (v2, v3-exp20, ...). Never a valid target.
FROZEN_15CLASS_ROOT = MODELS_ROOT / "rice_disease_15class"
#: Production 6-class files. Never a valid target.
FROZEN_V1_FILES = (
    MODELS_ROOT / "rice_disease_model.onnx",
    MODELS_ROOT / "class_names.json",
)

OOM_GUIDANCE = (
    "CUDA ran out of memory. Retry with a smaller batch, e.g.\n"
    "  python scripts/train_rice_disease_scratch.py --batch-size 8\n"
    "If you were warm-starting, pass the same --init-from argument again.\n"
    "If it still fails, lower the resolution as well (experimental — it no longer\n"
    "matches the 224 px inference contract):\n"
    "  python scripts/train_rice_disease_scratch.py --batch-size 8 --image-size 192\n"
    "Also close other GPU users (games, browsers with hardware acceleration) and\n"
    "check free VRAM with: nvidia-smi"
)


# --------------------------------------------------------------------------
# Output-path safety
# --------------------------------------------------------------------------


def resolve_output_dir(requested: Path, overwrite: bool = False) -> Path:
    """Return a writable, brand-new output directory or raise.

    Raises ``ValueError`` for protected locations (production 6-class model,
    the existing 15-class artifact tree, the dataset and the split manifests)
    and ``FileExistsError`` when the target already holds files and
    ``overwrite`` is false.
    """

    resolved = Path(requested).expanduser().resolve()
    mods = MODELS_ROOT.resolve()
    frozen_15 = FROZEN_15CLASS_ROOT.resolve()

    if resolved == mods:
        raise ValueError(f"Refusing to use the models root itself as an output directory: {resolved}")
    if resolved == frozen_15 or frozen_15 in resolved.parents:
        raise ValueError(
            f"Refusing to write into the existing 15-class artifact tree: {resolved}\n"
            f"Use a new directory such as {SCRATCH_MODEL_ROOT}"
        )
    if resolved in {path.resolve() for path in FROZEN_V1_FILES}:
        raise ValueError(f"Refusing to overwrite a production model file: {resolved}")
    if resolved in {DATASET_ROOT.resolve(), SPLIT_DIR.resolve()}:
        raise ValueError(f"Refusing to write model output into data/manifests: {resolved}")

    if resolved.exists():
        if not resolved.is_dir():
            raise ValueError(f"Output path exists and is not a directory: {resolved}")
        existing = list(resolved.iterdir())
        if existing and not overwrite:
            raise FileExistsError(
                f"Output directory is not empty: {resolved}\n"
                f"Found {len(existing)} entr{'y' if len(existing) == 1 else 'ies'} "
                f"(e.g. {existing[0].name}). Pass --overwrite to replace them, or choose a new --output-dir."
            )
    resolved.mkdir(parents=True, exist_ok=True)
    return resolved


# --------------------------------------------------------------------------
# Warm start: load, validate and continue from an existing checkpoint
# --------------------------------------------------------------------------

REQUIRED_CHECKPOINT_KEYS = (
    "model_state",
    "epoch",
    "class_ids",
    "architecture",
    "training_mode",
    "image_size",
)


def _sha256(path: Path) -> str:
    """Checksum of a checkpoint file (recorded as warm-start provenance)."""

    digest = hashlib.sha256()
    with Path(path).open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


@dataclass(frozen=True)
class InitCheckpoint:
    """Validated contents of a checkpoint a run is warm-started from."""

    path: Path
    sha256: str
    model_state: dict[str, Any]
    epoch: int
    val_macro_f1: float | None
    history: list[dict[str, Any]]
    training_mode: str
    image_size: int
    class_ids: list[str]
    architecture: str
    model_version: str | None
    smoke_test: bool
    source_config: dict[str, Any]


def load_init_checkpoint(
    path: Path,
    *,
    expected_image_size: int = IMAGE_SIZE,
    expected_class_ids: Sequence[str] | None = None,
) -> InitCheckpoint:
    """Read a from-scratch checkpoint and validate its metadata.

    Strictly read-only: the file is opened for reading only and never rewritten.
    Raises ``ValueError`` for an incompatible or unreadable checkpoint, naming
    the field that is wrong so the fix is obvious.
    """

    import torch

    source = Path(path).expanduser()
    if not source.is_file():
        raise ValueError(f"--init-from checkpoint not found: {source}")

    try:
        payload = torch.load(source, map_location="cpu", weights_only=True)
    except Exception as exc:  # noqa: BLE001 - any load failure is the same fix
        raise ValueError(
            f"Could not read checkpoint {source}: {type(exc).__name__}: {exc}\n"
            "Expected a .pt file written by this script."
        ) from exc

    if not isinstance(payload, dict):
        raise ValueError(f"Checkpoint {source} is not a dictionary of training state.")

    missing = [key for key in REQUIRED_CHECKPOINT_KEYS if key not in payload]
    if missing:
        raise ValueError(
            f"Checkpoint {source} is missing required entries: {', '.join(missing)}.\n"
            "It was probably written by a different script or is not a model checkpoint."
        )

    architecture = str(payload["architecture"])
    if architecture != "mobilenet_v3_small":
        raise ValueError(
            f"Checkpoint architecture is {architecture!r}, expected 'mobilenet_v3_small'. "
            "This warm-start path only continues MobileNetV3-Small runs."
        )

    class_ids = [str(value) for value in payload["class_ids"]]
    expected = list(expected_class_ids or taxonomy.CLASS_IDS)
    if class_ids != expected:
        raise ValueError(
            "Checkpoint class order does not match the 15-class taxonomy.\n"
            f"  checkpoint: {class_ids}\n  expected:   {expected}\n"
            "Continuing would silently attach weights to the wrong labels."
        )

    image_size = int(payload["image_size"])
    if image_size != int(expected_image_size):
        raise ValueError(
            f"Checkpoint was trained at image_size={image_size}, this run uses {expected_image_size}. "
            "Pass the matching --image-size, or start a new run instead of warm-starting."
        )

    training_mode = str(payload["training_mode"])
    if training_mode not in SUPPORTED_INIT_MODES:
        raise ValueError(
            f"Checkpoint training_mode={training_mode!r} is not warm-startable "
            f"(supported: {', '.join(SUPPORTED_INIT_MODES)}). "
            "Warm-starting from a transfer-learned model is a different experiment."
        )

    if payload.get("pretrained") is not False:
        raise ValueError(
            f"Checkpoint reports pretrained={payload.get('pretrained')!r}; a warm start only continues "
            "from a from-scratch run (pretrained=False)."
        )

    epoch = payload["epoch"]
    if not isinstance(epoch, int) or epoch < 1:
        raise ValueError(f"Checkpoint epoch={epoch!r} is not a positive integer; cannot continue from it.")

    model_state = payload["model_state"]
    if not isinstance(model_state, dict) or not model_state:
        raise ValueError(f"Checkpoint {source} contains no model weights.")

    raw_f1 = payload.get("val_macro_f1")
    val_macro_f1 = float(raw_f1) if isinstance(raw_f1, (int, float)) else None
    history = [dict(entry) for entry in payload.get("history") or [] if isinstance(entry, dict)]
    source_config = payload.get("config")

    return InitCheckpoint(
        path=source,
        sha256=_sha256(source),
        model_state=model_state,
        epoch=int(epoch),
        val_macro_f1=val_macro_f1,
        history=history,
        training_mode=training_mode,
        image_size=image_size,
        class_ids=class_ids,
        architecture=architecture,
        model_version=payload.get("model_version"),
        smoke_test=bool(payload.get("smoke_test")),
        source_config=dict(source_config) if isinstance(source_config, dict) else {},
    )


def verify_state_dict_compatible(model, model_state: dict[str, Any]) -> None:
    """Check keys and shapes before ``load_state_dict`` produces a cryptic error."""

    expected = model.state_dict()
    missing = sorted(set(expected) - set(model_state))
    unexpected = sorted(set(model_state) - set(expected))
    if missing or unexpected:
        raise ValueError(
            "Checkpoint weights do not match the model architecture.\n"
            f"  missing from checkpoint: {missing[:5]}{' ...' if len(missing) > 5 else ''}\n"
            f"  unexpected in checkpoint: {unexpected[:5]}{' ...' if len(unexpected) > 5 else ''}"
        )

    for name, tensor in expected.items():
        candidate = model_state[name]
        if tuple(candidate.shape) != tuple(tensor.shape):
            raise ValueError(
                f"Checkpoint tensor {name!r} has shape {tuple(candidate.shape)}, "
                f"the model expects {tuple(tensor.shape)}. "
                "The number of classes or the image size may have changed."
            )


def resolve_start_epoch(source_epoch: int, override: int | None = None) -> int:
    """First epoch of the new run: always at least one after the source epoch."""

    first = source_epoch + 1
    if override is None:
        return first
    if override < first:
        raise ValueError(
            f"--init-start-epoch={override} would re-train epochs already completed in the checkpoint "
            f"(it finished epoch {source_epoch}). Use {first} or later, or omit the flag."
        )
    return override


def epoch_schedule(start_epoch: int, new_epochs: int) -> list[int]:
    """Continuous epoch numbers for the new run, e.g. ``[4, 5, 6]``."""

    if new_epochs < 1:
        raise ValueError("--epochs must be at least 1.")
    return list(range(start_epoch, start_epoch + new_epochs))


def resolve_learning_rate(requested: float | None, warm_start: bool) -> float:
    """Default LR: 3e-4 for a warm start, 1e-3 for from scratch."""

    if requested is not None:
        return float(requested)
    return WARMSTART_LR if warm_start else SCRATCH_LR


def resolve_model_version(requested: str | None, warm_start: bool) -> str:
    if requested:
        return str(requested)
    return WARMSTART_MODEL_VERSION if warm_start else MODEL_VERSION


def resolve_output_dir_for_run(
    requested: Path | None,
    *,
    source_checkpoint: Path | None = None,
    overwrite: bool = False,
) -> Path:
    """Resolve the output directory, refusing to write over the source run.

    Warm starts get ``models/rice_disease_warmstart_v1`` by default and may
    never target the directory that holds the checkpoint they continue from, so
    the earlier run stays byte-for-byte intact.
    """

    target = requested if requested is not None else (
        WARMSTART_MODEL_ROOT if source_checkpoint is not None else SCRATCH_MODEL_ROOT
    )
    if source_checkpoint is not None:
        resolved_target = Path(target).expanduser().resolve()
        source = Path(source_checkpoint).expanduser().resolve()
        if resolved_target == source.parent or resolved_target in source.parents:
            raise ValueError(
                f"Refusing to warm-start into the directory that holds the source checkpoint: {resolved_target}\n"
                "Pick a new --output-dir so the original run is never modified."
            )
    return resolve_output_dir(target, overwrite=overwrite)


def build_checkpoint_payload(
    *,
    model_state: dict[str, Any],
    optimizer_state: dict[str, Any],
    scheduler_state: dict[str, Any],
    epoch: int,
    val_macro_f1: float,
    best_val_macro_f1: float | None,
    best_epoch: int | None,
    best_source: str,
    config: "ScratchConfig",
    history: Sequence[dict[str, Any]],
    previous_history: Sequence[dict[str, Any]] = (),
    init_state: InitCheckpoint | None = None,
) -> dict[str, Any]:
    """Assemble a self-describing checkpoint (weights + full training state).

    Optimizer and scheduler state are included so a future *exact* resume can
    pick up mid-schedule; ``warm_start`` records that this run, unlike the one
    it continued from, restarted its optimizer.
    """

    warm_start = None
    if init_state is not None:
        warm_start = {
            "init_from": str(init_state.path),
            "source_sha256": init_state.sha256,
            "source_epoch": init_state.epoch,
            "source_val_macro_f1": init_state.val_macro_f1,
            "source_training_mode": init_state.training_mode,
            "source_model_version": init_state.model_version,
            "started_at_epoch": min((entry.get("epoch") for entry in history), default=None),
            "optimizer_reset": True,
            "scheduler_reset": True,
            "exact_resume": False,
            "note": (
                "Weights were loaded from the source checkpoint; AdamW moments and the LR "
                "schedule were re-initialised because the source checkpoint did not store them. "
                "This is warm-start fine-tuning, not an exact resume."
            ),
        }

    return {
        "format_version": CHECKPOINT_FORMAT_VERSION,
        "model_state": model_state,
        "optimizer_state": optimizer_state,
        "scheduler_state": scheduler_state,
        "class_ids": list(taxonomy.CLASS_IDS),
        "architecture": "mobilenet_v3_small",
        "training_mode": "warm_start" if init_state is not None else "from_scratch",
        "pretrained": False,
        "smoke_test": config.smoke_test,
        "model_version": config.model_version,
        "image_size": config.image_size,
        "epoch": epoch,
        "val_macro_f1": val_macro_f1,
        "best_val_macro_f1": best_val_macro_f1,
        "best_epoch": best_epoch,
        "best_source": best_source,
        "history": list(history),
        "previous_history": list(previous_history),
        "previous_run": (
            {
                "source": str(init_state.path),
                "source_sha256": init_state.sha256,
                "source_epoch": init_state.epoch,
                "source_training_mode": init_state.training_mode,
                "source_model_version": init_state.model_version,
                "source_smoke_test": init_state.smoke_test,
                "epochs_preserved": len(previous_history),
            }
            if init_state is not None
            else None
        ),
        "warm_start": warm_start,
        "config": config.serialisable(),
        "resume_ready": True,
    }


# --------------------------------------------------------------------------
# Model / transforms / determinism
# --------------------------------------------------------------------------


def build_scratch_model(num_classes: int = taxonomy.NUM_CLASSES, image_size: int = IMAGE_SIZE):
    """MobileNetV3-Small with **random** weights and a 15-class head.

    Reuses :func:`app.rice_disease_15class.model.build_model` but forces
    ``pretrained=False``, which maps to ``weights=None`` in torchvision — no
    download, no checkpoint, every parameter trainable.
    """

    from app.rice_disease_15class.model import build_model

    model = build_model(num_classes=num_classes, pretrained=False)
    model.image_size = image_size  # type: ignore[attr-defined]
    for parameter in model.parameters():
        parameter.requires_grad = True
    return model


class EvalTransform:
    """Deterministic validation transform (picklable for Windows workers).

    At the default 224 px it delegates to the shared inference contract
    (:func:`to_model_tensor`), so validation and serving agree exactly. For a
    non-default resolution the same resize/crop arithmetic is applied
    proportionally — useful for VRAM experiments, but such a model no longer
    matches the 224 px serving contract.
    """

    def __init__(self, image_size: int = IMAGE_SIZE) -> None:
        self.image_size = int(image_size)
        #: Short edge to resize to before the centre crop (256 at 224 px).
        self.short_edge = max(self.image_size + 1, int(round(self.image_size * RESIZE_SIZE / IMAGE_SIZE)))

    def __call__(self, image: Image.Image):
        import torch

        if self.image_size == IMAGE_SIZE:
            return torch.from_numpy(to_model_tensor(image))

        rgb = to_rgb(image)
        width, height = rgb.size
        if width < 32 or height < 32:
            raise ValueError("Image is too small. Upload a clearer photo.")

        scale = self.short_edge / min(width, height)
        resized = rgb.resize(
            (max(1, round(width * scale)), max(1, round(height * scale))),
            Image.Resampling.BILINEAR,
        )
        left = (resized.size[0] - self.image_size) // 2
        top = (resized.size[1] - self.image_size) // 2
        cropped = resized.crop((left, top, left + self.image_size, top + self.image_size))

        array = np.asarray(cropped, dtype=np.float32) / 255.0
        array = (array - np.array(IMAGENET_MEAN, dtype=np.float32)) / np.array(IMAGENET_STD, dtype=np.float32)
        chw = np.ascontiguousarray(np.transpose(array, (2, 0, 1)), dtype=np.float32)
        return torch.from_numpy(chw)


class EvalManifestDataset(ManifestDataset):
    """``ManifestDataset`` with the deterministic transform for any resolution."""

    def __init__(self, rows: Sequence[ManifestRow], root: Path, image_size: int) -> None:
        super().__init__(rows, root=root, train=False, image_size=IMAGE_SIZE)
        self.transform = EvalTransform(image_size)


def _set_seed(seed: int) -> None:
    import torch

    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)
    torch.backends.cudnn.deterministic = True
    torch.backends.cudnn.benchmark = False


def _worker_init_fn(worker_id: int) -> None:
    import torch

    seed = (torch.initial_seed() + worker_id) % (2**32)
    random.seed(seed)
    np.random.seed(seed)


def select_device(requested: str = "auto"):
    """Resolve ``auto``/``cuda``/``cpu`` to a torch device."""

    import torch

    if requested == "cpu":
        return torch.device("cpu")
    if torch.cuda.is_available():
        return torch.device("cuda")
    if requested == "cuda":
        raise RuntimeError(
            "CUDA was requested but torch.cuda.is_available() is False. "
            f"This Python has torch {torch.__version__} ({torch.version.cuda or 'CPU build'}). "
            "Install the CUDA build or run with --device cpu."
        )
    return torch.device("cpu")


def device_report(device) -> dict[str, Any]:
    import torch

    report: dict[str, Any] = {
        "device": str(device),
        "torch_version": torch.__version__,
        "torch_cuda_version": torch.version.cuda,
        "cudnn_version": torch.backends.cudnn.version(),
        "python_version": platform.python_version(),
        "platform": platform.platform(),
    }
    if device.type == "cuda":
        report["gpu_name"] = torch.cuda.get_device_name(0)
        report["gpu_total_vram_gb"] = round(torch.cuda.get_device_properties(0).total_memory / 1024**3, 2)
    return report


# --------------------------------------------------------------------------
# Loss weighting / metrics
# --------------------------------------------------------------------------


def class_weights(rows: Sequence[ManifestRow]):
    """Inverse-frequency weights normalised to mean 1.0 (same rule as the v2 trainer)."""

    import torch

    counts = class_counts(rows)
    total = sum(counts.values())
    raw = [
        0.0 if counts.get(class_id, 0) == 0 else total / (taxonomy.NUM_CLASSES * counts[class_id])
        for class_id in taxonomy.CLASS_IDS
    ]
    present = [value for value in raw if value > 0]
    mean = sum(present) / len(present) if present else 1.0
    weights = [0.0 if counts.get(class_id, 0) == 0 else value / mean for class_id, value in zip(taxonomy.CLASS_IDS, raw)]
    return torch.tensor(weights, dtype=torch.float32), counts


def evaluate(model, loader, device) -> dict[str, Any]:
    """Return loss, accuracy, macro-F1 and per-class F1 on ``loader``."""

    import torch
    from sklearn.metrics import accuracy_score, f1_score

    criterion = torch.nn.CrossEntropyLoss(reduction="sum")
    model.eval()
    total_loss = 0.0
    total = 0
    y_true: list[int] = []
    y_pred: list[int] = []
    with torch.no_grad():
        for inputs, targets, _indices in loader:
            inputs = inputs.to(device, non_blocking=True)
            targets = targets.to(device, non_blocking=True)
            logits = model(inputs)
            total_loss += float(criterion(logits, targets))
            y_pred.extend(logits.argmax(dim=1).tolist())
            y_true.extend(targets.tolist())
            total += targets.numel()

    accuracy = float(accuracy_score(y_true, y_pred)) if y_true else 0.0
    macro_f1 = float(f1_score(y_true, y_pred, average="macro", zero_division=0)) if y_true else 0.0
    per_class = (
        f1_score(
            y_true,
            y_pred,
            average=None,
            labels=list(range(taxonomy.NUM_CLASSES)),
            zero_division=0,
        ).tolist()
        if y_true
        else []
    )
    return {
        "loss": total_loss / total if total else float("nan"),
        "accuracy": accuracy,
        "macro_f1": macro_f1,
        "per_class_f1": per_class,
    }


class _Log:
    """Write the same line to stdout and to the run's training.log."""

    def __init__(self, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        self._handle = path.open("a", encoding="utf-8")

    def write(self, message: str) -> None:
        print(message, flush=True)
        self._handle.write(message + "\n")
        self._handle.flush()

    def close(self) -> None:
        self._handle.close()


def _write_history_csv(path: Path, history: Sequence[dict[str, Any]]) -> None:
    if not history:
        return
    fieldnames = [key for key in history[0] if key != "val_per_class_f1"]
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for entry in history:
            writer.writerow({key: entry[key] for key in fieldnames})


# --------------------------------------------------------------------------
# Training
# --------------------------------------------------------------------------


@dataclass
class ScratchConfig:
    train_manifest: Path
    val_manifest: Path
    output_dir: Path | None = None
    dataset_root: Path = DATASET_ROOT
    epochs: int = 40
    batch_size: int = 16
    learning_rate: float = 1e-3
    weight_decay: float = 1e-4
    label_smoothing: float = 0.05
    patience: int = 8
    workers: int = 2
    seed: int = DEFAULT_SEED
    image_size: int = IMAGE_SIZE
    max_train_per_class: int | None = None
    max_val_per_class: int | None = None
    class_weights: bool = True
    device: str = "auto"
    overwrite: bool = False
    model_version: str = MODEL_VERSION
    #: Warm start: continue from this checkpoint (weights only, not optimizer).
    init_from: Path | None = None
    #: Optional first epoch of the new run; defaults to the source epoch + 1.
    init_start_epoch: int | None = None

    @property
    def warm_start(self) -> bool:
        return self.init_from is not None

    @property
    def training_mode(self) -> str:
        return "warm_start" if self.warm_start else "from_scratch"

    @property
    def smoke_test(self) -> bool:
        """A capped run is a plumbing check, never a reported model."""

        return self.max_train_per_class is not None or self.max_val_per_class is not None

    def serialisable(self) -> dict[str, Any]:
        payload = asdict(self)
        for key, value in payload.items():
            if isinstance(value, Path):
                payload[key] = str(value)
        return payload


@dataclass
class ScratchResult:
    status: str
    epochs_completed: int
    best_epoch: int | None
    best_val_macro_f1: float | None
    checkpoint_path: str | None
    output_dir: str
    smoke_test: bool
    error: str | None = None
    history: list[dict[str, Any]] = field(default_factory=list)
    training_mode: str = "from_scratch"
    start_epoch: int = 1
    #: ``warm_start`` if a new epoch beat the inherited best, else ``inherited``.
    best_source: str = "scratch"


def train(config: ScratchConfig) -> ScratchResult:
    """Run a from-scratch training job and write every artefact to ``output_dir``."""

    import torch
    from torch.utils.data import DataLoader

    from app.rice_disease_15class.model import total_parameter_count, trainable_parameter_count

    init_state: InitCheckpoint | None = None
    if config.init_from is not None:
        init_state = load_init_checkpoint(
            config.init_from,
            expected_image_size=config.image_size,
            expected_class_ids=taxonomy.CLASS_IDS,
        )

    output_dir = resolve_output_dir_for_run(
        config.output_dir,
        source_checkpoint=init_state.path if init_state is not None else None,
        overwrite=config.overwrite,
    )
    #: Recorded so training_config.json names the directory actually written.
    config.output_dir = output_dir
    log = _Log(output_dir / "training.log")

    first_epoch = resolve_start_epoch(init_state.epoch, config.init_start_epoch) if init_state else 1
    epoch_numbers = epoch_schedule(first_epoch, config.epochs)
    previous_history: list[dict[str, Any]] = list(init_state.history) if init_state else []

    device = select_device(config.device)
    _set_seed(config.seed)
    report = device_report(device)

    train_rows = subsample_manifest(
        read_manifest(config.train_manifest), config.max_train_per_class, config.seed
    )
    val_rows = subsample_manifest(
        read_manifest(config.val_manifest), config.max_val_per_class, config.seed + 1
    )
    if not train_rows:
        raise ValueError("Training manifest is empty.")
    if not val_rows:
        raise ValueError("Validation manifest is empty; cannot select a model.")

    train_dataset = ManifestDataset(
        train_rows, root=config.dataset_root, train=True, image_size=config.image_size
    )
    val_dataset = EvalManifestDataset(val_rows, root=config.dataset_root, image_size=config.image_size)

    pin_memory = device.type == "cuda"
    train_loader = DataLoader(
        train_dataset,
        batch_size=config.batch_size,
        shuffle=True,
        num_workers=config.workers,
        persistent_workers=config.workers > 0,
        pin_memory=pin_memory,
        worker_init_fn=_worker_init_fn,
        drop_last=False,
    )
    val_loader = DataLoader(
        val_dataset,
        batch_size=config.batch_size,
        shuffle=False,
        num_workers=config.workers,
        persistent_workers=config.workers > 0,
        pin_memory=pin_memory,
        worker_init_fn=_worker_init_fn,
    )

    model = build_scratch_model(taxonomy.NUM_CLASSES, config.image_size).to(device)
    if init_state is not None:
        verify_state_dict_compatible(model, init_state.model_state)
        model.load_state_dict(init_state.model_state, strict=True)
        model.to(device)
    weights, counts = class_weights(train_rows)
    criterion = torch.nn.CrossEntropyLoss(
        weight=weights.to(device) if config.class_weights else None,
        label_smoothing=config.label_smoothing,
    )
    optimizer = torch.optim.AdamW(
        [parameter for parameter in model.parameters() if parameter.requires_grad],
        lr=config.learning_rate,
        weight_decay=config.weight_decay,
    )
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=max(1, len(epoch_numbers)))

    log.write("=" * 78)
    heading = (
        "WARM START (weights loaded, optimizer + LR schedule re-initialised)"
        if init_state is not None
        else "FROM SCRATCH"
    )
    log.write(f"KRISIVEDA 15-class training {heading} — {datetime.now(timezone.utc).isoformat()}")
    log.write(
        f"model_version={config.model_version} training_mode={config.training_mode} "
        "pretrained=False exact_resume=False"
    )
    log.write(f"architecture=mobilenet_v3_small image_size={config.image_size} classes={taxonomy.NUM_CLASSES}")
    log.write(
        f"device={device} torch={report['torch_version']} cuda={report['torch_cuda_version']}"
        + (f" gpu={report.get('gpu_name')}" if device.type == "cuda" else "")
    )
    log.write(
        f"train images={len(train_rows)} validation images={len(val_rows)} epochs={config.epochs} "
        f"batch={config.batch_size} lr={config.learning_rate} patience={config.patience}"
    )
    log.write(
        f"epoch numbering: {epoch_numbers[0]}..{epoch_numbers[-1]} "
        f"({len(epoch_numbers)} new epoch{'s' if len(epoch_numbers) != 1 else ''})"
    )
    if init_state is not None:
        log.write(
            f"warm start from {init_state.path} (source epoch {init_state.epoch}, "
            f"val_macro_f1={init_state.val_macro_f1}, mode={init_state.training_mode}, "
            f"sha256={init_state.sha256[:16]}...)"
        )
        log.write(
            f"preserved history: {len(previous_history)} epoch(s) kept as metadata; "
            "optimizer and LR schedule re-initialised (warm start, NOT exact resume)"
        )
        if init_state.smoke_test:
            log.write(
                "WARNING: the source checkpoint came from a capped smoke-test run; continuing it only "
                "exercises the pipeline and cannot produce a meaningful model."
            )
    log.write(f"class counts (train): {json.dumps(counts, sort_keys=True)}")
    log.write(
        f"parameters: total={total_parameter_count(model):,} trainable={trainable_parameter_count(model):,}"
    )
    if config.smoke_test:
        log.write(
            "SMOKE TEST: per-class caps were applied "
            f"(train<={config.max_train_per_class}, val<={config.max_val_per_class}). "
            "These metrics do NOT describe model quality."
        )
    if config.image_size != IMAGE_SIZE:
        log.write(
            f"WARNING: image_size={config.image_size} differs from the {IMAGE_SIZE} px serving contract; "
            "an exported model would need matching inference changes."
        )
    log.write("=" * 78)

    history: list[dict[str, Any]] = []
    best_f1 = -1.0
    best_epoch: int | None = None
    best_source = "scratch"
    epochs_without_improvement = 0
    if init_state is not None and init_state.val_macro_f1 is not None:
        # Keep the inherited best, so best.pt is only written when a new epoch
        # genuinely beats the checkpoint this run continued from.
        best_f1 = float(init_state.val_macro_f1)
        best_epoch = int(init_state.epoch)
        best_source = "inherited"
        log.write(
            f"best-so-far inherited from checkpoint: epoch {best_epoch} "
            f"val_macro_f1={best_f1:.4f} (a new epoch must beat it to become best.pt)"
        )
    status = "completed"
    error: str | None = None
    start = time.perf_counter()
    oom_error = getattr(torch.cuda, "OutOfMemoryError", RuntimeError)

    def checkpoint_payload(epoch: int, val_macro_f1: float) -> dict[str, Any]:
        return build_checkpoint_payload(
            model_state=model.state_dict(),
            optimizer_state=optimizer.state_dict(),
            scheduler_state=scheduler.state_dict(),
            epoch=epoch,
            val_macro_f1=val_macro_f1,
            best_val_macro_f1=best_f1 if best_epoch is not None else None,
            best_epoch=best_epoch,
            best_source=best_source,
            config=config,
            history=history,
            previous_history=previous_history,
            init_state=init_state,
        )

    try:
        for epoch in epoch_numbers:
            epoch_start = time.perf_counter()
            model.train()
            running_loss = 0.0
            seen = 0
            for step, (inputs, targets, _indices) in enumerate(train_loader, start=1):
                inputs = inputs.to(device, non_blocking=True)
                targets = targets.to(device, non_blocking=True)
                optimizer.zero_grad(set_to_none=True)
                logits = model(inputs)
                loss = criterion(logits, targets)
                loss.backward()
                optimizer.step()
                running_loss += float(loss.detach()) * targets.numel()
                seen += targets.numel()
                if step % 50 == 0 or step == len(train_loader):
                    log.write(
                        f"  epoch {epoch}/{config.epochs} step {step}/{len(train_loader)} "
                        f"loss={running_loss / max(seen, 1):.4f} "
                        f"lr={optimizer.param_groups[0]['lr']:.2e}"
                    )

            train_loss = running_loss / max(seen, 1)
            metrics = evaluate(model, val_loader, device)
            elapsed = time.perf_counter() - epoch_start
            val_macro_f1 = metrics["macro_f1"]
            history.append(
                {
                    "epoch": epoch,
                    "phase": config.training_mode,
                    "learning_rate": optimizer.param_groups[0]["lr"],
                    "train_loss": round(train_loss, 5),
                    "val_loss": round(metrics["loss"], 5),
                    "val_accuracy": round(metrics["accuracy"], 5),
                    "val_macro_f1": round(val_macro_f1, 5),
                    "val_per_class_f1": {
                        class_id: round(float(value), 4)
                        for class_id, value in zip(taxonomy.CLASS_IDS, metrics["per_class_f1"])
                    },
                    "seconds": round(elapsed, 1),
                }
            )
            scheduler.step()
            log.write(
                f"epoch {epoch}: train_loss={train_loss:.4f} val_loss={metrics['loss']:.4f} "
                f"val_acc={metrics['accuracy']:.4f} val_macro_f1={val_macro_f1:.4f} ({elapsed:.0f}s)"
            )

            improved = val_macro_f1 > best_f1 + 1e-4
            if improved:
                best_f1 = val_macro_f1
                best_epoch = epoch
                best_source = "warm_start" if init_state is not None else "scratch"
                epochs_without_improvement = 0
            else:
                epochs_without_improvement += 1

            payload = checkpoint_payload(epoch, val_macro_f1)
            torch.save(payload, output_dir / "last.pt")
            if improved:
                torch.save(payload, output_dir / "best.pt")
                log.write(f"  new best: epoch {epoch} val_macro_f1={val_macro_f1:.4f} -> best.pt")

            write_json(output_dir / "training_history.json", history)
            _write_history_csv(output_dir / "training_history.csv", history)

            if epochs_without_improvement >= config.patience:
                status = "early_stopped"
                log.write(f"Early stopping after {epoch} epochs (patience={config.patience}).")
                break
    except KeyboardInterrupt:
        status = "interrupted"
        error = "Interrupted by the user."
        log.write(
            "\nInterrupted. The last completed epoch is in last.pt / training_history.json.\n"
            "Continue it (warm start, new output directory) with:\n"
            f"  python scripts/train_rice_disease_scratch.py --init-from {output_dir / 'last.pt'} "
            "--epochs <more epochs> --workers 0"
        )
    except oom_error as exc:  # type: ignore[misc]
        status = "out_of_memory"
        error = str(exc)
        if device.type == "cuda":
            torch.cuda.empty_cache()
        log.write(f"\n{type(exc).__name__}: {exc}")
        log.write(OOM_GUIDANCE + "\n")

    total_seconds = time.perf_counter() - start
    write_json(
        output_dir / "training_config.json",
        {
            "created_at": datetime.now(timezone.utc).isoformat(),
            "model_version": config.model_version,
            "training_mode": config.training_mode,
            "pretrained": False,
            "pretrained_weights_requested": None,
            "exact_resume": False,
            "architecture": "mobilenet_v3_small",
            "num_classes": taxonomy.NUM_CLASSES,
            "class_order": list(taxonomy.CLASS_IDS),
            "seed": config.seed,
            "device": report,
            "smoke_test": config.smoke_test,
            "config": config.serialisable(),
            "final_status": status,
            "error": error,
            "best_epoch": best_epoch,
            "best_source": best_source,
            "best_val_macro_f1": best_f1 if best_epoch else None,
            "epochs_completed": len(history),
            "epochs_requested": config.epochs,
            "epoch_range": [epoch_numbers[0], epoch_numbers[-1]],
            "total_seconds": round(total_seconds, 1),
            "class_weights_used": config.class_weights,
            "train_images_used": len(train_rows),
            "validation_images_used": len(val_rows),
            "test_split_used": False,
            "history": history,
            "previous_run": (
                {
                    "source": str(init_state.path),
                    "source_sha256": init_state.sha256,
                    "source_epoch": init_state.epoch,
                    "source_val_macro_f1": init_state.val_macro_f1,
                    "source_training_mode": init_state.training_mode,
                    "source_model_version": init_state.model_version,
                    "source_smoke_test": init_state.smoke_test,
                    "source_config": init_state.source_config,
                    "epochs_preserved": len(previous_history),
                    "artifact": "previous_run.json",
                }
                if init_state is not None
                else None
            ),
        },
    )
    if init_state is not None:
        # The source run's history is kept verbatim, next to (not merged into)
        # this run's epoch list.
        write_json(
            output_dir / "previous_run.json",
            {
                "source": str(init_state.path),
                "source_sha256": init_state.sha256,
                "source_epoch": init_state.epoch,
                "source_val_macro_f1": init_state.val_macro_f1,
                "source_training_mode": init_state.training_mode,
                "source_model_version": init_state.model_version,
                "source_smoke_test": init_state.smoke_test,
                "source_config": init_state.source_config,
                "history": previous_history,
                "note": (
                    "Epochs above were trained by the earlier run and are preserved for reference only. "
                    "The epochs trained by this warm-start run are in training_history.json."
                ),
            },
        )
    write_json(
        output_dir / "class_mapping.json",
        {
            **taxonomy.mapping_payload(),
            "model_version": config.model_version,
            "generated_from": "app/rice_disease_15class/taxonomy.py",
            "note": "Output order is fixed; the same order must be used at inference.",
        },
    )
    log.write(
        f"Training {status}: epochs_completed={len(history)} best_epoch={best_epoch} "
        f"best_val_macro_f1={best_f1 if best_epoch else None} total={total_seconds / 60:.1f} min"
    )
    log.write(f"Artefacts -> {output_dir}")
    log.close()

    return ScratchResult(
        status=status,
        epochs_completed=len(history),
        best_epoch=best_epoch,
        best_val_macro_f1=best_f1 if best_epoch else None,
        checkpoint_path=(
            str(output_dir / "best.pt")
            if (output_dir / "best.pt").is_file()
            else (str(init_state.path) if init_state is not None else None)
        ),
        output_dir=str(output_dir),
        smoke_test=config.smoke_test,
        error=error,
        history=history,
        training_mode=config.training_mode,
        start_epoch=first_epoch,
        best_source=best_source,
    )


# --------------------------------------------------------------------------
# CLI
# --------------------------------------------------------------------------


def smoke_caps(
    max_train: int | None, max_val: int | None, smoke: bool
) -> tuple[int | None, int | None]:
    """Resolve per-class caps: ``--smoke`` defaults to 8 per class."""

    if not smoke:
        return max_train, max_val
    return max_train or 8, max_val or 8


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=(
            "Train the 15-class rice disease & pest model from scratch "
            "(random initialization, no ImageNet weights). Use --init-from PATH to warm-start "
            "from an existing from-scratch checkpoint instead."
        ),
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument("--train-manifest", type=Path, default=SPLIT_DIR / "train.csv")
    parser.add_argument("--val-manifest", type=Path, default=SPLIT_DIR / "validation.csv")
    parser.add_argument("--dataset", type=Path, default=DATASET_ROOT)
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=None,
        help=(
            "Where artefacts are written. Default: models/rice_disease_scratch_v1, or "
            "models/rice_disease_warmstart_v1 when --init-from is given. The directory of the "
            "source checkpoint is always refused."
        ),
    )
    parser.add_argument(
        "--epochs",
        type=int,
        default=40,
        help=(
            "Epochs to run. From scratch this is the total. With --init-from it is the number of "
            "NEW epochs after the checkpoint's last completed epoch (e.g. 10 continues 4..13)."
        ),
    )
    parser.add_argument("--batch-size", type=int, default=16, help="Lower this first on a CUDA out-of-memory error.")
    parser.add_argument(
        "--lr",
        type=float,
        default=None,
        help=f"Learning rate. Default: {SCRATCH_LR} from scratch, {WARMSTART_LR} with --init-from.",
    )
    parser.add_argument("--weight-decay", type=float, default=1e-4)
    parser.add_argument("--label-smoothing", type=float, default=0.05)
    parser.add_argument("--patience", type=int, default=8, help="Early-stopping patience on validation macro-F1.")
    parser.add_argument("--workers", type=int, default=2, help="DataLoader workers (0 = main process).")
    parser.add_argument("--image-size", type=int, default=IMAGE_SIZE)
    parser.add_argument("--seed", type=int, default=DEFAULT_SEED)
    parser.add_argument("--device", choices=("auto", "cuda", "cpu"), default="auto")
    parser.add_argument("--max-train-per-class", type=int, default=None)
    parser.add_argument("--max-val-per-class", type=int, default=None)
    parser.add_argument(
        "--smoke",
        action="store_true",
        help="Short plumbing check: cap train/val at 8 images per class unless explicit caps are given. "
        "Capped runs are labelled as smoke tests and are not model-quality results.",
    )
    parser.add_argument("--no-class-weights", action="store_true")
    parser.add_argument("--overwrite", action="store_true", help="Allow writing into a non-empty output directory.")
    parser.add_argument(
        "--model-version",
        default=None,
        help=f"Version stamped into artefacts. Default: {MODEL_VERSION} (scratch) or {WARMSTART_MODEL_VERSION}.",
    )
    parser.add_argument(
        "--init-from",
        type=Path,
        default=None,
        help=(
            "Warm start: load model weights from this checkpoint and continue at its next epoch. "
            "Optimizer and LR schedule are re-initialised (this is not an exact resume). "
            "Artifacts always go to a new output directory."
        ),
    )
    parser.add_argument(
        "--init-start-epoch",
        type=int,
        default=None,
        help="First epoch of a warm start. Default: the checkpoint's epoch + 1 (e.g. 4 after epoch 3).",
    )
    parser.add_argument("--json", action="store_true", help="Print the full epoch history as JSON.")
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    for manifest in (args.train_manifest, args.val_manifest):
        if not manifest.is_file():
            print(
                f"Missing split manifest: {manifest}\n"
                "Run: python scripts/audit_rice_disease_dataset.py && "
                "python scripts/split_rice_disease_dataset.py",
                file=sys.stderr,
            )
            return 2
    max_train, max_val = smoke_caps(args.max_train_per_class, args.max_val_per_class, args.smoke)
    warm_start = args.init_from is not None

    config = ScratchConfig(
        train_manifest=args.train_manifest,
        val_manifest=args.val_manifest,
        output_dir=args.output_dir,
        dataset_root=args.dataset,
        epochs=args.epochs,
        batch_size=args.batch_size,
        learning_rate=resolve_learning_rate(args.lr, warm_start),

        init_from=args.init_from,
        init_start_epoch=args.init_start_epoch,
        weight_decay=args.weight_decay,
        label_smoothing=args.label_smoothing,
        patience=args.patience,
        workers=args.workers,
        seed=args.seed,
        image_size=args.image_size,
        max_train_per_class=max_train,
        max_val_per_class=max_val,
        class_weights=not args.no_class_weights,
        device=args.device,
        overwrite=args.overwrite,
        model_version=resolve_model_version(args.model_version, warm_start),
    )

    try:
        result = train(config)
    except (FileExistsError, ValueError, RuntimeError, OSError) as exc:
        print(f"Training failed: {exc}", file=sys.stderr)
        return 1

    print(
        f"training_mode={result.training_mode} start_epoch={result.start_epoch} status={result.status} "
        f"smoke_test={result.smoke_test} new_epochs={result.epochs_completed} "
        f"best_epoch={result.best_epoch} best_source={result.best_source} "
        f"best_val_macro_f1={result.best_val_macro_f1} checkpoint={result.checkpoint_path}"
    )
    if result.smoke_test:
        print("SMOKE TEST: capped run. Not a quality result; do not compare these metrics with a full run.")
    if result.status != "completed" and result.status != "early_stopped":
        print(f"Run ended with status={result.status}: {result.error}", file=sys.stderr)
        return 130 if result.status == "interrupted" else 1
    if args.json:
        print(json.dumps(result.history, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
