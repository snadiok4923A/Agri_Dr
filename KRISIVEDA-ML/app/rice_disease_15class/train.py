"""CPU-compatible training loop for the 15-class rice disease & pest model.

Transfer learning from ImageNet MobileNetV3-Small:

* epoch 1..``freeze_epochs`` — backbone frozen, only the new head trains
  (fast on CPU, lets the head settle before touching pretrained features);
* afterwards the final inverted-residual block and the classifier are
  unfrozen and fine-tuned end to end.

Model selection uses validation macro-F1 (not accuracy), which is the honest
metric under class imbalance. The test split is never touched here.

Artefacts written to ``models/rice_disease_15class/rice-disease-15class-v2/``:
``best.pt``, ``last.pt``, ``training_history.json``, ``training_history.csv``,
``training_config.json``, ``class_mapping.json``, ``training.log``.
"""

from __future__ import annotations

import csv
import json
import random
import time
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Sequence

from . import taxonomy
from .config import (
    DATASET_ROOT,
    DEFAULT_SEED,
    IMAGE_SIZE,
    MODEL_ROOT,
    MODEL_VERSION,
    write_json,
)
from .data import ManifestDataset, ManifestRow, class_counts, read_manifest, subsample_manifest

MIN_IMAGES_PER_CLASS_FOR_WEIGHTS = 1


@dataclass
class TrainConfig:
    train_manifest: Path
    val_manifest: Path
    output_dir: Path = MODEL_ROOT
    dataset_root: Path = DATASET_ROOT
    epochs: int = 6
    batch_size: int = 64
    learning_rate: float = 1e-3
    weight_decay: float = 1e-4
    freeze_epochs: int = 1
    label_smoothing: float = 0.05
    patience: int = 3
    workers: int = 2
    seed: int = DEFAULT_SEED
    threads: int = 0
    max_train_per_class: int | None = None
    max_val_per_class: int | None = None
    class_weights: bool = True
    image_size: int = IMAGE_SIZE
    #: Identifier written into checkpoints and config files. Defaults to the
    #: released version so existing runs are unchanged; experiments pass their
    #: own name instead of mislabelling a new folder as v2.
    model_version: str = MODEL_VERSION

    def serialisable(self) -> dict[str, Any]:
        payload = asdict(self)
        for key, value in payload.items():
            if isinstance(value, Path):
                payload[key] = str(value)
        return payload


@dataclass
class TrainResult:
    status: str
    best_epoch: int | None
    best_val_macro_f1: float | None
    epochs_completed: int
    history: list[dict[str, Any]] = field(default_factory=list)
    checkpoint_path: str | None = None
    stopped_early: bool = False


