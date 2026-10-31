"""Read-only audit of the 15-class rice disease & pest image dataset.

The audit never mutates the source dataset. It only reads images and writes
reports into ``reports/rice_disease_15class/``.

What it reports
---------------
* image counts per class folder (recursive), by format
* unreadable / truncated / non-image files (originals are left untouched)
* unsupported extensions and empty class folders
* exact duplicates (SHA-256 of file bytes)
* perceptually near-duplicate images (64-bit difference hash, Hamming <= N)
* class imbalance and the smallest classes
* a per-image review list for suspicious duplicates and cross-class
  look-alikes that may indicate mislabelled folders

Class identifiers are normalized through :mod:`app.rice_disease_15class.taxonomy`;
the original folder name is preserved in every row.
"""

from __future__ import annotations

import csv
import hashlib
import json
import os
import sys
from collections import defaultdict
from concurrent.futures import ProcessPoolExecutor
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable, Sequence

import numpy as np
from PIL import Image, ImageOps, UnidentifiedImageError

from . import taxonomy
from .config import (
    DATASET_ROOT,
    REPORTS_ROOT,
    SUPPORTED_EXTENSIONS,
    write_json,
)

#: A perceptual hash distance at or below this value is treated as a
#: near-duplicate (recompression, resize, slight crop).
DEFAULT_NEAR_DUPLICATE_DISTANCE = 6

#: A hash match must also agree pixel-wise on a 16x16 thumbnail. Without this,
#: flat/low-detail photos (blank backgrounds, over-exposed crops) collide and
#: chain unrelated classes into one enormous "duplicate" cluster.
DEFAULT_THUMBNAIL_MAX_MAE = 12.0

#: Images with a thumbnail grey-level standard deviation below this carry too
#: little structure for perceptual matching; they are reported, not matched.
MIN_DETAIL_STD = 8.0

#: Safety valve: a near-duplicate chain may never exceed this many images.
MAX_CLUSTER_SIZE = 400


# ---------------------------------------------------------------------------
# Records
# ---------------------------------------------------------------------------


@dataclass
class ImageRecord:
    relative_path: str
    absolute_path: str
    class_id: str | None
    folder_label: str
    extension: str
    size_bytes: int
    sha256: str | None = None
    dhash: int | None = None
    width: int | None = None
    height: int | None = None
    image_format: str | None = None
    status: str = "ok"  # ok | unreadable | unsupported
    error: str | None = None
    cluster_id: str | None = None
    detail_std: float | None = None
    thumbnail: bytes | None = field(default=None, repr=False)

    def as_dict(self) -> dict[str, Any]:
        payload = asdict(self)
        payload.pop("thumbnail", None)
        if payload["dhash"] is not None:
            payload["dhash"] = f"{payload['dhash']:016x}"
        return payload


@dataclass
class DatasetScan:
    root: Path
    records: list[ImageRecord] = field(default_factory=list)
    folders: list[str] = field(default_factory=list)
    empty_folders: list[str] = field(default_factory=list)
    unmapped_folders: list[str] = field(default_factory=list)
    root_level_files: list[str] = field(default_factory=list)
    mapping: list[taxonomy.FolderMapping] = field(default_factory=list)
    near_pairs: list[tuple[int, int, int]] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Discovery
# ---------------------------------------------------------------------------


def _iter_class_files(folder: Path) -> Iterable[Path]:
    for path in sorted(folder.rglob("*")):
        if path.is_file():
            yield path


def discover(root: Path) -> tuple[list[str], dict[str, list[Path]], list[str], list[str]]:
    """Return (class folders, folder -> files, empty folders, root-level files)."""

    if not root.is_dir():
        raise FileNotFoundError(f"Dataset directory does not exist: {root}")

    folders: list[str] = []
    files_by_folder: dict[str, list[Path]] = {}
    empty: list[str] = []
    root_files: list[str] = []

    for entry in sorted(root.iterdir()):
        if entry.is_dir():
            folders.append(entry.name)
            files = list(_iter_class_files(entry))
            files_by_folder[entry.name] = files
            if not files:
                empty.append(entry.name)
        elif entry.is_file():
            root_files.append(entry.name)

    return folders, files_by_folder, empty, root_files


# ---------------------------------------------------------------------------
# Image probing (safe: opens read-only, never writes back)
# ---------------------------------------------------------------------------


