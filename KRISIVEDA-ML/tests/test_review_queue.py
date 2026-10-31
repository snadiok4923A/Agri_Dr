"""Tests for the label-review queue.

Synthetic fixtures only: a tiny dataset plus hand-written report rows, so the
tests describe exactly which grouping rule they exercise. Every test that
touches the dataset re-checks that no file changed.
"""

from __future__ import annotations

import csv
import json
import os
from pathlib import Path

import pytest
from PIL import Image

from app.rice_disease_15class import taxonomy
from app.rice_disease_15class.review import (
    KIND_TITLES,
    MAX_IMAGES_PER_CASE,
    MIN_COMPONENT_IMAGES,
    apply_decisions,
    build_review_outputs,
    build_review_queue,
    summarise,
)

AUDIT_HEADER = [
    "issue",
    "severity",
    "class_id",
    "folder_label",
    "relative_path",
    "related_path",
    "distance",
    "similarity",
    "detail",
]
INDEX_HEADER = [
    "relative_path",
    "class_id",
    "folder_label",
    "status",
    "sha256",
    "dhash",
    "cluster_id",
    "width",
    "height",
    "image_format",
    "size_bytes",
]
MIS_HEADER = [
    "relative_path",
    "true_class",
    "predicted_class",
    "confidence",
    "runner_up_class",
    "runner_up_confidence",
]
SPLIT_HEADER = ["relative_path", "class_id", "folder_label", "cluster_id", "split"]


def _write_csv(path: Path, header: list[str], rows: list[list[object]]) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(header)
        writer.writerows(rows)
    return path


def _dataset(root: Path, layout: dict[str, int]) -> Path:
    for folder, count in layout.items():
        folder_path = root / folder
        folder_path.mkdir(parents=True, exist_ok=True)
        for index in range(count):
            Image.new("RGB", (16, 16), (index * 7 % 255, 40, 90)).save(folder_path / f"{index:03d}.jpg")
    return root


def _snapshot(root: Path) -> dict[str, tuple[int, int]]:
    return {
        path.relative_to(root).as_posix(): (path.stat().st_size, path.stat().st_mtime_ns)
        for path in sorted(root.rglob("*"))
        if path.is_file()
    }


@pytest.fixture()
def fixtures(tmp_path: Path):
    """A dataset plus reports containing one of every case kind."""

    dataset = _dataset(
        tmp_path / "dataset",
        {"brown_spot": 6, "Leaf Smut": 2, "Healthy": 3, "dead_heart": 4, "white_stem_borer": 3},
    )
    reports = tmp_path / "reports"

    index_rows: list[list[object]] = []
    folder_to_class = {
        "brown_spot": "brown_spot",
        "Leaf Smut": "leaf_smut",
        "Healthy": "healthy_rice_leaf",
        "dead_heart": "dead_heart",
        "white_stem_borer": "white_stem_borer",
    }
    for folder, count in {"brown_spot": 6, "Leaf Smut": 2, "Healthy": 3, "dead_heart": 4, "white_stem_borer": 3}.items():
        for position in range(count):
            index_rows.append(
                [
                    f"{folder}/{position:03d}.jpg",
                    folder_to_class[folder],
                    folder,
                    "ok",
                    "",
                    "",
                    f"c{position:05d}",
                    16,
                    16,
                    "JPEG",
                    100,
                ]
            )
    index_path = _write_csv(reports / "dataset_index.csv", INDEX_HEADER, index_rows)

    audit_rows: list[list[object]] = [
        ["exact_duplicate", "high", "leaf_smut", "Leaf Smut", "Leaf Smut/000.jpg", "brown_spot/000.jpg", 0, 1.0, "identical bytes: abc…"],
        ["exact_duplicate", "high", "brown_spot", "brown_spot", "brown_spot/000.jpg", "Leaf Smut/000.jpg", 0, 1.0, "identical bytes: abc…"],
        # Same-class redundancy: must NOT become a label case.
        ["exact_duplicate", "medium", "brown_spot", "brown_spot", "brown_spot/001.jpg", "brown_spot/002.jpg", 0, 1.0, "identical bytes: def…"],
        ["exact_duplicate", "medium", "brown_spot", "brown_spot", "brown_spot/002.jpg", "brown_spot/002.jpg", 0, 1.0, "identical bytes: def…"],
    ]
    # A family large enough for its own case: all six dead_heart files point at
    # the same white_stem_borer file, so they form one component of 7 images.
    for position in range(6):
        audit_rows.append(
            [
                "near_duplicate_cross_class",
                "high",
                "dead_heart",
                "dead_heart",
                f"dead_heart/{position:03d}.jpg",
                "white_stem_borer/000.jpg",
                0,
                0.99,
                "hamming=0; other class=white_stem_borer; corr=0.990",
            ]
        )
    # Isolated pairs (below MIN_COMPONENT_IMAGES) in a second class pair.
    for position in range(2):
        audit_rows.append(
            [
                "near_duplicate_cross_class",
                "medium",
                "healthy_rice_leaf",
                "Healthy",
                f"Healthy/{position:03d}.jpg",
                f"brown_spot/{position + 2:03d}.jpg",
                4,
                0.72,
                "hamming=4; other class=brown_spot; corr=0.720",
            ]
        )
    audit_path = _write_csv(reports / "dataset_audit_review.csv", AUDIT_HEADER, audit_rows)

    mis_rows: list[list[object]] = [
        # Has duplicate evidence pointing at the predicted class -> P1.
        ["dead_heart/000.jpg", "dead_heart", "white_stem_borer", 0.61, "dead_heart", 0.30],
        # Confident, no duplicate evidence -> P2.
        ["brown_spot/003.jpg", "brown_spot", "leaf_smut", 0.95, "brown_spot", 0.02],
        # Low confidence, isolated -> would be systematic, but < 3 rows.
        ["Healthy/001.jpg", "healthy_rice_leaf", "brown_spot", 0.45, "healthy_rice_leaf", 0.40],
    ]
    for position in range(4):
        mis_rows.append([f"Healthy/{position:03d}.jpg", "healthy_rice_leaf", "leaf_smut", 0.40, "brown_spot", 0.35])
    mis_path = _write_csv(reports / "test_misclassified.csv", MIS_HEADER, mis_rows)

    split_rows = [
        [row[0], row[1], row[2], "c00001", "test" if position % 2 else "train"]
        for position, row in enumerate(index_rows)
    ]
    split_path = _write_csv(reports / "split_manifest.csv", SPLIT_HEADER, split_rows)

    return {
        "dataset": dataset,
        "reports": reports,
        "index": index_path,
        "audit": audit_path,
        "mis": mis_path,
        "split": split_path,
    }


