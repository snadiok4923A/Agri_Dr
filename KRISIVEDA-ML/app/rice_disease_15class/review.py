"""Turn audit and evaluation evidence into a human label-review queue.

The audit writes one row per *pair*, so ``dataset_audit_review.csv`` has
73k rows for this dataset while describing roughly a hundred distinct
decisions: "these 790 images are near-duplicates of brown_spot images" is one
question, not 790. This module collapses those rows into **cases**.

A case is one question a human can answer:

* ``exact_label_conflict`` — byte-identical files in two different classes.
* ``near_duplicate_cross_class`` — a connected group of look-alikes spanning
  two classes.
* ``misclassified_with_duplicate_evidence`` — the model predicted class X and
  the image is a look-alike of images labelled X. Strongest label-error signal.
* ``confident_misclassification`` — the model is very sure and disagrees with
  the folder label, with no duplicate evidence.
* ``systematic_confusion`` — a recurring (true, predicted) pattern; usually a
  model limitation or an intrinsically ambiguous pair, not a wrong label.

Everything here is **read-only** on ``data/``. Decisions are written to
``reports/rice_disease_15class/review/`` and, separately, to a proposed
override file for a future dataset version. No image is ever moved, renamed,
relabelled or deleted.
"""

from __future__ import annotations

import csv
import json
import os
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable, Mapping, Sequence

from app.rice_disease_15class import taxonomy
from app.rice_disease_15class.config import DATASET_ROOT, REPORTS_ROOT, write_json

REVIEW_DIR = REPORTS_ROOT / "review"
LABELS_DIR = REPORTS_ROOT / "labels"

#: Evidence with a perceptual distance at or below this is treated as a
#: same-picture look-alike rather than "similar class texture".
STRONG_DISTANCE = 1
STRONG_SIMILARITY = 0.90
#: A model decision at or above this confidence is "confident" for review
#: ordering. Deliberately independent of ``inference.MIN_CONFIDENCE``: this is
#: a review heuristic, not a serving threshold.
CONFIDENT_PREDICTION = 0.90

#: Images shown per case. Larger families are truncated in the UI and CSV while
#: their true size stays in the summary.
MAX_IMAGES_PER_CASE = 24
#: Look-alike components at or above this size become their own case; smaller
#: ones are aggregated per class pair so the queue stays reviewable.
MIN_COMPONENT_IMAGES = 5

PRIORITY_LABELS = {
    1: "P1 - likely label error",
    2: "P2 - ambiguous pair, needs a human call",
    3: "P3 - model weakness, label probably fine",
}

KIND_TITLES = {
    "exact_label_conflict": "Identical files, two different labels",
    "near_duplicate_cross_class": "Look-alike images across two classes",
    "misclassified_with_duplicate_evidence": "Model wrong, and the image copies the predicted class",
    "confident_misclassification": "Model confidently disagrees with the folder label",
    "systematic_confusion": "Recurring confusion pattern",
}

DECISIONS = ("confirm", "incorrect", "defer")


# ---------------------------------------------------------------------------
# Data model
# ---------------------------------------------------------------------------


@dataclass
class ReviewImage:
    """One image inside a case, with the evidence that put it there."""

    relative_path: str
    class_id: str
    folder_label: str
    role: str  # "subject" | "counterpart"
    split: str = ""
    evidence: str = ""
    related_paths: list[str] = field(default_factory=list)
    predicted_class: str = ""
    confidence: float | None = None

    def as_dict(self) -> dict[str, Any]:
        return {
            "relative_path": self.relative_path,
            "class_id": self.class_id,
            "folder_label": self.folder_label,
            "role": self.role,
            "split": self.split,
            "evidence": self.evidence,
            "related_paths": list(self.related_paths),
            "predicted_class": self.predicted_class,
            "confidence": self.confidence,
        }


@dataclass
class ReviewCase:
    """One human decision, with its evidence and a bounded image sample."""

    case_id: str
    kind: str
    priority: int
    title: str
    question: str
    class_pair: tuple[str, str] | None
    images: list[ReviewImage]
    images_in_case: int
    images_per_class: dict[str, int]
    evidence: str
    review_hint: str
    split_counts: dict[str, int] = field(default_factory=dict)
    truncated: bool = False

    @property
    def priority_label(self) -> str:
        return PRIORITY_LABELS[self.priority]

    @property
    def classes(self) -> list[str]:
        return list(self.class_pair) if self.class_pair else sorted(self.images_per_class)

    def as_dict(self) -> dict[str, Any]:
        return {
            "case_id": self.case_id,
            "kind": self.kind,
            "kind_title": KIND_TITLES.get(self.kind, self.kind),
            "priority": self.priority,
            "priority_label": self.priority_label,
            "title": self.title,
            "question": self.question,
            "classes": self.classes,
            "class_pair": list(self.class_pair) if self.class_pair else None,
            "images_in_case": self.images_in_case,
            "images_shown": len(self.images),
            "truncated": self.truncated,
            "images_per_class": dict(sorted(self.images_per_class.items())),
            "split_counts": dict(sorted(self.split_counts.items())),
            "evidence": self.evidence,
            "review_hint": self.review_hint,
            "images": [image.as_dict() for image in self.images],
        }


# ---------------------------------------------------------------------------
# Loading the existing reports
# ---------------------------------------------------------------------------


def _read_rows(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle))


def load_class_lookup(index_path: Path) -> tuple[dict[str, str], dict[str, str]]:
    """Return ``relative_path -> class_id`` and ``folder_label -> class_id``."""

    by_path: dict[str, str] = {}
    by_folder: dict[str, str] = {}
    for row in _read_rows(index_path):
        relative_path = row.get("relative_path", "")
        class_id = row.get("class_id", "")
        if not relative_path or not class_id:
            continue
        by_path[relative_path] = class_id
        by_folder.setdefault(relative_path.split("/")[0], class_id)
    return by_path, by_folder


def load_split_lookup(split_manifest: Path | None) -> dict[str, str]:
    if split_manifest is None or not Path(split_manifest).is_file():
        return {}
    return {
        row["relative_path"]: row["split"]
        for row in _read_rows(Path(split_manifest))
        if row.get("relative_path")
    }


def _class_of(relative_path: str, by_path: Mapping[str, str], by_folder: Mapping[str, str]) -> str:
    return by_path.get(relative_path) or by_folder.get(relative_path.split("/")[0], "")


def _display(class_id: str) -> str:
    try:
        return taxonomy.get_spec(class_id).display_name
    except taxonomy.TaxonomyError:
        return class_id