def _sha256(path: Path, chunk_size: int = 1 << 20) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(chunk_size), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _difference_hash(image: Image.Image) -> int:
    """64-bit dHash: 9x8 greyscale, compare horizontally adjacent pixels."""

    small = image.convert("L").resize((9, 8), Image.Resampling.LANCZOS)
    pixels = np.asarray(small, dtype=np.int16)
    brighter_left = (pixels[:, :-1] > pixels[:, 1:]).reshape(-1)
    value = 0
    for bit, flag in enumerate(brighter_left.tolist()):
        if flag:
            value |= 1 << bit
    return value


def _thumbnail(image: Image.Image) -> tuple[bytes, float]:
    """16x16 grayscale thumbnail plus its contrast, used to verify hash matches."""

    small = image.convert("L").resize((16, 16), Image.Resampling.LANCZOS)
    values = np.asarray(small, dtype=np.uint8)
    return values.tobytes(), float(values.astype(np.float32).std())


def probe(task: tuple[str, str, str | None, str, str]) -> dict[str, Any]:
    """Probe one file. Runs in worker processes, so it takes plain values."""

    relative_path, absolute_path, class_id, folder_label, extension = task
    path = Path(absolute_path)
    result: dict[str, Any] = {
        "relative_path": relative_path,
        "absolute_path": absolute_path,
        "class_id": class_id,
        "folder_label": folder_label,
        "extension": extension,
        "size_bytes": 0,
        "sha256": None,
        "dhash": None,
        "width": None,
        "height": None,
        "image_format": None,
        "status": "ok",
        "error": None,
        "detail_std": None,
        "thumbnail": None,
    }

    try:
        result["size_bytes"] = os.stat(path).st_size
    except OSError as exc:
        result["status"] = "unreadable"
        result["error"] = f"stat failed: {exc}"
        return result

    if extension not in SUPPORTED_EXTENSIONS:
        result["status"] = "unsupported"
        result["error"] = f"unsupported extension {extension or '<none>'}"
        return result

    try:
        result["sha256"] = _sha256(path)
    except OSError as exc:
        result["status"] = "unreadable"
        result["error"] = f"read failed: {exc}"
        return result

    try:
        with Image.open(path) as image:
            image_format = image.format
            width, height = image.size
            # Draft decoding keeps large JPEGs cheap while still surfacing
            # truncated / corrupt data on load().
            image.draft("RGB", (64, 64))
            image.load()
            transposed = ImageOps.exif_transpose(image)
            dhash = _difference_hash(transposed)
            thumbnail, detail_std = _thumbnail(transposed)
            transposed.close()
        result["image_format"] = image_format
        result["width"] = int(width)
        result["height"] = int(height)
        result["dhash"] = dhash
        result["detail_std"] = round(detail_std, 3)
        result["thumbnail"] = thumbnail
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError, SyntaxError) as exc:
        result["status"] = "unreadable"
        result["error"] = f"{type(exc).__name__}: {exc}"
    return result


def scan_dataset(
    root: Path = DATASET_ROOT,
    workers: int = 1,
    near_duplicate_distance: int = DEFAULT_NEAR_DUPLICATE_DISTANCE,
) -> DatasetScan:
    """Walk the dataset read-only and probe every file."""

    folders, files_by_folder, empty, root_files = discover(root)
    mapping = taxonomy.build_folder_mapping(folders)
    mapping_by_folder = {item.folder_name: item for item in mapping}

    tasks: list[tuple[str, str, str | None, str, str]] = []
    for folder in folders:
        class_id = mapping_by_folder[folder].class_id
        for path in files_by_folder[folder]:
            tasks.append(
                (
                    path.relative_to(root).as_posix(),
                    str(path),
                    class_id,
                    folder,
                    path.suffix.lower(),
                )
            )

    results: list[dict[str, Any]] = []
    if workers and workers > 1 and len(tasks) > 1:
        # ``max_tasks_per_child`` recycles workers so a long run cannot grow
        # without bound; the parent only keeps compact summaries.
        with ProcessPoolExecutor(max_workers=workers, max_tasks_per_child=1500) as pool:
            for item in pool.map(probe, tasks, chunksize=128):
                results.append(item)
    else:
        for task in tasks:
            results.append(probe(task))

    records = [ImageRecord(**item) for item in results]
    scan = DatasetScan(
        root=root,
        records=records,
        folders=folders,
        empty_folders=empty,
        unmapped_folders=[item.folder_name for item in mapping if item.class_id is None],
        root_level_files=root_files,
        mapping=mapping,
    )
    scan.near_pairs = _assign_clusters(scan.records, near_duplicate_distance)
    return scan