def _queue(fixtures: dict[str, Path], cap: int = MAX_IMAGES_PER_CASE):
    return build_review_queue(
        audit_review=fixtures["audit"],
        index=fixtures["index"],
        misclassified=fixtures["mis"],
        split_manifest=fixtures["split"],
        max_images_per_case=cap,
    )


# ---------------------------------------------------------------------------
# Grouping
# ---------------------------------------------------------------------------


def test_every_case_kind_is_produced_and_labelled(fixtures: dict[str, Path]) -> None:
    cases = _queue(fixtures)
    kinds = {case.kind for case in cases}
    assert kinds == set(KIND_TITLES)
    assert all(case.case_id.startswith("RC") for case in cases)
    assert [case.priority for case in cases] == sorted(case.priority for case in cases)
    for case in cases:
        assert case.images, case.case_id
        assert case.question and case.evidence and case.review_hint
        assert set(case.images_per_class) <= set(taxonomy.CLASS_IDS)
        assert len(case.images) <= MAX_IMAGES_PER_CASE


def test_exact_duplicate_same_class_rows_are_not_a_label_case(fixtures: dict[str, Path]) -> None:
    cases = [case for case in _queue(fixtures) if case.kind == "exact_label_conflict"]
    assert len(cases) == 1
    paths = {image.relative_path for image in cases[0].images}
    assert paths == {"brown_spot/000.jpg", "Leaf Smut/000.jpg"}
    assert cases[0].priority == 1
    assert cases[0].images_per_class == {"brown_spot": 1, "leaf_smut": 1}


def test_small_groups_collapse_into_one_case_per_class_pair(fixtures: dict[str, Path]) -> None:
    cases = [
        case
        for case in _queue(fixtures)
        if case.kind == "near_duplicate_cross_class" and case.class_pair == ("brown_spot", "healthy_rice_leaf")
    ]
    assert len(cases) == 1, "two isolated pairs must become one reviewable case"
    assert cases[0].images_in_case == 4
    assert cases[0].priority == 2  # no strong evidence in the fixture
    assert "2 small look-alike groups" in cases[0].title