# ---------------------------------------------------------------------------
# Grouping helpers
# ---------------------------------------------------------------------------


class _UnionFind:
    def __init__(self) -> None:
        self._parent: dict[str, str] = {}

    def find(self, item: str) -> str:
        self._parent.setdefault(item, item)
        root = item
        while self._parent[root] != root:
            root = self._parent[root]
        while self._parent[item] != root:
            self._parent[item], item = root, self._parent[item]
        return root

    def union(self, left: str, right: str) -> None:
        left_root, right_root = self.find(left), self.find(right)
        if left_root != right_root:
            self._parent[right_root] = left_root

    def groups(self, items: Iterable[str]) -> list[list[str]]:
        buckets: dict[str, list[str]] = defaultdict(list)
        for item in items:
            buckets[self.find(item)].append(item)
        return [sorted(members) for members in buckets.values()]


def _strong_evidence(distance: float | None, similarity: float | None) -> bool:
    if distance is not None and distance <= STRONG_DISTANCE:
        return True
    return similarity is not None and similarity >= STRONG_SIMILARITY


def _fmt_float(value: float | None, digits: int = 2) -> str:
    return "" if value is None else f"{value:.{digits}f}"


def _to_float(value: Any) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


# ---------------------------------------------------------------------------
# Case builders
# ---------------------------------------------------------------------------


def _exact_conflict_cases(
    rows: Sequence[Mapping[str, str]],
    by_path: Mapping[str, str],
    by_folder: Mapping[str, str],
    splits: Mapping[str, str],
    max_images: int = MAX_IMAGES_PER_CASE,
) -> list[ReviewCase]:
    """Byte-identical images filed under two different labels."""

    # Union-find rather than "group by related_path": the audit writes one row
    # per file pointing at the first file of the group, but a hand-made or
    # older CSV may point both ways, and both must collapse to one case.
    graph = _UnionFind()
    mentioned: set[str] = set()
    for row in rows:
        if row.get("issue") != "exact_duplicate":
            continue
        subject = row.get("relative_path", "")
        related = row.get("related_path", "")
        if not subject:
            continue
        graph.find(subject)
        mentioned.add(subject)
        if related:
            graph.union(subject, related)
            mentioned.add(related)

    cases: list[ReviewCase] = []
    for members in graph.groups(mentioned):
        paths = sorted(members)
        class_ids = {_class_of(path, by_path, by_folder) for path in paths}
        class_ids.discard("")
        if len(class_ids) < 2:
            continue  # same-class redundancy is housekeeping, not a label call

        images = [
            ReviewImage(
                relative_path=path,
                class_id=_class_of(path, by_path, by_folder),
                folder_label=path.split("/")[0],
                role="subject",
                split=splits.get(path, ""),
                evidence="byte-identical to the other file(s) in this case",
                related_paths=[other for other in paths if other != path],
            )
            for path in paths[:max_images]
        ]
        per_class = Counter(_class_of(path, by_path, by_folder) for path in paths)
        pair = tuple(sorted(class_ids))[:2]
        cases.append(
            ReviewCase(
                case_id="",
                kind="exact_label_conflict",
                priority=1,
                title=f"Identical bytes: {' vs '.join(_display(c) for c in pair)}",
                question="These files are byte-for-byte identical but sit in two classes. Which label is right?",
                class_pair=(pair[0], pair[1]) if len(pair) == 2 else None,
                images=images,
                images_in_case=len(paths),
                images_per_class=dict(per_class),
                evidence=f"{len(paths)} identical files across {len(class_ids)} classes",
                review_hint="One of the two copies has the wrong label (or one is a stray copy). Confirm the correct class, then fix it in a new dataset version.",
                split_counts=dict(Counter(splits.get(path, "unassigned") for path in paths)),
                truncated=len(paths) > max_images,
            )
        )
    return cases