# ---------------------------------------------------------------------------
# Duplicate detection
# ---------------------------------------------------------------------------


def find_exact_duplicates(records: Sequence[ImageRecord]) -> dict[str, list[int]]:
    """Group record indices by identical file bytes."""

    by_hash: dict[str, list[int]] = defaultdict(list)
    for index, record in enumerate(records):
        if record.sha256 and record.status == "ok":
            by_hash[record.sha256].append(index)
    return {digest: indices for digest, indices in by_hash.items() if len(indices) > 1}


def _popcount(value: int) -> int:
    return value.bit_count()


def _thumbnail_correlation(left: bytes | None, right: bytes | None) -> float:
    """Pearson correlation of two 16x16 thumbnails (0 when undefined)."""

    if not left or not right or len(left) != len(right):
        return 0.0
    left_array = np.frombuffer(left, dtype=np.uint8).astype(np.float32)
    right_array = np.frombuffer(right, dtype=np.uint8).astype(np.float32)
    if left_array.std() == 0 or right_array.std() == 0:
        return 0.0
    return float(np.corrcoef(left_array, right_array)[0, 1])


def _thumbnail_mae(left: bytes | None, right: bytes | None) -> float:
    """Mean absolute difference between two 16x16 grayscale thumbnails (0-255)."""

    if not left or not right or len(left) != len(right):
        return 255.0
    left_array = np.frombuffer(left, dtype=np.uint8).astype(np.int16)
    right_array = np.frombuffer(right, dtype=np.uint8).astype(np.int16)
    return float(np.abs(left_array - right_array).mean())


def find_near_duplicate_pairs(
    records: Sequence[ImageRecord],
    max_distance: int = DEFAULT_NEAR_DUPLICATE_DISTANCE,
    max_thumbnail_mae: float = DEFAULT_THUMBNAIL_MAX_MAE,
    min_detail_std: float = MIN_DETAIL_STD,
) -> list[tuple[int, int, int]]:
    """Return ``(i, j, distance)`` pairs that are genuinely near-identical.

    Uses multi-index hashing: a 64-bit hash is split into four 16-bit bands.
    Two hashes within distance ``k`` must share at least one band when
    ``k < bands``, so only same-band candidates are compared pairwise.

    A hash match alone is not enough. Flat images (blank background, blown
    highlights) produce identical hashes across classes, so every candidate
    must also agree pixel-wise on a 16x16 thumbnail, and images below a
    minimum contrast are excluded from perceptual matching entirely.
    """

    if max_distance <= 0:
        return []

    bands = 4
    band_bits = 64 // bands
    mask = (1 << band_bits) - 1
    entries = [
        (index, record.dhash)
        for index, record in enumerate(records)
        if record.dhash is not None
        and record.status == "ok"
        and (record.detail_std or 0.0) >= min_detail_std
    ]

    seen: set[tuple[int, int]] = set()
    pairs: list[tuple[int, int, int]] = []
    for band in range(bands):
        shift = band * band_bits
        buckets: dict[int, list[tuple[int, int]]] = defaultdict(list)
        for index, value in entries:
            buckets[(value >> shift) & mask].append((index, value))
        for bucket in buckets.values():
            if len(bucket) < 2:
                continue
            for position in range(len(bucket)):
                left_index, left_value = bucket[position]
                for other in range(position + 1, len(bucket)):
                    right_index, right_value = bucket[other]
                    key = (left_index, right_index) if left_index < right_index else (right_index, left_index)
                    if key in seen:
                        continue
                    seen.add(key)
                    distance = _popcount(left_value ^ right_value)
                    if distance > max_distance:
                        continue
                    if _thumbnail_mae(records[key[0]].thumbnail, records[key[1]].thumbnail) > max_thumbnail_mae:
                        continue
                    pairs.append((key[0], key[1], distance))
    pairs.sort(key=lambda item: (item[0], item[1]))
    return pairs


