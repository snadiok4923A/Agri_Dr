"""Reproducible, duplicate-aware train/validation/test splitting.

The dataset on disk is never copied or reorganised: the split is a set of
manifests containing relative paths. Images that are exact or perceptual
duplicates share a ``cluster_id`` from the audit and are therefore always
assigned to the same split, which prevents duplicate leakage.

Strategy
--------
1. Group each class's images by ``cluster_id`` (a cluster is one image plus
   its duplicates / near-duplicates).
2. Shuffle the clusters with a fixed seed.
3. Assign clusters greedily to the split furthest below its target share. A
   whole cluster always moves together, so ratios are approximate, not exact.
4. If a class has at least three clusters, make sure validation and test each
   receive one; a class with fewer than three clusters cannot be split
   honestly, so it stays in training and is reported as a limitation.
"""

from __future__ import annotations

import csv
import random
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable, Sequence

from . import taxonomy
from .config import DEFAULT_SEED, REPORTS_ROOT, SPLIT_DIR, write_json

SPLIT_NAMES: tuple[str, str, str] = ("train", "validation", "test")
DEFAULT_RATIOS: dict[str, float] = {"train": 0.70, "validation": 0.15, "test": 0.15}
MANIFEST_COLUMNS = ("relative_path", "class_id", "folder_label", "cluster_id", "split")


@dataclass(frozen=True)
class IndexRecord:
    relative_path: str
    class_id: str
    folder_label: str
    cluster_id: str


@dataclass(frozen=True)
class SplitResult:
    assignments: dict[str, str]
    summary: dict[str, Any]


def read_index(index_path: Path) -> list[IndexRecord]:
    """Read ``dataset_index.csv`` produced by the audit, keeping usable rows."""

    if not index_path.is_file():
        raise FileNotFoundError(
            f"Dataset index not found: {index_path}. Run scripts/audit_rice_disease_dataset.py first."
        )
    records: list[IndexRecord] = []
    with index_path.open("r", encoding="utf-8", newline="") as handle:
        for row in csv.DictReader(handle):
            if row.get("status") != "ok":
                continue
            class_id = (row.get("class_id") or "").strip()
            if class_id not in taxonomy.CLASS_IDS:
                continue
            relative_path = row["relative_path"]
            records.append(
                IndexRecord(
                    relative_path=relative_path,
                    class_id=class_id,
                    folder_label=row.get("folder_label", ""),
                    cluster_id=row.get("cluster_id") or f"solo:{relative_path}",
                )
            )
    if not records:
        raise ValueError(f"No usable image rows found in {index_path}.")
    return records


def _assign_class(
    clusters: list[list[IndexRecord]],
    rng: random.Random,
    ratios: dict[str, float],
) -> dict[str, str]:
    """Assign whole clusters of one class to splits."""

    total = sum(len(cluster) for cluster in clusters)
    targets = {name: ratios[name] * total for name in SPLIT_NAMES}
    assigned = {name: 0 for name in SPLIT_NAMES}
    assignment: dict[str, str] = {}

    ordered = sorted(clusters, key=lambda cluster: (-len(cluster), cluster[0].relative_path))
    rng.shuffle(ordered)

    for cluster in ordered:
        deficits = {
            name: (targets[name] - assigned[name]) / targets[name] if targets[name] else float("-inf")
            for name in SPLIT_NAMES
        }
        split = max(SPLIT_NAMES, key=lambda name: (deficits[name], -SPLIT_NAMES.index(name)))
        for record in cluster:
            assignment[record.relative_path] = split
        assigned[split] += len(cluster)

    # Guarantee validation/test coverage when the class supports it.
    if len(ordered) >= 3:
        for required in ("validation", "test"):
            if assigned[required] == 0:
                donor = max(SPLIT_NAMES, key=lambda name: assigned[name])
                movable = [
                    cluster
                    for cluster in ordered
                    if cluster
                    and assignment[cluster[0].relative_path] == donor
                    and all(assignment[record.relative_path] == donor for record in cluster)
                ]
                if movable:
                    cluster = min(movable, key=lambda item: (len(item), item[0].relative_path))
                    for record in cluster:
                        assignment[record.relative_path] = required
                    assigned[donor] -= len(cluster)
                    assigned[required] += len(cluster)
    return assignment