def _near_duplicate_cases(
    rows: Sequence[Mapping[str, str]],
    by_path: Mapping[str, str],
    by_folder: Mapping[str, str],
    splits: Mapping[str, str],
    max_images: int = MAX_IMAGES_PER_CASE,
) -> list[ReviewCase]:
    """Connected look-alike groups, one case per component within a class pair."""

    by_pair: dict[tuple[str, str], list[Mapping[str, str]]] = defaultdict(list)
    for row in rows:
        if row.get("issue") != "near_duplicate_cross_class":
            continue
        left, right = row["relative_path"], row["related_path"]
        pair = tuple(sorted((_class_of(left, by_path, by_folder), _class_of(right, by_path, by_folder))))
        if not all(pair) or pair[0] == pair[1]:
            continue
        by_pair[(pair[0], pair[1])].append(row)  # type: ignore[index]

    cases: list[ReviewCase] = []
    for pair, pair_rows in sorted(by_pair.items()):
        graph = _UnionFind()
        for row in pair_rows:
            graph.union(row["relative_path"], row["related_path"])

        # Per image: strongest evidence toward the other class in this pair.
        best: dict[str, dict[str, Any]] = {}
        for row in pair_rows:
            distance = _to_float(row.get("distance"))
            similarity = _to_float(row.get("similarity"))
            left, right = row["relative_path"], row["related_path"]
            for subject, counterpart in ((left, right), (right, left)):
                entry = best.setdefault(subject, {"distance": None, "similarity": None, "related": []})
                if distance is not None and (entry["distance"] is None or distance < entry["distance"]):
                    entry["distance"] = distance
                if similarity is not None and (entry["similarity"] is None or similarity > entry["similarity"]):
                    entry["similarity"] = similarity
                if counterpart not in entry["related"]:
                    entry["related"].append(counterpart)

        def sort_key(path: str) -> tuple[float, float, str]:
            entry = best.get(path, {})
            distance = entry.get("distance")
            similarity = entry.get("similarity")
            return (
                distance if distance is not None else 99.0,
                -(similarity if similarity is not None else 0.0),
                path,
            )

        pair_display = " / ".join(_display(class_id) for class_id in pair)

        def image_for(path: str, group_size: int) -> ReviewImage:
            entry = best.get(path, {})
            related: list[str] = list(entry.get("related") or [])
            counterpart = next(
                (
                    item
                    for item in related
                    if _class_of(item, by_path, by_folder) != _class_of(path, by_path, by_folder)
                ),
                "",
            )
            related_class = _class_of(counterpart, by_path, by_folder) if counterpart else ""
            distance_value = entry.get("distance")
            return ReviewImage(
                relative_path=path,
                class_id=_class_of(path, by_path, by_folder),
                folder_label=path.split("/")[0],
                role="subject",
                split=splits.get(path, ""),
                evidence=(
                    f"group of {group_size}; "
                    + (
                        f"dhash distance {int(distance_value)}"
                        if distance_value is not None
                        else "dhash distance unknown"
                    )
                    + f", thumbnail corr {_fmt_float(entry.get('similarity'), 3)}"
                    + (f" vs {_display(related_class)} image" if related_class else "")
                ),
                related_paths=sorted(related)[:5],
            )

        large: list[list[str]] = []
        small: list[list[str]] = []
        for members in graph.groups(
            {row[field] for row in pair_rows for field in ("relative_path", "related_path")}
        ):
            if len({_class_of(path, by_path, by_folder) for path in members}) < 2:
                continue
            (large if len(members) >= MIN_COMPONENT_IMAGES else small).append(members)

        # One case per sizeable look-alike family.
        for members in sorted(large, key=lambda group: (-len(group), sorted(group)[0])):
            member_classes = Counter(_class_of(path, by_path, by_folder) for path in members)
            strong = any(
                _strong_evidence(
                    best.get(path, {}).get("distance"), best.get(path, {}).get("similarity")
                )
                for path in members
            )
            cases.append(
                ReviewCase(
                    case_id="",
                    kind="near_duplicate_cross_class",
                    priority=1 if strong else 2,
                    title=f"{len(members)} look-alike images: {pair_display}",
                    question=(
                        "Are these the same picture filed under two labels, or two genuinely "
                        "similar conditions?"
                    ),
                    class_pair=(pair[0], pair[1]),
                    images=[image_for(path, len(members)) for path in sorted(members, key=sort_key)[:max_images]],
                    images_in_case=len(members),
                    images_per_class=dict(member_classes),
                    evidence=(
                        f"{len(members)} images in one look-alike family; "
                        f"{'includes an identical/near-identical hash pair' if strong else 'similarity only'}"
                    ),
                    review_hint=(
                        "Look at 3-4 pairs: if the same leaf or the same photo session appears in both "
                        "classes, the minority label is wrong. If both conditions genuinely look alike, "
                        "record 'confirm' and treat it as class overlap instead."
                    ),
                    split_counts=dict(Counter(splits.get(path, "unassigned") for path in members)),
                    truncated=len(members) > max_images,
                )
            )

        # Isolated 2-4 image look-alikes: one aggregated case per class pair, so
        # ~980 tiny groups do not become ~980 separate tasks.
        if small:
            small_images = sorted({path for group in small for path in group})
            strong_groups = sum(
                1
                for group in small
                if any(
                    _strong_evidence(
                        best.get(path, {}).get("distance"), best.get(path, {}).get("similarity")
                    )
                    for path in group
                )
            )
            representative: list[str] = []
            for group in sorted(small, key=lambda group: (sort_key(sorted(group, key=sort_key)[0]), len(group))):
                for path in sorted(group, key=sort_key):
                    if path not in representative:
                        representative.append(path)
                    if len(representative) >= max_images:
                        break
                if len(representative) >= max_images:
                    break
            cases.append(
                ReviewCase(
                    case_id="",
                    kind="near_duplicate_cross_class",
                    priority=1 if strong_groups >= 10 else 2,
                    title=(
                        f"{len(small)} small look-alike groups: {pair_display} "
                        f"({len(small_images)} images)"
                    ),
                    question=(
                        "Do these isolated look-alikes share one systematic label mix-up, or are they "
                        "scattered coincidences?"
                    ),
                    class_pair=(pair[0], pair[1]),
                    images=[image_for(path, 2) for path in representative[:max_images]],
                    images_in_case=len(small_images),
                    images_per_class=dict(
                        Counter(_class_of(path, by_path, by_folder) for path in small_images)
                    ),
                    evidence=(
                        f"{len(small)} groups of 2-{MIN_COMPONENT_IMAGES - 1} images, "
                        f"{strong_groups} with an identical/near-identical hash pair; "
                        f"strongest {len(representative[:max_images])} images shown"
                    ),
                    review_hint=(
                        "Sample a few images and decide once for the group: a common pattern means a "
                        "systematic label issue, scattered pairs mean harmless overlap."
                    ),
                    split_counts=dict(
                        Counter(splits.get(path, "unassigned") for path in small_images)
                    ),
                    truncated=len(small_images) > max_images,
                )
            )
    return cases