class _UnionFind:
    def __init__(self, size: int) -> None:
        self._parent = list(range(size))
        self._rank = [0] * size
        self._size = [1] * size

    def find(self, item: int) -> int:
        parent = self._parent
        while parent[item] != item:
            parent[item] = parent[parent[item]]
            item = parent[item]
        return item

    def cluster_size(self, item: int) -> int:
        return self._size[self.find(item)]

    def union(self, left: int, right: int, max_size: int | None = None) -> bool:
        left_root, right_root = self.find(left), self.find(right)
        if left_root == right_root:
            return False
        if max_size is not None and self._size[left_root] + self._size[right_root] > max_size:
            return False
        if self._rank[left_root] < self._rank[right_root]:
            left_root, right_root = right_root, left_root
        self._parent[right_root] = left_root
        self._size[left_root] += self._size[right_root]
        if self._rank[left_root] == self._rank[right_root]:
            self._rank[left_root] += 1
        return True


def _assign_clusters(
    records: Sequence[ImageRecord],
    max_distance: int = DEFAULT_NEAR_DUPLICATE_DISTANCE,
) -> list[tuple[int, int, int]]:
    """Union duplicates into clusters, then label every record.

    Exact duplicates are merged even across classes: identical bytes in two
    folders is a genuine label conflict that must not leak across splits.

    Near duplicates are merged greedily, closest pair first, and only within
    the same class. A near-identical image in another class is a *review
    candidate*, not proof of duplication, so it is reported without merging
    (otherwise one flat photo could drag nine classes into one split).
    """

    union = _UnionFind(len(records))
    for indices in find_exact_duplicates(records).values():
        for other in indices[1:]:
            union.union(indices[0], other)

    pairs = find_near_duplicate_pairs(records, max_distance)
    for left, right, _distance in sorted(pairs, key=lambda item: (item[2], item[0], item[1])):
        if records[left].class_id != records[right].class_id:
            continue
        union.union(left, right, max_size=MAX_CLUSTER_SIZE)

    groups: dict[int, list[int]] = defaultdict(list)
    for index in range(len(records)):
        groups[union.find(index)].append(index)

    ordered = sorted(
        groups.values(),
        key=lambda members: records[members[0]].relative_path,
    )
    for number, members in enumerate(ordered, start=1):
        cluster_id = f"c{number:05d}"
        for index in members:
            records[index].cluster_id = cluster_id
    return pairs


# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------