def test_large_family_is_its_own_case_and_capped(fixtures: dict[str, Path]) -> None:
    cases = _queue(fixtures, cap=2)
    big = [
        case
        for case in cases
        if case.kind == "near_duplicate_cross_class" and case.class_pair == ("dead_heart", "white_stem_borer")
    ]
    assert len(big) == 1
    assert big[0].images_in_case == 7 >= MIN_COMPONENT_IMAGES
    assert len(big[0].images) == 2, "cap must bound the thumbnails"
    assert big[0].truncated is True
    assert big[0].priority == 1


def test_misclassification_with_duplicate_evidence_ranks_first(fixtures: dict[str, Path]) -> None:
    cases = _queue(fixtures)
    evidence_case = next(c for c in cases if c.kind == "misclassified_with_duplicate_evidence")
    assert evidence_case.priority == 1
    assert evidence_case.class_pair == ("dead_heart", "white_stem_borer")
    assert evidence_case.images[0].predicted_class == "white_stem_borer"
    assert "white_stem_borer" in evidence_case.images[0].evidence

    confident_case = next(c for c in cases if c.kind == "confident_misclassification")
    assert confident_case.priority == 2
    assert confident_case.images[0].relative_path == "brown_spot/003.jpg"


def test_systematic_confusion_requires_at_least_three_errors(fixtures: dict[str, Path]) -> None:
    cases = _queue(fixtures)
    systematic = [case for case in cases if case.kind == "systematic_confusion"]
    assert len(systematic) == 1
    assert systematic[0].class_pair == ("healthy_rice_leaf", "leaf_smut")
    assert systematic[0].images_in_case == 4
    assert systematic[0].priority == 3


def test_queue_is_deterministic(fixtures: dict[str, Path]) -> None:
    first = [case.as_dict() for case in _queue(fixtures)]
    second = [case.as_dict() for case in _queue(fixtures)]
    assert first == second


def test_missing_split_manifest_still_builds(fixtures: dict[str, Path]) -> None:
    cases = build_review_queue(
        audit_review=fixtures["audit"],
        index=fixtures["index"],
        misclassified=fixtures["mis"],
        split_manifest=None,
    )
    assert cases
    assert all(image.split == "" for case in cases for image in case.images)


# ---------------------------------------------------------------------------
# Outputs
# ---------------------------------------------------------------------------


def test_outputs_are_written_and_dataset_is_untouched(fixtures: dict[str, Path], tmp_path: Path) -> None:
    dataset = fixtures["dataset"]
    before = _snapshot(dataset)
    out = tmp_path / "review"
    cases = _queue(fixtures)
    summary = build_review_outputs(cases, output_dir=out, dataset_root=dataset)

    assert _snapshot(dataset) == before, "reviewing must never modify source images"

    for name in ("review_cases.csv", "review_items.csv", "review_queue.json", "review_cases.md", "review.html"):
        assert (out / name).is_file(), name
        assert summary["files"][name].endswith(name)

    with (out / "review_cases.csv").open(encoding="utf-8-sig", newline="") as handle:
        case_rows = list(csv.DictReader(handle))
    assert len(case_rows) == len(cases)
    assert {"decision", "decision_note", "reviewer", "reviewed_at"} <= set(case_rows[0])
    assert all(row["decision"] == "" for row in case_rows)

    with (out / "review_items.csv").open(encoding="utf-8-sig", newline="") as handle:
        item_rows = list(csv.DictReader(handle))
    assert len(item_rows) == sum(len(case.images) for case in cases)
    assert {"decision", "corrected_class", "notes"} <= set(item_rows[0])

    payload = json.loads((out / "review_queue.json").read_text(encoding="utf-8"))
    assert payload["summary"]["cases"] == len(cases)
    assert payload["summary"]["images"] == sum(case.images_in_case for case in cases)


def test_html_is_self_contained_and_uses_relative_image_paths(
    fixtures: dict[str, Path], tmp_path: Path
) -> None:
    dataset = fixtures["dataset"]
    out = tmp_path / "review"
    build_review_outputs(_queue(fixtures), output_dir=out, dataset_root=dataset)
    html = (out / "review.html").read_text(encoding="utf-8")

    assert "application/json" in html, "queue must be inlined: fetch() is blocked on file:// pages"
    relative_root = Path(os.path.relpath(dataset, out)).as_posix()
    assert f'IMG_ROOT = "{relative_root}"' in html, "image root must be relative to the HTML file"
    assert "../../../dataset" not in html
    assert "localStorage" in html
    for control in ("Confirm all as labeled", "Save with corrections", "Defer", "Export decisions CSV"):
        assert control in html
    assert "file:///" not in html and "C:\\" not in html, "no absolute paths in a shareable report"