def build_split(
    records: Sequence[IndexRecord],
    seed: int = DEFAULT_SEED,
    ratios: dict[str, float] | None = None,
) -> SplitResult:
    """Split a dataset index deterministically."""

    active_ratios = dict(DEFAULT_RATIOS if ratios is None else ratios)
    if abs(sum(active_ratios.values()) - 1.0) > 1e-6:
        raise ValueError("Split ratios must sum to 1.0")
    if any(value <= 0 for value in active_ratios.values()):
        raise ValueError("Every split ratio must be positive")

    by_class: dict[str, list[IndexRecord]] = defaultdict(list)
    for record in records:
        by_class[record.class_id].append(record)

    rng = random.Random(seed)
    assignments: dict[str, str] = {}
    cluster_sizes: dict[str, int] = {}
    insufficient: list[str] = []

    for class_id in taxonomy.CLASS_IDS:
        class_records = sorted(by_class.get(class_id, []), key=lambda record: record.relative_path)
        if not class_records:
            continue

        groups: dict[str, list[IndexRecord]] = defaultdict(list)
        for record in class_records:
            groups[record.cluster_id].append(record)
        clusters = [sorted(members, key=lambda record: record.relative_path) for members in groups.values()]
        cluster_sizes[class_id] = len(clusters)

        if len(clusters) < 3:
            # Cannot produce an honest validation/test split: keep in train.
            for record in class_records:
                assignments[record.relative_path] = "train"
            insufficient.append(class_id)
        else:
            assignments.update(_assign_class(clusters, rng, active_ratios))

    # A cluster id can be shared by two classes (exact byte duplicates). Those
    # were assigned independently per class, so force the whole cluster into
    # one split now — leakage prevention outranks ratio precision.
    cluster_members: dict[str, list[str]] = defaultdict(list)
    for record in records:
        cluster_members[record.cluster_id].append(record.relative_path)
    resolved_cross_class: dict[str, list[str]] = {}
    for cluster_id, paths in cluster_members.items():
        splits = {assignments[path] for path in paths if path in assignments}
        if len(splits) <= 1:
            continue
        target = max(
            SPLIT_NAMES,
            key=lambda name: sum(1 for path in paths if assignments.get(path) == name),
        )
        for path in paths:
            if path in assignments:
                assignments[path] = target
        resolved_cross_class[cluster_id] = [*sorted(splits), f"->{target}"]

    class_rows: list[dict[str, Any]] = []
    for class_id in taxonomy.CLASS_IDS:
        class_records = by_class.get(class_id, [])
        counts = {
            name: sum(1 for record in class_records if assignments.get(record.relative_path) == name)
            for name in SPLIT_NAMES
        }
        class_rows.append(
            {
                "class_id": class_id,
                "train": counts["train"],
                "validation": counts["validation"],
                "test": counts["test"],
                "total": len(class_records),
                "clusters": cluster_sizes.get(class_id, 0),
                "insufficient_clusters": len(class_records) > 0 and cluster_sizes.get(class_id, 0) < 3,
            }
        )

    totals = {name: sum(row[name] for row in class_rows) for name in SPLIT_NAMES}
    grand_total = sum(totals.values())
    limitations = [
        "Splits are at image level; the dataset has no field/plant identifier, so images of the same plant that are not visually near-duplicates can still cross splits.",
        "Ratios are approximate because duplicate clusters are assigned whole.",
    ]
    if resolved_cross_class:
        limitations.append(
            f"{len(resolved_cross_class)} exact-duplicate cluster(s) spanned more than one class and were forced "
            "into a single split to prevent leakage; those images have conflicting folder labels."
        )
    if insufficient:
        limitations.append(
            "These classes have fewer than three duplicate clusters and were kept entirely in "
            f"training (no honest validation/test split possible): {insufficient}"
        )
    small_test_classes = [row["class_id"] for row in class_rows if 0 < row["test"] < 30]
    if small_test_classes:
        limitations.append(
            "Test split contains fewer than 30 images for: "
            f"{small_test_classes}; per-class metrics for these are high variance."
        )

    summary = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "seed": seed,
        "ratios_requested": active_ratios,
        "ratios_achieved": {
            name: round(totals[name] / grand_total, 4) if grand_total else 0.0 for name in SPLIT_NAMES
        },
        "totals": totals,
        "total_images": grand_total,
        "classes": class_rows,
        "insufficient_cluster_classes": sorted(set(insufficient)),
        "cross_class_clusters_forced": resolved_cross_class,
        "limitations": limitations,
        "split_is_manifest_only": True,
        "dataset_copied_or_moved": False,
    }
    return SplitResult(assignments=assignments, summary=summary)