def build_class_summaries(scan: DatasetScan) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    by_class: dict[str, list[ImageRecord]] = defaultdict(list)
    for record in scan.records:
        if record.class_id is not None:
            by_class[record.class_id].append(record)

    exact_groups = find_exact_duplicates(scan.records)
    duplicate_members: dict[str, int] = defaultdict(int)
    for indices in exact_groups.values():
        for index in indices:
            class_id = scan.records[index].class_id
            if class_id:
                duplicate_members[class_id] += 1

    cluster_sizes: dict[str, set[str]] = defaultdict(set)
    for record in scan.records:
        if record.class_id and record.cluster_id:
            cluster_sizes[record.class_id].add(record.cluster_id)

    rows: list[dict[str, Any]] = []
    for spec in taxonomy.TAXONOMY:
        members = by_class.get(spec.class_id, [])
        ok = sum(1 for record in members if record.status == "ok")
        unreadable = sum(1 for record in members if record.status == "unreadable")
        unsupported = sum(1 for record in members if record.status == "unsupported")
        rows.append(
            {
                "class_id": spec.class_id,
                "folder_label": spec.folder_name,
                "display_name": spec.display_name,
                "category": spec.category,
                "image_count": len(members),
                "readable_count": ok,
                "unreadable_count": unreadable,
                "unsupported_count": unsupported,
                "duplicate_images": duplicate_members.get(spec.class_id, 0),
                "duplicate_clusters": len(cluster_sizes.get(spec.class_id, set())),
                "needs_label_review": spec.needs_review,
                "folder_present": spec.folder_name in scan.folders,
            }
        )

    readable = [row["readable_count"] for row in rows if row["readable_count"] > 0]
    counts = sorted(readable)
    total = sum(readable)
    imbalance: dict[str, Any] = {
        "total_readable_images": total,
        "classes_with_images": len(readable),
        "largest_class": max(rows, key=lambda row: row["readable_count"])["class_id"] if total else None,
        "smallest_class": min(
            (row for row in rows if row["readable_count"] > 0),
            key=lambda row: row["readable_count"],
        )["class_id"]
        if total
        else None,
        "max_count": counts[-1] if counts else 0,
        "min_count": counts[0] if counts else 0,
        "median_count": (counts[len(counts) // 2] if len(counts) % 2 else (counts[len(counts) // 2 - 1] + counts[len(counts) // 2]) / 2)
        if counts
        else 0,
        "imbalance_ratio_max_over_min": round(counts[-1] / counts[0], 2) if counts and counts[0] else None,
        "classes_below_500_images": [row["class_id"] for row in rows if 0 < row["readable_count"] < 500],
        "classes_below_25pct_of_median": [],
    }
    median = float(imbalance["median_count"] or 0)
    if median:
        imbalance["classes_below_25pct_of_median"] = [
            row["class_id"] for row in rows if 0 < row["readable_count"] < 0.25 * median
        ]

    for row in rows:
        row["share_pct"] = round(100.0 * row["readable_count"] / total, 2) if total else 0.0
        row["low_count_flag"] = bool(row["class_id"] in imbalance["classes_below_25pct_of_median"])
    return rows, imbalance


def build_review_rows(
    scan: DatasetScan,
    pairs: Sequence[tuple[int, int, int]],
) -> list[dict[str, Any]]:
    """Rows for human review: duplicates, look-alikes, broken files, label risks."""

    rows: list[dict[str, Any]] = []
    records = scan.records

    for digest, indices in find_exact_duplicates(records).items():
        first = records[indices[0]]
        for index in indices:
            record = records[index]
            rows.append(
                {
                    "issue": "exact_duplicate",
                    "severity": "high" if any(records[other].class_id != record.class_id for other in indices) else "medium",
                    "class_id": record.class_id or "",
                    "folder_label": record.folder_label,
                    "relative_path": record.relative_path,
                    "related_path": first.relative_path,
                    "distance": 0,
                    "similarity": 1.0,
                    "detail": f"identical bytes: {digest[:16]}…",
                }
            )

    for left, right, distance in pairs:
        left_record, right_record = records[left], records[right]
        if left_record.sha256 and left_record.sha256 == right_record.sha256:
            continue  # already reported as an exact duplicate
        cross_class = left_record.class_id != right_record.class_id
        similarity = _thumbnail_correlation(left_record.thumbnail, right_record.thumbnail)
        rows.append(
            {
                "issue": "near_duplicate_cross_class" if cross_class else "near_duplicate",
                "severity": "high" if cross_class and similarity >= 0.90 else "medium" if cross_class else "low",
                "class_id": left_record.class_id or "",
                "folder_label": left_record.folder_label,
                "relative_path": left_record.relative_path,
                "related_path": right_record.relative_path,
                "distance": distance,
                "similarity": round(similarity, 4),
                "detail": (
                    f"hamming={distance}; other class={right_record.class_id}; corr={similarity:.3f}"
                    if cross_class
                    else f"hamming={distance}; corr={similarity:.3f}"
                ),
            }
        )

    for record in records:
        if record.status == "unreadable":
            rows.append(
                {
                    "issue": "unreadable_file",
                    "severity": "high",
                    "class_id": record.class_id or "",
                    "folder_label": record.folder_label,
                    "relative_path": record.relative_path,
                    "related_path": "",
                    "distance": "",
                    "similarity": "",
                    "detail": record.error or "",
                }
            )
        elif record.status == "unsupported":
            rows.append(
                {
                    "issue": "unsupported_file",
                    "severity": "low",
                    "class_id": record.class_id or "",
                    "folder_label": record.folder_label,
                    "relative_path": record.relative_path,
                    "related_path": "",
                    "distance": "",
                    "similarity": "",
                    "detail": record.error or "",
                }
            )

    rows.sort(
        key=lambda row: (
            row["severity"] != "high",
            -float(row.get("similarity") or 0.0),
            row["issue"],
            row["relative_path"],
        )
    )
    return rows


def audit_dataset(
    root: Path = DATASET_ROOT,
    output_dir: Path = REPORTS_ROOT,
    workers: int = 1,
    near_duplicate_distance: int = DEFAULT_NEAR_DUPLICATE_DISTANCE,
) -> dict[str, Any]:
    """Run the full audit and write JSON + CSV reports. Read-only on ``root``."""

    scan = scan_dataset(root, workers=workers, near_duplicate_distance=near_duplicate_distance)
    pairs = scan.near_pairs
    class_rows, imbalance = build_class_summaries(scan)
    review_rows = build_review_rows(scan, pairs)
    exact_groups = find_exact_duplicates(scan.records)

    status_counts = defaultdict(int)
    for record in scan.records:
        status_counts[record.status] += 1

    duplicate_bytes = sum(
        scan.records[index].size_bytes
        for indices in exact_groups.values()
        for index in indices[1:]
    )

    clusters: dict[str, list[str]] = defaultdict(list)
    cluster_classes: dict[str, set[str]] = defaultdict(set)
    for record in scan.records:
        if record.cluster_id:
            clusters[record.cluster_id].append(record.relative_path)
            if record.class_id:
                cluster_classes[record.cluster_id].add(record.class_id)
    multi_clusters = {key: value for key, value in clusters.items() if len(value) > 1}
    mixed_clusters = {
        key: sorted(cluster_classes[key])
        for key in multi_clusters
        if len(cluster_classes[key]) > 1
    }
    low_detail = sum(
        1
        for record in scan.records
        if record.status == "ok" and (record.detail_std or 0.0) < MIN_DETAIL_STD
    )

    label_flags = [
        {
            "class_id": spec.class_id,
            "folder_label": spec.folder_name,
            "reason": spec.notes,
            "kind": "uncommon_on_rice" if spec.class_id == "downy_mildew" else "small_or_ambiguous_class",
        }
        for spec in taxonomy.TAXONOMY
        if spec.needs_review
    ]
    label_flags.extend(
        {
            "class_id": row["class_id"],
            "folder_label": row["folder_label"],
            "reason": "Very small class; a 15% test split will contain very few images.",
            "kind": "low_count",
        }
        for row in class_rows
        if row["low_count_flag"]
    )
    label_flags.extend(
        {
            "class_id": item.class_id or "",
            "folder_label": item.folder_name,
            "reason": "Folder name did not match any taxonomy entry; excluded from training.",
            "kind": "unmapped_folder",
        }
        for item in scan.mapping
        if item.class_id is None
    )

    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "dataset_root": str(root.resolve()),
        "dataset_mutated": False,
        "parameters": {
            "near_duplicate_distance": near_duplicate_distance,
            "thumbnail_max_mae": DEFAULT_THUMBNAIL_MAX_MAE,
            "min_detail_std": MIN_DETAIL_STD,
            "max_cluster_size": MAX_CLUSTER_SIZE,
            "supported_extensions": sorted(SUPPORTED_EXTENSIONS),
            "workers": workers,
        },
        "totals": {
            "files": len(scan.records),
            "readable_images": status_counts.get("ok", 0),
            "unreadable_files": status_counts.get("unreadable", 0),
            "unsupported_files": status_counts.get("unsupported", 0),
            "class_folders": len(scan.folders),
            "empty_class_folders": scan.empty_folders,
            "unmapped_class_folders": scan.unmapped_folders,
            "root_level_files": scan.root_level_files,
        },
        "formats": dict(
            sorted(
                {
                    record.extension or "<none>": sum(
                        1 for other in scan.records if other.extension == record.extension and other.status == "ok"
                    )
                    for record in scan.records
                }.items()
            )
        ),
        "classes": class_rows,
        "imbalance": imbalance,
        "duplicates": {
            "exact_groups": len(exact_groups),
            "exact_images_in_groups": sum(len(indices) for indices in exact_groups.values()),
            "reclaimable_bytes_if_deduplicated": duplicate_bytes,
            "near_duplicate_pairs": len(pairs),
            "cross_class_near_duplicate_pairs": sum(
                1 for pair in pairs if scan.records[pair[0]].class_id != scan.records[pair[1]].class_id
            ),
            "duplicate_clusters": len(multi_clusters),
            "largest_cluster_size": max((len(value) for value in multi_clusters.values()), default=0),
            "clusters_spanning_multiple_classes": {
                "count": len(mixed_clusters),
                "examples": dict(list(sorted(mixed_clusters.items()))[:5]),
                "note": "Only exact-byte duplicates merge across classes; these are label conflicts worth checking.",
            },
            "low_detail_images_excluded_from_matching": low_detail,
        },
        "label_flags": label_flags,
        "class_mapping": [item.as_dict() for item in scan.mapping],
        "limitations": [
            "Near-duplicate detection uses a 64-bit dHash verified by a 16x16 pixel comparison; it catches resized, recompressed and lightly cropped copies, not heavy transforms or rotated scans.",
            "Images with almost no contrast are excluded from perceptual matching (they collide trivially) and are reported in low_detail_images_excluded_from_matching.",
            "Near-duplicate clusters are merged within a class only; cross-class look-alikes are flagged for review instead of being merged.",
            "No source/field identifier exists in the folder layout, so images of the same plant cannot be grouped beyond visual duplicates.",
            "Label correctness is not verifiable from filenames; class folders may contain mislabelled images.",
            "Corrupt or unsupported files are reported but never deleted or moved.",
        ],
    }

    output_dir = Path(output_dir)
    write_json(output_dir / "dataset_audit.json", report)
    write_json(output_dir / "class_mapping.json", taxonomy.mapping_payload())
    _write_csv(output_dir / "dataset_audit_classes.csv", class_rows)
    _write_csv(output_dir / "dataset_audit_review.csv", review_rows)
    _write_csv(
        output_dir / "dataset_index.csv",
        [
            {
                "relative_path": record.relative_path,
                "class_id": record.class_id or "",
                "folder_label": record.folder_label,
                "status": record.status,
                "sha256": record.sha256 or "",
                "dhash": f"{record.dhash:016x}" if record.dhash is not None else "",
                "cluster_id": record.cluster_id or "",
                "width": record.width or "",
                "height": record.height or "",
                "image_format": record.image_format or "",
                "size_bytes": record.size_bytes,
            }
            for record in scan.records
        ],
    )
    return report


def _write_csv(path: Path, rows: Sequence[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if rows:
        fieldnames = list(rows[0].keys())
    else:
        fieldnames = ["issue"]
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow(row)


def format_summary(report: dict[str, Any]) -> str:
    """Human-readable terminal summary."""

    totals = report["totals"]
    lines = [
        f"Dataset: {report['dataset_root']}",
        f"Files: {totals['files']} | readable: {totals['readable_images']} | "
        f"unreadable: {totals['unreadable_files']} | unsupported: {totals['unsupported_files']}",
        "",
        f"{'class_id':28s} {'count':>7s} {'share':>7s} {'dupes':>6s} {'clusters':>9s}",
    ]
    for row in report["classes"]:
        lines.append(
            f"{row['class_id']:28s} {row['readable_count']:7d} {row['share_pct']:6.2f}% "
            f"{row['duplicate_images']:6d} {row['duplicate_clusters']:9d}"
        )
    imbalance = report["imbalance"]
    lines.append("")
    lines.append(
        f"Imbalance: max/min={imbalance['imbalance_ratio_max_over_min']} "
        f"median={imbalance['median_count']} "
        f"below 25% of median={imbalance['classes_below_25pct_of_median']}"
    )
    duplicates = report["duplicates"]
    lines.append(
        f"Duplicates: {duplicates['exact_groups']} exact groups "
        f"({duplicates['exact_images_in_groups']} images), "
        f"{duplicates['near_duplicate_pairs']} near pairs, "
        f"{duplicates['cross_class_near_duplicate_pairs']} cross-class pairs"
    )
    lines.append(
        f"Clusters: {duplicates['duplicate_clusters']} with >1 image, "
        f"largest={duplicates['largest_cluster_size']}, "
        f"mixed-class={duplicates['clusters_spanning_multiple_classes']['count']}, "
        f"low-detail excluded={duplicates['low_detail_images_excluded_from_matching']}"
    )
    if totals["empty_class_folders"]:
        lines.append(f"Empty folders: {totals['empty_class_folders']}")
    if totals["unmapped_class_folders"]:
        lines.append(f"Unmapped folders: {totals['unmapped_class_folders']}")
    return "\n".join(lines)


if __name__ == "__main__":  # pragma: no cover - convenience only
    print(format_summary(audit_dataset(workers=min(8, os.cpu_count() or 1))))
    sys.exit(0)