def _misclassification_cases(
    misclassified: Sequence[Mapping[str, str]],
    near_rows: Sequence[Mapping[str, str]],
    by_path: Mapping[str, str],
    by_folder: Mapping[str, str],
    splits: Mapping[str, str],
    max_images: int = MAX_IMAGES_PER_CASE,
) -> list[ReviewCase]:
    """Split the 931 errors into label-evidence cases and model-weakness cases."""

    # cross-class duplicate evidence keyed by image path -> (related path, related class)
    cross_evidence: dict[str, list[tuple[str, str, str]]] = defaultdict(list)
    for row in near_rows:
        if row.get("issue") not in {"near_duplicate_cross_class", "exact_duplicate"}:
            continue
        left, right = row["relative_path"], row.get("related_path", "")
        if not right:
            continue
        left_class = _class_of(left, by_path, by_folder)
        right_class = _class_of(right, by_path, by_folder)
        if not left_class or not right_class or left_class == right_class:
            continue
        detail = row.get("detail", "")
        cross_evidence[left].append((right, right_class, detail))
        cross_evidence[right].append((left, left_class, detail))

    label_evidence: dict[tuple[str, str], list[Mapping[str, str]]] = defaultdict(list)
    confident: dict[tuple[str, str], list[Mapping[str, str]]] = defaultdict(list)
    systematic: dict[tuple[str, str], list[Mapping[str, str]]] = defaultdict(list)

    def counterpart_for(row: Mapping[str, str]) -> tuple[str, str, str]:
        for related, related_class, detail in cross_evidence.get(row["relative_path"], []):
            if related_class == row["predicted_class"]:
                return related, related_class, detail
        return "", "", ""

    for row in misclassified:
        pair = (row["true_class"], row["predicted_class"])
        if counterpart_for(row)[0]:
            label_evidence[pair].append(row)
        elif float(row.get("confidence") or 0.0) >= CONFIDENT_PREDICTION:
            confident[pair].append(row)
        else:
            systematic[pair].append(row)

    cases: list[ReviewCase] = []

    for pair, rows in sorted(label_evidence.items()):
        rows = sorted(rows, key=lambda r: (-float(r.get("confidence") or 0.0), r["relative_path"]))
        images: list[ReviewImage] = []
        for row in rows[:max_images]:
            related, related_class, detail = counterpart_for(row)
            images.append(
                ReviewImage(
                    relative_path=row["relative_path"],
                    class_id=row["true_class"],
                    folder_label=row["relative_path"].split("/")[0],
                    role="subject",
                    split=splits.get(row["relative_path"], ""),
                    evidence=(
                        f"model: {_display(row['predicted_class'])} {float(row['confidence']):.3f}; "
                        f"look-alike of {_display(related_class)} image {related}"
                    ),
                    related_paths=[related] if related else [],
                    predicted_class=row["predicted_class"],
                    confidence=float(row["confidence"]),
                )
            )
        cases.append(
            ReviewCase(
                case_id="",
                kind="misclassified_with_duplicate_evidence",
                priority=1,
                title=(
                    f"{len(rows)} test images labelled {_display(pair[0])} "
                    f"that copy {_display(pair[1])} images"
                ),
                question=(
                    "Does the folder label of these images need fixing, or is the pair genuinely "
                    "indistinguishable?"
                ),
                class_pair=pair,
                images=images,
                images_in_case=len(rows),
                images_per_class={pair[0]: len(rows)},
                evidence=(
                    f"model predicted {_display(pair[1])} and a near-duplicate of the image is filed "
                    f"under {_display(pair[1])}"
                ),
                review_hint=(
                    "A model error that repeats the label of a look-alike neighbour usually means the "
                    "folder label is wrong. Confirming a correction here invalidates the current test "
                    "numbers for these images, so the fix belongs in a new dataset version."
                ),
                split_counts=dict(Counter(splits.get(row["relative_path"], "unassigned") for row in rows)),
                truncated=len(rows) > max_images,
            )
        )

    for pair, rows in sorted(confident.items()):
        rows = sorted(rows, key=lambda r: (-float(r.get("confidence") or 0.0), r["relative_path"]))
        images = [
            ReviewImage(
                relative_path=row["relative_path"],
                class_id=row["true_class"],
                folder_label=row["relative_path"].split("/")[0],
                role="subject",
                split=splits.get(row["relative_path"], ""),
                evidence=(
                    f"model: {_display(row['predicted_class'])} {float(row['confidence']):.3f}; "
                    f"runner-up {_display(row.get('runner_up_class') or '')} "
                    f"{float(row.get('runner_up_confidence') or 0.0):.3f}"
                ),
                predicted_class=row["predicted_class"],
                confidence=float(row["confidence"]),
            )
            for row in rows[:max_images]
        ]
        cases.append(
            ReviewCase(
                case_id="",
                kind="confident_misclassification",
                priority=2,
                title=(
                    f"{len(rows)} confident errors: {_display(pair[0])} predicted "
                    f"{_display(pair[1])}"
                ),
                question="Is the label wrong, or does the image genuinely look like the other class?",
                class_pair=pair,
                images=images,
                images_in_case=len(rows),
                images_per_class={pair[0]: len(rows)},
                evidence=f"confidence >= {CONFIDENT_PREDICTION:.2f} on the wrong class, no duplicate evidence",
                review_hint="No duplicate supports a label error, so judge from the image itself. A confident, isolated error is often an unusual photo, not a wrong label.",
                split_counts=dict(Counter(splits.get(row["relative_path"], "unassigned") for row in rows)),
                truncated=len(rows) > max_images,
            )
        )

    for pair, rows in sorted(systematic.items(), key=lambda item: (-len(item[1]), item[0])):
        if len(rows) < 3:
            continue  # isolated low-confidence misses are noise, not a review task
        rows = sorted(rows, key=lambda r: (-float(r.get("confidence") or 0.0), r["relative_path"]))
        images = [
            ReviewImage(
                relative_path=row["relative_path"],
                class_id=row["true_class"],
                folder_label=row["relative_path"].split("/")[0],
                role="subject",
                split=splits.get(row["relative_path"], ""),
                evidence=f"model: {_display(row['predicted_class'])} {float(row['confidence']):.3f}",
                predicted_class=row["predicted_class"],
                confidence=float(row["confidence"]),
            )
            for row in rows[: min(8, max_images)]
        ]
        cases.append(
            ReviewCase(
                case_id="",
                kind="systematic_confusion",
                priority=3,
                title=f"{len(rows)} errors: {_display(pair[0])} -> {_display(pair[1])}",
                question="Is this a label problem, or a pair the model cannot separate yet?",
                class_pair=pair,
                images=images,
                images_in_case=len(rows),
                images_per_class={pair[0]: len(rows)},
                evidence=f"{len(rows)} low-confidence errors with no duplicate evidence (sample of 8 shown)",
                review_hint="Usually model weakness or genuine visual overlap. Confirm the labels and move on; only individual images that are clearly mislabelled deserve a correction.",
                split_counts=dict(Counter(splits.get(row["relative_path"], "unassigned") for row in rows)),
                truncated=len(rows) > 8,
            )
        )

    return cases


def build_review_queue(
    audit_review: Path,
    index: Path,
    misclassified: Path,
    split_manifest: Path | None = None,
    max_images_per_case: int = MAX_IMAGES_PER_CASE,
) -> list[ReviewCase]:
    """Group the raw report rows into ordered, bounded review cases."""

    cap = max(1, int(max_images_per_case))
    review_rows = _read_rows(Path(audit_review))
    by_path, by_folder = load_class_lookup(Path(index))
    splits = load_split_lookup(split_manifest)
    misclassified_rows = _read_rows(Path(misclassified)) if Path(misclassified).is_file() else []

    cases: list[ReviewCase] = []
    cases.extend(_exact_conflict_cases(review_rows, by_path, by_folder, splits, cap))
    cases.extend(_near_duplicate_cases(review_rows, by_path, by_folder, splits, cap))
    cases.extend(_misclassification_cases(misclassified_rows, review_rows, by_path, by_folder, splits, cap))

    cases.sort(
        key=lambda case: (
            case.priority,
            0 if case.kind == "exact_label_conflict" else 1,
            -case.images_in_case,
            case.class_pair or ("", ""),
            case.kind,
        )
    )
    for number, case in enumerate(cases, start=1):
        case.case_id = f"RC{number:04d}"
    return cases


# ---------------------------------------------------------------------------
# Outputs
# ---------------------------------------------------------------------------