def write_split_manifests(
    records: Sequence[IndexRecord],
    result: SplitResult,
    output_dir: Path = SPLIT_DIR,
) -> dict[str, Path]:
    """Write per-split manifests plus a combined manifest and summary JSON."""

    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    paths: dict[str, Path] = {}
    rows_by_split: dict[str, list[dict[str, str]]] = defaultdict(list)
    all_rows: list[dict[str, str]] = []

    for record in sorted(records, key=lambda item: item.relative_path):
        split = result.assignments.get(record.relative_path)
        if split is None:
            continue
        row = {
            "relative_path": record.relative_path,
            "class_id": record.class_id,
            "folder_label": record.folder_label,
            "cluster_id": record.cluster_id,
            "split": split,
        }
        rows_by_split[split].append(row)
        all_rows.append(row)

    for split in SPLIT_NAMES:
        path = output_dir / f"{split}.csv"
        _write_manifest(path, rows_by_split.get(split, []))
        paths[split] = path

    paths["all"] = output_dir / "split_manifest.csv"
    _write_manifest(paths["all"], all_rows)
    paths["summary"] = write_json(output_dir / "split_summary.json", result.summary)
    return paths


def _write_manifest(path: Path, rows: Iterable[dict[str, str]]) -> None:
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=MANIFEST_COLUMNS)
        writer.writeheader()
        for row in rows:
            writer.writerow(row)


def read_manifest(path: Path) -> list[dict[str, str]]:
    with Path(path).open("r", encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle))


def verify_splits(output_dir: Path = SPLIT_DIR) -> dict[str, Any]:
    """Check written manifests for duplicate leakage and class coverage."""

    output_dir = Path(output_dir)
    split_rows = {name: read_manifest(output_dir / f"{name}.csv") for name in SPLIT_NAMES}

    errors: list[str] = []
    cluster_splits: dict[str, set[str]] = defaultdict(set)
    seen_paths: dict[str, str] = {}
    class_presence: dict[str, set[str]] = defaultdict(set)

    for split, rows in split_rows.items():
        for row in rows:
            path = row["relative_path"]
            if path in seen_paths:
                errors.append(f"{path} appears in both {seen_paths[path]} and {split}")
            seen_paths[path] = split
            cluster = row["cluster_id"] or f"solo:{path}"
            cluster_splits[cluster].add(split)
            class_presence[row["class_id"]].add(split)

    leaked = {cluster: sorted(splits) for cluster, splits in cluster_splits.items() if len(splits) > 1}
    if leaked:
        errors.append(
            f"{len(leaked)} duplicate cluster(s) cross splits, e.g. "
            + ", ".join(f"{cluster}->{splits}" for cluster, splits in list(leaked.items())[:5])
        )

    present_classes = sorted(class_presence)
    missing_train = [class_id for class_id in present_classes if "train" not in class_presence[class_id]]
    if missing_train:
        errors.append(f"Classes absent from training: {missing_train}")

    return {
        "valid": not errors,
        "errors": errors,
        "counts": {split: len(rows) for split, rows in split_rows.items()},
        "classes_without_train": missing_train,
        "classes_covered": present_classes,
        "classes_missing_from_dataset": [
            class_id for class_id in taxonomy.CLASS_IDS if class_id not in class_presence
        ],
        "clusters_crossing_splits": len(leaked),
    }