class _Tee:
    """Write the same line to stdout and to a log file."""

    def __init__(self, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        self._handle = path.open("a", encoding="utf-8")

    def write(self, message: str) -> None:
        print(message, flush=True)
        self._handle.write(message + "\n")
        self._handle.flush()

    def close(self) -> None:
        self._handle.close()


def _set_seed(seed: int) -> None:
    import numpy as np
    import torch

    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    torch.cuda.manual_seed_all(seed)


def _class_weights(rows: Sequence[ManifestRow], num_classes: int):
    """Inverse-frequency weights, normalised to mean 1.0."""

    import torch

    counts = class_counts(rows)
    total = sum(counts.values())
    weights = []
    for class_id in taxonomy.CLASS_IDS:
        count = counts.get(class_id, 0)
        weights.append(0.0 if count == 0 else total / (num_classes * count))
    present = [value for value in weights if value > 0]
    mean = sum(present) / len(present) if present else 1.0
    weights = [value / mean for value in weights]
    # Classes absent from training must not contribute a loss term.
    weights = [0.0 if counts.get(class_id, 0) < MIN_IMAGES_PER_CLASS_FOR_WEIGHTS else weight
               for class_id, weight in zip(taxonomy.CLASS_IDS, weights)]
    return torch.tensor(weights, dtype=torch.float32), counts


def _evaluate(model, loader) -> tuple[float, float, float, list[float], list[int], list[int]]:
    """Return (loss, accuracy, macro_f1, per_class_f1, y_true, y_pred)."""

    import numpy as np
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
            logits = model(inputs)
            total_loss += float(criterion(logits, targets))
            predictions = logits.argmax(dim=1)
            y_true.extend(targets.tolist())
            y_pred.extend(predictions.tolist())
            total += targets.numel()

    accuracy = float(accuracy_score(y_true, y_pred)) if y_true else 0.0
    macro_f1 = float(f1_score(y_true, y_pred, average="macro", zero_division=0)) if y_true else 0.0
    per_class = (
        f1_score(y_true, y_pred, average=None, labels=list(range(len(taxonomy.CLASS_IDS))), zero_division=0).tolist()
        if y_true
        else []
    )
    loss = total_loss / total if total else float("nan")
    return loss, accuracy, macro_f1, per_class, y_true, y_pred


def train_model(config: TrainConfig, log: _Tee | None = None) -> TrainResult:
    import torch
    from torch.utils.data import DataLoader

    from .model import (
        build_model,
        set_backbone_trainable,
        total_parameter_count,
        trainable_parameter_count,
        unfreeze_last_block,
    )

    output_dir = Path(config.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    log = log or _Tee(output_dir / "training.log")

    if config.threads > 0:
        torch.set_num_threads(config.threads)

    _set_seed(config.seed)
    train_rows = subsample_manifest(read_manifest(config.train_manifest), config.max_train_per_class, config.seed)
    val_rows = subsample_manifest(read_manifest(config.val_manifest), config.max_val_per_class, config.seed + 1)
    if not train_rows:
        raise ValueError("Training manifest is empty.")
    if not val_rows:
        raise ValueError("Validation manifest is empty; cannot select a model.")

    train_dataset = ManifestDataset(train_rows, root=config.dataset_root, train=True, image_size=config.image_size)
    val_dataset = ManifestDataset(val_rows, root=config.dataset_root, train=False, image_size=config.image_size)

    train_loader = DataLoader(
        train_dataset,
        batch_size=config.batch_size,
        shuffle=True,
        num_workers=config.workers,
        persistent_workers=config.workers > 0,
        drop_last=False,
    )
    val_loader = DataLoader(
        val_dataset,
        batch_size=config.batch_size,
        shuffle=False,
        num_workers=config.workers,
        persistent_workers=config.workers > 0,
    )

    model = build_model(taxonomy.NUM_CLASSES, pretrained=True)
    weights, counts = _class_weights(train_rows, taxonomy.NUM_CLASSES)
    criterion = torch.nn.CrossEntropyLoss(weight=weights if config.class_weights else None,
                                          label_smoothing=config.label_smoothing)
    optimizer = torch.optim.AdamW(
        [parameter for parameter in model.parameters() if parameter.requires_grad],
        lr=config.learning_rate,
        weight_decay=config.weight_decay,
    )
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=max(1, config.epochs))

    log.write("=" * 78)
    log.write(f"KRISIVEDA 15-class training — {datetime.now(timezone.utc).isoformat()}")
    log.write(f"model_version={config.model_version} architecture=mobilenet_v3_small image_size={config.image_size}")
    log.write(f"train images={len(train_rows)} validation images={len(val_rows)} epochs={config.epochs} "
              f"batch={config.batch_size} lr={config.learning_rate}")
    log.write(f"class counts (train): {json.dumps(counts, sort_keys=True)}")
    log.write(f"parameters: total={total_parameter_count(model):,} trainable={trainable_parameter_count(model):,}")
    log.write("=" * 78)

    history: list[dict[str, Any]] = []
    best_f1 = -1.0
    best_epoch: int | None = None
    epochs_without_improvement = 0
    status = "completed"
    stopped_early = False
    start = time.perf_counter()

    for epoch in range(1, config.epochs + 1):
        if epoch <= config.freeze_epochs:
            set_backbone_trainable(model, False)
            stage = "frozen-backbone"
        elif epoch == config.freeze_epochs + 1:
            unfreeze_last_block(model)
            stage = "fine-tune-last-block"
        else:
            stage = "fine-tune-last-block"

        epoch_start = time.perf_counter()
        model.train()
        running_loss = 0.0
        seen = 0
        for step, (inputs, targets, _indices) in enumerate(train_loader, start=1):
            optimizer.zero_grad(set_to_none=True)
            logits = model(inputs)
            loss = criterion(logits, targets)
            loss.backward()
            optimizer.step()
            running_loss += float(loss.detach()) * targets.numel()
            seen += targets.numel()
            if step % 25 == 0 or step == len(train_loader):
                log.write(
                    f"  epoch {epoch}/{config.epochs} [{stage}] step {step}/{len(train_loader)} "
                    f"loss={running_loss / max(seen, 1):.4f}"
                )

        train_loss = running_loss / max(seen, 1)
        val_loss, val_accuracy, val_macro_f1, per_class_f1, _y_true, _y_pred = _evaluate(model, val_loader)
        elapsed = time.perf_counter() - epoch_start
        entry = {
            "epoch": epoch,
            "stage": stage,
            "learning_rate": optimizer.param_groups[0]["lr"],
            "train_loss": round(train_loss, 5),
            "val_loss": round(val_loss, 5),
            "val_accuracy": round(val_accuracy, 5),
            "val_macro_f1": round(val_macro_f1, 5),
            "val_per_class_f1": {
                class_id: round(float(value), 4) for class_id, value in zip(taxonomy.CLASS_IDS, per_class_f1)
            },
            "trainable_parameters": trainable_parameter_count(model),
            "seconds": round(elapsed, 1),
        }
        history.append(entry)
        scheduler.step()
        log.write(
            f"epoch {epoch}: train_loss={train_loss:.4f} val_loss={val_loss:.4f} "
            f"val_acc={val_accuracy:.4f} val_macro_f1={val_macro_f1:.4f} ({elapsed:.0f}s)"
        )

        checkpoint = {
            "model_state": model.state_dict(),
            "class_ids": list(taxonomy.CLASS_IDS),
            "architecture": "mobilenet_v3_small",
            "model_version": config.model_version,
            "image_size": config.image_size,
            "epoch": epoch,
            "val_macro_f1": val_macro_f1,
            "config": config.serialisable(),
            "history": history,
        }
        torch.save(checkpoint, output_dir / "last.pt")
        if val_macro_f1 > best_f1 + 1e-4:
            best_f1 = val_macro_f1
            best_epoch = epoch
            epochs_without_improvement = 0
            torch.save(checkpoint, output_dir / "best.pt")
        else:
            epochs_without_improvement += 1

        write_json(output_dir / "training_history.json", history)
        _write_history_csv(output_dir / "training_history.csv", history)

        if epochs_without_improvement >= config.patience:
            status = "early_stopped"
            stopped_early = True
            log.write(f"Early stopping after {epoch} epochs (patience={config.patience}).")
            break

    total_seconds = time.perf_counter() - start
    write_json(
        output_dir / "training_config.json",
        {
            "created_at": datetime.now(timezone.utc).isoformat(),
            "model_version": config.model_version,
            "architecture": "mobilenet_v3_small",
            "pretrained": "torchvision MobileNet_V3_Small_Weights.IMAGENET1K_V1",
            "config": config.serialisable(),
            "final_status": status,
            "best_epoch": best_epoch,
            "best_val_macro_f1": best_f1 if best_epoch else None,
            "epochs_completed": len(history),
            "total_seconds": round(total_seconds, 1),
            "class_order": list(taxonomy.CLASS_IDS),
            "class_weights_used": config.class_weights,
            "train_images_used": len(train_rows),
            "validation_images_used": len(val_rows),
        },
    )
    write_json(
        output_dir / "class_mapping.json",
        {
            **taxonomy.mapping_payload(),
            "model_version": config.model_version,
            "generated_from": "app/rice_disease_15class/taxonomy.py",
        },
    )
    log.write(
        f"Training {status}: best_epoch={best_epoch} best_val_macro_f1={best_f1:.4f} "
        f"total={total_seconds / 60:.1f} min -> {output_dir}"
    )

    return TrainResult(
        status=status,
        best_epoch=best_epoch,
        best_val_macro_f1=best_f1 if best_epoch else None,
        epochs_completed=len(history),
        history=history,
        checkpoint_path=str(output_dir / "best.pt") if best_epoch else None,
        stopped_early=stopped_early,
    )


def _write_history_csv(path: Path, history: Sequence[dict[str, Any]]) -> None:
    if not history:
        return
    fieldnames = [key for key in history[0].keys() if key != "val_per_class_f1"]
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for entry in history:
            writer.writerow({key: entry[key] for key in fieldnames})