def test_summary_counts_match_cases(fixtures: dict[str, Path]) -> None:
    cases = _queue(fixtures)
    summary = summarise(cases)
    assert summary["cases"] == len(cases)
    assert sum(summary["by_kind"].values()) == len(cases)
    assert summary["images"] == sum(case.images_in_case for case in cases)
    assert "No label has been changed" in summary["note"]


# ---------------------------------------------------------------------------
# Applying decisions
# ---------------------------------------------------------------------------


def _decisions(path: Path, rows: list[dict[str, str]]) -> Path:
    fields = [
        "case_id",
        "priority",
        "kind",
        "relative_path",
        "class_id",
        "decision",
        "corrected_class",
        "reviewer",
        "reviewed_at",
        "notes",
    ]
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        for row in rows:
            writer.writerow({field: row.get(field, "") for field in fields})
    return path


def test_apply_decisions_writes_proposed_overrides_only(fixtures: dict[str, Path], tmp_path: Path) -> None:
    dataset = fixtures["dataset"]
    before = _snapshot(dataset)
    decisions = _decisions(
        tmp_path / "decisions.csv",
        [
            {"case_id": "RC0001", "relative_path": "brown_spot/000.jpg", "class_id": "brown_spot", "decision": "confirm", "reviewer": "r1"},
            {"case_id": "RC0002", "relative_path": "Leaf Smut/001.jpg", "class_id": "leaf_smut", "decision": "incorrect", "corrected_class": "brown_spot", "notes": "clearly brown spot"},
            {"case_id": "RC0003", "decision": "defer", "notes": "needs agronomist"},
        ],
    )
    out = tmp_path / "labels"
    summary = apply_decisions(decisions, output_dir=out, dataset_root=dataset)

    assert _snapshot(dataset) == before, "applying decisions must not touch the dataset"
    assert summary["corrections"] == 1
    assert summary["decisions"] == {"confirm": 1, "incorrect": 1, "defer": 1}
    assert summary["status"].startswith("proposed")
    assert summary["moves"] == [{"from": "leaf_smut", "to": "brown_spot", "images": 1}]

    with (out / "label_overrides_proposed.csv").open(encoding="utf-8-sig", newline="") as handle:
        rows = list(csv.DictReader(handle))
    assert [row["relative_path"] for row in rows] == ["Leaf Smut/001.jpg", "brown_spot/000.jpg"]
    corrected = {row["relative_path"]: row["corrected_class_id"] for row in rows}
    assert corrected["Leaf Smut/001.jpg"] == "brown_spot"


def test_apply_decisions_rejects_bad_rows_without_writing(fixtures: dict[str, Path], tmp_path: Path) -> None:
    dataset = fixtures["dataset"]
    out = tmp_path / "labels"
    cases = {
        "missing path": {"relative_path": "nope/x.jpg", "class_id": "brown_spot", "decision": "incorrect", "corrected_class": "leaf_smut"},
        "unknown class": {"relative_path": "brown_spot/000.jpg", "class_id": "brown_spot", "decision": "incorrect", "corrected_class": "not_a_class"},
        "confirm with correction": {"relative_path": "brown_spot/000.jpg", "class_id": "brown_spot", "decision": "confirm", "corrected_class": "leaf_smut"},
        "same class": {"relative_path": "brown_spot/000.jpg", "class_id": "brown_spot", "decision": "incorrect", "corrected_class": "brown_spot"},
        "unknown decision": {"relative_path": "brown_spot/000.jpg", "class_id": "brown_spot", "decision": "maybe"},
    }
    for label, row in cases.items():
        path = _decisions(tmp_path / f"{label.replace(' ', '_')}.csv", [row])
        with pytest.raises(ValueError):
            apply_decisions(path, output_dir=out, dataset_root=dataset)
        assert not (out / "label_overrides_proposed.csv").is_file(), label


def test_conflicting_decisions_for_one_image_are_rejected(fixtures: dict[str, Path], tmp_path: Path) -> None:
    path = _decisions(
        tmp_path / "conflict.csv",
        [
            {"relative_path": "brown_spot/000.jpg", "class_id": "brown_spot", "decision": "incorrect", "corrected_class": "leaf_smut"},
            {"relative_path": "brown_spot/000.jpg", "class_id": "brown_spot", "decision": "incorrect", "corrected_class": "healthy_rice_leaf"},
        ],
    )
    with pytest.raises(ValueError, match="conflicting decisions"):
        apply_decisions(path, output_dir=tmp_path / "labels", dataset_root=fixtures["dataset"])