def _write_csv(path: Path, rows: Sequence[Mapping[str, Any]], fieldnames: Sequence[str] | None = None) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if fieldnames is None:
        fieldnames = list(rows[0].keys()) if rows else ["case_id"]
    with path.open("w", encoding="utf-8-sig", newline="") as handle:  # Excel-friendly BOM
        writer = csv.DictWriter(handle, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        for row in rows:
            writer.writerow(row)


CASE_FIELDS = [
    "case_id",
    "priority",
    "priority_label",
    "kind",
    "kind_title",
    "classes",
    "images_in_case",
    "images_shown",
    "evidence",
    "question",
    "review_hint",
    "decision",
    "decision_note",
    "reviewer",
    "reviewed_at",
]

#: Why one *image* is in the queue, so `review_items.csv` reads correctly
#: without the case row next to it.
ITEM_REASON = {
    "exact_label_conflict": (
        "Byte-identical file also appears under another class; one of the two labels must be wrong."
    ),
    "near_duplicate_cross_class": (
        "Looks like an image filed under a different class: either a duplicate with a wrong label "
        "or genuine visual overlap between the two classes."
    ),
    "misclassified_with_duplicate_evidence": (
        "The model predicted another class and this image duplicates an image carrying that label; "
        "a wrong folder label is likely."
    ),
    "confident_misclassification": (
        "The model is very confident and disagrees with the folder label; either an unusual photo "
        "or a wrong label."
    ),
    "systematic_confusion": (
        "Part of a recurring confusion pattern; usually model weakness or genuine overlap, so the "
        "label is probably fine."
    ),
}

ITEM_FIELDS = [
    "case_id",
    "priority",
    "kind",
    "relative_path",
    "class_id",
    "folder_label",
    "split",
    "evidence",
    "reason",
    "related_paths",
    "decision",
    "corrected_class",
    "reviewer",
    "reviewed_at",
    "notes",
]


def _case_rows(cases: Sequence[ReviewCase]) -> list[dict[str, Any]]:
    return [
        {
            "case_id": case.case_id,
            "priority": case.priority,
            "priority_label": case.priority_label,
            "kind": case.kind,
            "kind_title": KIND_TITLES.get(case.kind, case.kind),
            "classes": " | ".join(case.classes),
            "images_in_case": case.images_in_case,
            "images_shown": len(case.images),
            "evidence": case.evidence,
            "question": case.question,
            "review_hint": case.review_hint,
            "decision": "",
            "decision_note": "",
            "reviewer": "",
            "reviewed_at": "",
        }
        for case in cases
    ]


def _item_rows(cases: Sequence[ReviewCase]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for case in cases:
        for image in case.images:
            rows.append(
                {
                    "case_id": case.case_id,
                    "priority": case.priority,
                    "kind": case.kind,
                    "relative_path": image.relative_path,
                    "class_id": image.class_id,
                    "folder_label": image.folder_label,
                    "split": image.split,
                    "evidence": image.evidence,
                    "reason": ITEM_REASON.get(case.kind, "Listed by the audit or evaluation report."),
                    "related_paths": " | ".join(image.related_paths),
                    "decision": "",
                    "corrected_class": "",
                    "reviewer": "",
                    "reviewed_at": "",
                    "notes": "",
                }
            )
    return rows


def summarise(cases: Sequence[ReviewCase]) -> dict[str, Any]:
    by_kind = Counter(case.kind for case in cases)
    by_priority = Counter(case.priority for case in cases)
    images_by_kind = Counter({kind: 0 for kind in KIND_TITLES})
    for case in cases:
        images_by_kind[case.kind] += case.images_in_case
    pairs: Counter[tuple[str, str]] = Counter()
    for case in cases:
        if case.class_pair:
            pairs[case.class_pair] += case.images_in_case
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "cases": len(cases),
        "images": sum(case.images_in_case for case in cases),
        "by_kind": dict(sorted(by_kind.items())),
        "images_by_kind": dict(sorted(images_by_kind.items())),
        "by_priority": {str(key): value for key, value in sorted(by_priority.items())},
        "top_class_pairs": [
            {"classes": list(pair), "images": count} for pair, count in pairs.most_common(10)
        ],
        "decisions_made": 0,
        "note": (
            "Cases are review tasks, not findings. No label has been changed: correcting a case "
            "requires an explicit decision, and applying those decisions needs a new dataset version."
        ),
    }


def build_review_outputs(
    cases: Sequence[ReviewCase],
    output_dir: Path = REVIEW_DIR,
    dataset_root: Path = DATASET_ROOT,
) -> dict[str, Any]:
    """Write CSV/Markdown/HTML/JSON review artifacts. Never touches the dataset."""

    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    summary = summarise(cases)

    _write_csv(output_dir / "review_cases.csv", _case_rows(cases), CASE_FIELDS)
    _write_csv(output_dir / "review_items.csv", _item_rows(cases), ITEM_FIELDS)
    write_json(output_dir / "review_queue.json", {"summary": summary, "cases": [c.as_dict() for c in cases]})
    (output_dir / "review_cases.md").write_text(_markdown(cases, summary), encoding="utf-8")
    (output_dir / "review.html").write_text(
        render_review_html(cases, summary, dataset_root=dataset_root, html_path=output_dir / "review.html"),
        encoding="utf-8",
    )
    summary["files"] = {
        name: str(output_dir / name)
        for name in ("review_cases.csv", "review_items.csv", "review_queue.json", "review_cases.md", "review.html")
    }
    return summary


def _markdown(cases: Sequence[ReviewCase], summary: Mapping[str, Any]) -> str:
    lines = [
        "# Label review queue — 15-class rice disease & pest dataset",
        "",
        f"Generated: {summary['generated_at']}",
        "",
        f"{summary['cases']} cases covering {summary['images']} images, collapsed from the raw "
        "73k-row audit review list. One case = one decision.",
        "",
        "**No image was moved, renamed, relabelled or deleted. Nothing here changes the dataset, "
        "the split manifests, the model, or the API.**",
        "",
        "## How to review",
        "",
        "1. Open `review.html` in a browser (double-click). Thumbnails load from the local dataset folder.",
        "2. Work top-down: P1 cases are the most likely label errors.",
        "3. Per case choose **Confirm** (labels are right), **Incorrect** (pick the correct class for "
        "the images that are wrong), or **Defer**.",
        "4. Press **Export decisions CSV** and save it as "
        "`reports/rice_disease_15class/review/review_decisions.csv`.",
        "5. Validate and convert the decisions with "
        "`python scripts/apply_label_decisions.py reports/rice_disease_15class/review/review_decisions.csv`.",
        "",
        "Prefer a spreadsheet? `review_cases.csv` and `review_items.csv` have empty `decision`, "
        "`corrected_class`, `reviewer`, `reviewed_at`, `notes` columns. Allowed decisions: "
        "`confirm`, `incorrect`, `defer`.",
        "",
        "## Case counts",
        "",
        "| kind | cases | images |",
        "| --- | --- | --- |",
    ]
    for kind, count in summary["by_kind"].items():
        lines.append(f"| {kind} | {count} | {summary['images_by_kind'].get(kind, 0)} |")
    lines.extend(["", "| priority | cases |", "| --- | --- |"])
    for priority, count in summary["by_priority"].items():
        lines.append(f"| P{priority} | {count} |")

    top = [case for case in cases if case.priority == 1][:12]
    if top:
        lines.extend(["", "## Top P1 cases", ""])
        for case in top:
            lines.append(
                f"- **{case.case_id}** — {case.title} ({case.images_in_case} images) — {case.evidence}"
            )

    if summary["top_class_pairs"]:
        lines.extend(["", "## Most affected class pairs", "", "| classes | images |", "| --- | --- |"])
        for row in summary["top_class_pairs"]:
            left, right = (row["classes"] + ["", ""])[:2]
            lines.append(f"| {_display(left)} / {_display(right)} | {row['images']} |")

    lines.extend(
        [
            "",
            "## Rules this workflow follows",
            "",
            "- Review evidence only; no automatic relabelling, deletion, movement or overwrite.",
            "- Cases from the test split are label evidence, never a reason to retune the model.",
            "- Confirming a correction makes the current test metrics stale for those images: apply "
            "fixes in a new dataset version, re-split with the same seed, retrain, and report the new "
            "numbers next to the old ones.",
            "- The 6-class production model and `/disease/predict` are untouched by any of this.",
            "",
        ]
    )
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Local HTML review interface
# ---------------------------------------------------------------------------


_HTML_TEMPLATE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>KRISIVEDA label review — 15-class dataset</title>
<style>
  :root { color-scheme: light dark; --p1:#c0392b; --p2:#b9770e; --p3:#2471a3; --line:#d5d8dc; }
  * { box-sizing: border-box; }
  body { font: 15px/1.45 system-ui, Segoe UI, Arial, sans-serif; margin: 0; padding: 0 0 4rem; background:#fbfbfb; color:#1b1b1b; }
  header { position: sticky; top: 0; background: #fff; border-bottom: 1px solid var(--line); padding: .8rem 1.2rem; z-index: 5; }
  h1 { font-size: 1.05rem; margin: 0 0 .5rem; }
  .bar { display: flex; flex-wrap: wrap; gap: .6rem; align-items: center; }
  select, input, button { font: inherit; padding: .3rem .5rem; border: 1px solid var(--line); border-radius: 6px; background: #fff; }
  button { cursor: pointer; }
  button.primary { background:#1e8449; color:#fff; border-color:#1e8449; }
  button.ghost { background:#fff; }
  .muted { color:#5d6d7e; font-size: .87rem; }
  main { padding: 1rem 1.2rem; display: grid; gap: 1rem; }
  .case { background:#fff; border:1px solid var(--line); border-left:5px solid var(--p3); border-radius:8px; padding:.8rem 1rem; }
  .case.P1 { border-left-color: var(--p1); } .case.P2 { border-left-color: var(--p2); }
  .case h2 { font-size: 1rem; margin: 0 0 .25rem; }
  .tag { display:inline-block; font-size:.75rem; padding:.1rem .4rem; border-radius:4px; background:#eef2f5; margin-right:.3rem; }
  .P1 .tag { background:#fadbd8; } .P2 .tag { background:#fdebd0; }
  .q { margin:.35rem 0 .2rem; font-weight:600; }
  .grid { display:grid; grid-template-columns: repeat(auto-fill, minmax(170px,1fr)); gap:.6rem; margin:.6rem 0; }
  figure { margin:0; border:1px solid var(--line); border-radius:6px; overflow:hidden; background:#f4f6f7; }
  img { width:100%; height:130px; object-fit:cover; display:block; background:#eaeded; }
  figcaption { padding:.35rem; font-size:.78rem; }
  .evidence { color:#5d6d7e; font-size:.72rem; display:block; margin-top:.15rem; }
  .actions { display:flex; flex-wrap:wrap; gap:.4rem; align-items:center; margin-top:.4rem; }
  .done-confirm { border-left-color:#1e8449; } .done-incorrect { border-left-color:#c0392b; } .done-defer { border-left-color:#7f8c8d; }
  .status { font-weight:600; font-size:.8rem; }
  .hidden { display:none; }
  #toast { position:fixed; bottom:1rem; right:1rem; background:#1b2631; color:#fff; padding:.6rem .9rem; border-radius:6px; opacity:0; transition:opacity .2s; }
  #toast.show { opacity:1; }
</style>
</head>
<body>
<header>
  <h1>Label review — 15-class rice disease &amp; pest dataset</h1>
  <div class="bar">
    <label>Priority <select id="fPriority"><option value="">all</option><option value="1">P1</option><option value="2">P2</option><option value="3">P3</option></select></label>
    <label>Kind <select id="fKind"><option value="">all</option></select></label>
    <label>Class <select id="fClass"><option value="">all</option></select></label>
    <label>Status <select id="fStatus"><option value="">all</option><option value="open">open</option><option value="done">decided</option></select></label>
    <input id="reviewer" placeholder="reviewer name">
    <button id="exportBtn" class="primary">Export decisions CSV</button>
    <button id="clearBtn" class="ghost">Clear saved decisions</button>
    <span id="count" class="muted"></span>
  </div>
  <div class="muted">Decisions stay in this browser (localStorage) until you export. Nothing is written to the dataset.</div>
</header>
<main id="list"></main>
<div id="toast"></div>
<script id="queue" type="application/json">__QUEUE_JSON__</script>
<script>
(function () {
  const queue = JSON.parse(document.getElementById('queue').textContent);
  const IMG_ROOT = __IMG_ROOT__;
  const STORE = 'krisiveda-label-review-v1';
  let decisions = {};
  try { decisions = JSON.parse(localStorage.getItem(STORE) || '{}'); } catch (e) { decisions = {}; }

  const list = document.getElementById('list');
  const countEl = document.getElementById('count');
  const kindSel = document.getElementById('fKind');
  const classSel = document.getElementById('fClass');
  const classes = queue.meta.classes;
  const kinds = queue.meta.kinds;
  kindSel.insertAdjacentHTML('beforeend', kinds.map(k => `<option value="${k}">${queue.meta.kind_titles[k] || k}</option>`).join(''));
  classSel.insertAdjacentHTML('beforeend', classes.map(c => `<option value="${c}">${c}</option>`).join(''));

  function save() { localStorage.setItem(STORE, JSON.stringify(decisions)); }
  function toast(msg) { const t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 1800); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

  function caseState(c) { return decisions[c.case_id] || null; }

  function render() {
    const fp = document.getElementById('fPriority').value;
    const fk = kindSel.value;
    const fc = classSel.value;
    const fs = document.getElementById('fStatus').value;
    const shown = queue.cases.filter(c =>
      (!fp || String(c.priority) === fp) &&
      (!fk || c.kind === fk) &&
      (!fc || c.classes.includes(fc)) &&
      (!fs || (fs === 'open' ? !caseState(c) : !!caseState(c)))
    );
    const decided = queue.cases.filter(c => caseState(c)).length;
    countEl.textContent = `${shown.length} shown / ${queue.cases.length} cases · ${decided} decided`;
    list.innerHTML = shown.map(card).join('') || '<p class="muted">No cases match these filters.</p>';
  }

  function card(c) {
    const d = caseState(c);
    const cls = `case P${c.priority}` + (d ? ` done-${d.decision}` : '');
    const imgHtml = c.images.map(img => `
      <figure>
        <img loading="lazy" src="${IMG_ROOT}/${img.relative_path.split('/').map(encodeURIComponent).join('/')}" alt="${esc(img.relative_path)}">
        <figcaption>
          <strong>${esc(img.class_id)}</strong>${img.split ? ` · ${esc(img.split)}` : ''}
          <span class="evidence">${esc(img.evidence)}</span>
          <select data-case="${c.case_id}" data-path="${esc(img.relative_path)}" data-current="${esc(img.class_id)}" class="corr">
            <option value="">as labeled</option>
            ${classes.filter(x => x !== img.class_id).map(x => `<option value="${x}" ${d && d.fixes && d.fixes[img.relative_path] === x ? 'selected' : ''}>${x}</option>`).join('')}
          </select>
        </figcaption>
      </figure>`).join('');
    return `<section class="${cls}" id="case-${c.case_id}">
      <h2>${c.case_id} · ${esc(c.title)}</h2>
      <div>
        <span class="tag">P${c.priority}</span>
        <span class="tag">${esc(c.kind_title)}</span>
        <span class="tag">${c.images_in_case} images${c.truncated ? ` (${c.images_shown} shown)` : ''}</span>
        ${Object.entries(c.images_per_class).map(([k, v]) => `<span class="tag">${esc(k)}: ${v}</span>`).join('')}
        ${Object.entries(c.split_counts).map(([k, v]) => `<span class="tag">${esc(k)}: ${v}</span>`).join('')}
      </div>
      <p class="q">${esc(c.question)}</p>
      <p class="muted">${esc(c.evidence)} — ${esc(c.review_hint)}</p>
      <div class="grid">${imgHtml}</div>
      <div class="actions">
        <button class="primary" data-act="confirm" data-case="${c.case_id}">Confirm all as labeled</button>
        <button data-act="incorrect" data-case="${c.case_id}">Save with corrections</button>
        <button class="ghost" data-act="defer" data-case="${c.case_id}">Defer</button>
        <input class="note" data-case="${c.case_id}" placeholder="note (optional)" value="${esc(d && d.note || '')}">
        <span class="status">${d ? `decided: ${esc(d.decision)}${Object.keys(d.fixes || {}).length ? ` · ${Object.keys(d.fixes).length} relabel(s)` : ''}` : 'open'}</span>
      </div>
    </section>`;
  }

  function fixesFor(caseId) {
    const fixes = {};
    document.querySelectorAll(`select.corr[data-case="${caseId}"]`).forEach(sel => {
      if (sel.value && sel.value !== sel.dataset.current) fixes[sel.dataset.path] = sel.value;
    });
    return fixes;
  }

  list.addEventListener('click', ev => {
    const btn = ev.target.closest('button[data-act]');
    if (!btn) return;
    const caseId = btn.dataset.case;
    const c = queue.cases.find(x => x.case_id === caseId);
    const act = btn.dataset.act;
    const fixes = act === 'incorrect' ? fixesFor(caseId) : {};
    if (act === 'incorrect' && !Object.keys(fixes).length) { toast('Pick a corrected class for at least one image first.'); return; }
    const note = (document.querySelector(`input.note[data-case="${caseId}"]`) || {}).value || '';
    decisions[caseId] = {
      case_id: caseId, kind: c.kind, priority: c.priority, decision: act,
      fixes: fixes, note: note,
      reviewer: document.getElementById('reviewer').value || '',
      reviewed_at: new Date().toISOString()
    };
    save(); render(); toast(`${caseId} saved as ${act}.`);
  });

  function csvEscape(v) { const s = String(v == null ? '' : v); return /[",\\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }

  document.getElementById('exportBtn').addEventListener('click', () => {
    const header = ['case_id','priority','kind','relative_path','class_id','decision','corrected_class','reviewer','reviewed_at','notes'];
    const rows = [header.join(',')];
    queue.cases.forEach(c => {
      const d = decisions[c.case_id];
      if (!d) return;
      if (d.decision === 'defer') {
        rows.push([c.case_id, c.priority, c.kind, '', '', 'defer', '', d.reviewer, d.reviewed_at, d.note || ''].map(csvEscape).join(','));
        return;
      }
      c.images.forEach(img => {
        const fix = (d.fixes || {})[img.relative_path] || '';
        const decision = fix ? 'incorrect' : 'confirm';
        rows.push([c.case_id, c.priority, c.kind, img.relative_path, img.class_id, decision, fix, d.reviewer, d.reviewed_at, d.note || ''].map(csvEscape).join(','));
      });
    });
    const blob = new Blob([rows.join('\\r\\n') + '\\r\\n'], {type: 'text/csv;charset=utf-8'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'review_decisions.csv';
    a.click();
    toast(`Exported ${rows.length - 1} decision rows.`);
  });

  document.getElementById('clearBtn').addEventListener('click', () => {
    if (!confirm('Clear all decisions saved in this browser? Export first.')) return;
    decisions = {}; save(); render(); toast('Cleared.');
  });

  ['fPriority','fKind','fClass','fStatus'].forEach(id => document.getElementById(id).addEventListener('change', render));
  render();
})();
</script>
</body>
</html>
"""


def render_review_html(
    cases: Sequence[ReviewCase],
    summary: Mapping[str, Any],
    dataset_root: Path = DATASET_ROOT,
    html_path: Path = REVIEW_DIR / "review.html",
) -> str:
    """Self-contained review page; images referenced by relative path.

    The queue is inlined because ``fetch()`` is blocked for ``file://`` pages,
    and a reviewer should be able to double-click the file.
    """

    html_dir = Path(html_path).resolve().parent
    image_root = Path(os.path.relpath(Path(dataset_root).resolve(), html_dir)).as_posix()
    payload = {
        "summary": summary,
        "cases": [case.as_dict() for case in cases],
        "meta": {
            "classes": list(taxonomy.CLASS_IDS),
            "kinds": list(KIND_TITLES),
            "kind_titles": dict(KIND_TITLES),
            "priorities": PRIORITY_LABELS,
        },
    }
    # "</script>" inside JSON would end the inline block early.
    serialised = json.dumps(payload, indent=None, separators=(",", ":")).replace("</", "<\\/")
    return (
        _HTML_TEMPLATE.replace("__QUEUE_JSON__", serialised)
        .replace("__IMG_ROOT__", json.dumps(image_root))
    )


# ---------------------------------------------------------------------------
# Applying decisions to a *proposed* dataset version
# ---------------------------------------------------------------------------


def apply_decisions(
    decisions_csv: Path,
    output_dir: Path = LABELS_DIR,
    dataset_root: Path = DATASET_ROOT,
) -> dict[str, Any]:
    """Validate human decisions and write a proposed override file.

    This never edits the dataset: labels on disk are folder names. The output
    is an explicit ``relative_path -> corrected class`` file that a future
    dataset version, split and training run can consume.
    """

    rows = _read_rows(Path(decisions_csv))
    if not rows:
        raise ValueError("Decision file is empty.")

    class_ids = set(taxonomy.CLASS_IDS)
    dataset_root = Path(dataset_root)
    errors: list[str] = []
    overrides: list[dict[str, Any]] = []
    seen: dict[str, dict[str, Any]] = {}
    counts = Counter()

    for line_number, row in enumerate(rows, start=2):
        decision = (row.get("decision") or "").strip().lower()
        relative_path = (row.get("relative_path") or "").strip()
        corrected = (row.get("corrected_class") or "").strip()
        current = (row.get("class_id") or "").strip()

        if decision not in DECISIONS:
            errors.append(f"line {line_number}: unknown decision {decision!r}")
            continue
        counts[decision] += 1
        if decision == "defer":
            continue
        if not relative_path:
            errors.append(f"line {line_number}: decision {decision!r} without relative_path")
            continue
        if not (dataset_root / relative_path).is_file():
            errors.append(f"line {line_number}: path not found in dataset: {relative_path}")
            continue
        if decision == "incorrect":
            if corrected not in class_ids:
                errors.append(f"line {line_number}: corrected_class {corrected!r} is not a taxonomy class")
                continue
            if corrected == current:
                errors.append(f"line {line_number}: corrected_class equals the current class for {relative_path}")
                continue
        elif corrected:
            errors.append(f"line {line_number}: 'confirm' row carries corrected_class {corrected!r}")
            continue
        if current and current not in class_ids:
            errors.append(f"line {line_number}: class_id {current!r} is not a taxonomy class")
            continue

        entry = {
            "relative_path": relative_path,
            "current_class_id": current,
            "corrected_class_id": corrected if decision == "incorrect" else current,
            "decision": decision,
            "case_id": row.get("case_id", ""),
            "reviewer": row.get("reviewer", ""),
            "reviewed_at": row.get("reviewed_at", ""),
            "notes": row.get("notes", ""),
        }
        previous = seen.get(relative_path)
        if previous is not None and previous["corrected_class_id"] != entry["corrected_class_id"]:
            errors.append(
                f"line {line_number}: conflicting decisions for {relative_path} "
                f"({previous['corrected_class_id']} vs {entry['corrected_class_id']})"
            )
            continue
        seen[relative_path] = entry

    if errors:
        raise ValueError("Invalid decision file:\n- " + "\n- ".join(errors[:20]) + (
            f"\n({len(errors)} problems total)" if len(errors) > 20 else ""
        ))

    corrections = [entry for entry in seen.values() if entry["decision"] == "incorrect"]
    moves = Counter((entry["current_class_id"], entry["corrected_class_id"]) for entry in corrections)
    overrides = sorted(seen.values(), key=lambda entry: entry["relative_path"])

    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    _write_csv(
        output_dir / "label_overrides_proposed.csv",
        overrides,
        ["relative_path", "current_class_id", "corrected_class_id", "decision", "case_id", "reviewer", "reviewed_at", "notes"],
    )
    summary = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source_decisions": str(Path(decisions_csv)),
        "rows_read": len(rows),
        "images_reviewed": len(seen),
        "decisions": dict(sorted(counts.items())),
        "corrections": len(corrections),
        "moves": [
            {"from": left, "to": right, "images": count}
            for (left, right), count in moves.most_common()
        ],
        "status": "proposed — not applied to any dataset, split, or model",
        "next_steps": [
            "Copy the dataset to a new versioned folder (never edit the reviewed copy in place).",
            "Apply this override file while materialising that copy, then re-run the audit and split with the same seed.",
            "Retrain and re-evaluate; report the new numbers next to the current ones, which stay valid only for the unmodified dataset.",
        ],
    }
    write_json(output_dir / "label_overrides_summary.json", summary)
    return summary


def format_summary(summary: Mapping[str, Any]) -> str:
    lines = [
        f"Review cases: {summary['cases']} covering {summary['images']} images",
        "  by kind:",
    ]
    for kind, count in summary["by_kind"].items():
        lines.append(f"    {kind:42s} {count:4d} cases  {summary['images_by_kind'].get(kind, 0):6d} images")
    lines.append("  by priority: " + ", ".join(f"P{key}={value}" for key, value in summary["by_priority"].items()))
    if summary.get("top_class_pairs"):
        lines.append("  most affected pairs:")
        for row in summary["top_class_pairs"]:
            left, right = (row["classes"] + ["", ""])[:2]
            lines.append(f"    {left} / {right}: {row['images']} images")
    return "\n".join(lines)
