"""Manifest-backed ``torch`` datasets and transforms for the 15-class model.

Images are read lazily from disk on every access; nothing loads the whole
dataset into RAM. Validation/test transforms match the documented inference
preprocessing (short edge 256 -> center crop 224 -> ImageNet normalization).
"""

from __future__ import annotations

import csv
import random
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable, Sequence

from PIL import Image

from . import taxonomy
from .config import (
    DATASET_ROOT,
    IMAGE_SIZE,
    IMAGENET_MEAN,
    IMAGENET_STD,
    RESIZE_SIZE,
)
from .preprocess import load_rgb, to_model_tensor


@dataclass(frozen=True)
class ManifestRow:
    relative_path: str
    class_id: str
    folder_label: str
    cluster_id: str


def read_manifest(path: Path) -> list[ManifestRow]:
    rows: list[ManifestRow] = []
    with Path(path).open("r", encoding="utf-8", newline="") as handle:
        for row in csv.DictReader(handle):
            class_id = (row.get("class_id") or "").strip()
            if class_id not in taxonomy.CLASS_IDS:
                continue
            rows.append(
                ManifestRow(
                    relative_path=row["relative_path"],
                    class_id=class_id,
                    folder_label=row.get("folder_label", ""),
                    cluster_id=row.get("cluster_id", ""),
                )
            )
    return rows


def subsample_manifest(
    rows: Sequence[ManifestRow],
    max_per_class: int | None,
    seed: int,
) -> list[ManifestRow]:
    """Deterministically cap images per class (CPU budget control).

    Selection shuffles whole duplicate clusters first so a cap does not
    silently drop every copy of a near-duplicate group.
    """

    if not max_per_class or max_per_class <= 0:
        return list(rows)

    by_class: dict[str, list[ManifestRow]] = {}
    for row in rows:
        by_class.setdefault(row.class_id, []).append(row)

    rng = random.Random(seed)
    selected: list[ManifestRow] = []
    for class_id in taxonomy.CLASS_IDS:
        class_rows = sorted(by_class.get(class_id, []), key=lambda row: row.relative_path)
        if len(class_rows) <= max_per_class:
            selected.extend(class_rows)
            continue
        clusters: dict[str, list[ManifestRow]] = {}
        for row in class_rows:
            clusters.setdefault(row.cluster_id or row.relative_path, []).append(row)
        cluster_keys = sorted(clusters)
        rng.shuffle(cluster_keys)
        chosen: list[ManifestRow] = []
        for key in cluster_keys:
            chosen.extend(clusters[key])
            if len(chosen) >= max_per_class:
                break
        selected.extend(chosen[:max_per_class])
    return sorted(selected, key=lambda row: row.relative_path)


class DeterministicTransform:
    """Picklable (Windows DataLoader workers) eval/inference transform."""

    def __init__(self, image_size: int = IMAGE_SIZE) -> None:
        self.image_size = image_size

    def __call__(self, image: Image.Image) -> Any:
        import torch

        return torch.from_numpy(to_model_tensor(image))


def build_transforms(train: bool, image_size: int = IMAGE_SIZE) -> Callable[[Image.Image], Any]:
    """Return the transform pipeline for training or deterministic evaluation.

    Training augmentation is intentionally mild: geometry that preserves
    lesion appearance (small rotation, modest scale crop, horizontal flip) and
    brightness/contrast jitter. No vertical flip, no heavy colour shifting and
    no cropping that could remove the lesion.

    Evaluation reuses :func:`app.rice_disease_15class.preprocess.to_model_tensor`
    so validation, test and ONNX inference share one implementation.
    """

    from torchvision import transforms

    if train:
        return transforms.Compose(
            [
                transforms.RandomResizedCrop(image_size, scale=(0.65, 1.0), ratio=(0.85, 1.18)),
                transforms.RandomRotation(degrees=12),
                transforms.RandomHorizontalFlip(p=0.5),
                transforms.ColorJitter(brightness=0.2, contrast=0.2, saturation=0.1),
                transforms.ToTensor(),
                transforms.Normalize(IMAGENET_MEAN, IMAGENET_STD),
            ]
        )

    if image_size != IMAGE_SIZE:  # pragma: no cover - non-default resolution
        return transforms.Compose(
            [
                transforms.Resize(RESIZE_SIZE),
                transforms.CenterCrop(image_size),
                transforms.ToTensor(),
                transforms.Normalize(IMAGENET_MEAN, IMAGENET_STD),
            ]
        )
    return DeterministicTransform(image_size)


class ManifestDataset:
    """``torch.utils.data.Dataset`` over a split manifest (lazy disk reads)."""

    def __init__(
        self,
        rows: Sequence[ManifestRow],
        root: Path = DATASET_ROOT,
        train: bool = False,
        image_size: int = IMAGE_SIZE,
    ) -> None:
        self.rows = list(rows)
        self.root = Path(root)
        self.train = train
        self.transform = build_transforms(train, image_size=image_size)
        self.class_ids = taxonomy.CLASS_IDS
        self.class_to_index = {class_id: index for index, class_id in enumerate(self.class_ids)}

    def __len__(self) -> int:
        return len(self.rows)

    def __getitem__(self, index: int):
        row = self.rows[index]
        path = self.root / row.relative_path
        try:
            image = load_rgb(path)
            tensor = self.transform(image)
            image.close()
        except (OSError, ValueError) as exc:  # pragma: no cover - defensive
            raise RuntimeError(f"Unable to read dataset image: {path} ({exc})") from exc
        return tensor, self.class_to_index[row.class_id], index

    def labels(self) -> list[str]:
        return [row.class_id for row in self.rows]

    def paths(self) -> list[str]:
        return [row.relative_path for row in self.rows]


def class_counts(rows: Sequence[ManifestRow]) -> dict[str, int]:
    counts = {class_id: 0 for class_id in taxonomy.CLASS_IDS}
    for row in rows:
        counts[row.class_id] = counts.get(row.class_id, 0) + 1
    return counts
