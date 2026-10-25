"""Tests for the isolated 15-class rice disease & pest pipeline.

These tests never touch ``data/rice_disease_15class/``: they build a tiny
synthetic dataset in ``tmp_path``. Tests that need the exported ONNX model
skip when it has not been produced yet.
"""

from __future__ import annotations

import csv
import json
import random
from pathlib import Path

import numpy as np
import pytest
from PIL import Image, ImageDraw

from app import disease_service
from app.rice_disease_15class import taxonomy
from app.rice_disease_15class.audit import audit_dataset
from app.rice_disease_15class.config import MODEL_ROOT, V1_CLASS_PATH, V1_MODEL_PATH
from app.rice_disease_15class.splitting import (
    build_split,
    read_index,
    verify_splits,
    write_split_manifests,
)

CLASSES = ("brown_spot", "Leaf Blast", "Healthy")


def _image(seed: int, size: int = 96) -> Image.Image:
    """Large random shapes: distinct per seed, stable under JPEG recompression."""

    rng = random.Random(seed)
    image = Image.new(
        "RGB",
        (size, size),
        (rng.randint(0, 255), rng.randint(0, 255), rng.randint(0, 255)),
    )
    draw = ImageDraw.Draw(image)
    for _ in range(6):
        left = rng.randint(-size // 3, size)
        top = rng.randint(-size // 3, size)
        right = left + rng.randint(size // 4, size)
        bottom = top + rng.randint(size // 4, size)
        draw.ellipse(
            [left, top, right, bottom],
            fill=(rng.randint(0, 255), rng.randint(0, 255), rng.randint(0, 255)),
        )
    return image


@pytest.fixture()
def mini_dataset(tmp_path: Path) -> Path:
    root = tmp_path / "rice_disease_15class"
    for class_index, folder in enumerate(CLASSES):
        folder_path = root / folder
        folder_path.mkdir(parents=True)
        for index in range(12):
            _image(seed=class_index * 100 + index).save(folder_path / f"{index:03d}.jpg", quality=90)

    # Recompressed copy inside the same class -> near duplicate, same cluster.
    _image(seed=0, size=96).save(root / "brown_spot" / "recompressed.jpg", quality=55)
    # Recompressed copy (different bytes, same picture) in another class ->
    # look-alike; must be reported but NOT merged into the same cluster.
    _image(seed=0, size=96).save(root / "Leaf Blast" / "look_alike.jpg", quality=60)
    # Broken + unsupported files.
    (root / "brown_spot" / "broken.jpg").write_bytes(b"\xff\xd8\xff\xe0not-an-image")
    (root / "brown_spot" / "notes.ini").write_text("metadata", encoding="utf-8")
    (root / "empty_class").mkdir()
    return root


def _snapshot(root: Path) -> dict[str, tuple[int, int]]:
    return {
        path.relative_to(root).as_posix(): (path.stat().st_size, path.stat().st_mtime_ns)
        for path in sorted(root.rglob("*"))
        if path.is_file()
    }


def test_taxonomy_has_15_unique_stable_ids() -> None:
    assert taxonomy.NUM_CLASSES == 15
    assert len(set(taxonomy.CLASS_IDS)) == 15
    assert taxonomy.CLASS_IDS[7] == "healthy_rice_leaf"


def test_folder_resolution_handles_spaces_and_case() -> None:
    assert taxonomy.resolve_folder("Leaf Blast").class_id == "leaf_blast"
    assert taxonomy.resolve_folder("Healthy").class_id == "healthy_rice_leaf"
    assert taxonomy.resolve_folder("leaf_roller").class_id == "leaf_roller"
    assert taxonomy.resolve_folder("not_a_class") is None


def test_ambiguous_folders_raise_instead_of_merging() -> None:
    with pytest.raises(taxonomy.TaxonomyError):
        taxonomy.build_folder_mapping(["Healthy", "healthy_rice_leaf"])


def test_audit_reports_counts_and_never_mutates(mini_dataset: Path, tmp_path: Path) -> None:
    before = _snapshot(mini_dataset)
    report = audit_dataset(mini_dataset, tmp_path / "reports", workers=1)
    assert _snapshot(mini_dataset) == before

    totals = report["totals"]
    assert totals["files"] == 12 * 3 + 2 + 2
    assert totals["unreadable_files"] == 1
    assert totals["unsupported_files"] == 1
    assert totals["empty_class_folders"] == ["empty_class"]

    counts = {row["class_id"]: row["readable_count"] for row in report["classes"]}
    assert counts["brown_spot"] == 13
    assert counts["leaf_blast"] == 13
    assert counts["healthy_rice_leaf"] == 12

    for name in ("dataset_audit.json", "dataset_audit_review.csv", "dataset_index.csv", "class_mapping.json"):
        assert (tmp_path / "reports" / name).is_file(), name


def test_duplicate_clustering_is_class_aware(mini_dataset: Path, tmp_path: Path) -> None:
    audit_dataset(mini_dataset, tmp_path / "reports", workers=1)
    records = read_index(tmp_path / "reports" / "dataset_index.csv")
    by_path = {record.relative_path: record for record in records}

    same_class = by_path["brown_spot/recompressed.jpg"]
    twin = by_path["brown_spot/000.jpg"]
    assert same_class.cluster_id == twin.cluster_id

    look_alike = by_path["Leaf Blast/look_alike.jpg"]
    assert look_alike.cluster_id != twin.cluster_id, "near duplicates must not merge across classes"

    with (tmp_path / "reports" / "dataset_audit.json").open(encoding="utf-8") as handle:
        report = json.load(handle)
    assert report["duplicates"]["cross_class_near_duplicate_pairs"] >= 1


def test_split_is_reproducible_and_leak_free(mini_dataset: Path, tmp_path: Path) -> None:
    audit_dataset(mini_dataset, tmp_path / "reports", workers=1)
    records = read_index(tmp_path / "reports" / "dataset_index.csv")

    first = build_split(records, seed=42)
    second = build_split(records, seed=42)
    assert first.assignments == second.assignments

    write_split_manifests(records, first, tmp_path / "splits")
    verification = verify_splits(tmp_path / "splits")
    assert verification["valid"], verification["errors"]

    clusters_by_split: dict[str, set[str]] = {}
    with (tmp_path / "splits" / "split_manifest.csv").open(encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            clusters_by_split.setdefault(row["split"], set()).add(row["cluster_id"])
    for left in clusters_by_split:
        for right in clusters_by_split:
            if left >= right:
                continue
            assert not (clusters_by_split[left] & clusters_by_split[right])


def test_split_reports_class_that_cannot_be_split(tmp_path: Path) -> None:
    from app.rice_disease_15class.splitting import IndexRecord

    records = [
        IndexRecord(f"brown_spot/{index}.jpg", "brown_spot", "brown_spot", "c00001")
        for index in range(10)
    ]
    result = build_split(records, seed=1)
    assert "brown_spot" in result.summary["insufficient_cluster_classes"]
    assert result.assignments["brown_spot/0.jpg"] == "train"
    assert any("fewer than three duplicate clusters" in item for item in result.summary["limitations"])


def test_confidence_gate_reports_coverage_and_selective_accuracy() -> None:
    from app.rice_disease_15class.evaluate import _selective_metrics

    y_true = np.array([0, 1, 2, 3])
    y_pred = np.array([0, 1, 2, 0])
    confidences = np.array([0.9, 0.65, 0.55, 0.99])
    gate = _selective_metrics(y_true, y_pred, confidences)

    by_threshold = {row["threshold"]: row for row in gate["thresholds"]}
    assert by_threshold[0.5]["accepted"] == 4
    assert by_threshold[0.5]["accuracy_on_accepted"] == 0.75
    assert by_threshold[gate["threshold_used_by_inference"]]["accepted"] == 3
    # 0.90 correct, 0.65 correct, 0.99 wrong; 0.55 is refused by the gate.
    assert by_threshold[gate["threshold_used_by_inference"]]["accuracy_on_accepted"] == pytest.approx(2 / 3, abs=1e-4)

    per_class = {row["class_id"]: row for row in gate["per_class_at_threshold"]}
    assert sum(row["accepted"] for row in gate["per_class_at_threshold"]) == 3
    # Index 2 is below the gate, so its only image is refused.
    assert per_class["bacterial_panicle_blight"]["coverage"] == 0.0
    assert per_class["bacterial_panicle_blight"]["accuracy_on_accepted"] is None
    # Index 3 is accepted but wrong.
    assert per_class["bacterial_stripe_disease"]["accuracy_on_accepted"] == 0.0


def test_eval_preprocessing_is_deterministic_and_shared() -> None:
    from app.rice_disease_15class import inference
    from app.rice_disease_15class.preprocess import batch, to_model_tensor

    image = _image(seed=5, size=320)
    first = to_model_tensor(image)
    second = to_model_tensor(image)
    assert first.shape == (3, 224, 224)
    assert first.dtype == np.float32
    assert np.array_equal(first, second)
    assert np.array_equal(inference.preprocess_image(image), batch(first))


# ---------------------------------------------------------------------------
# Production preservation
# ---------------------------------------------------------------------------


def test_v1_production_artifacts_are_untouched() -> None:
    assert V1_MODEL_PATH.is_file(), "production 6-class ONNX model is missing"
    assert V1_CLASS_PATH.is_file(), "production class mapping is missing"
    class_names = json.loads(V1_CLASS_PATH.read_text(encoding="utf-8"))
    assert class_names == [
        "bacterial_leaf_blight",
        "brown_spot",
        "healthy_rice_leaf",
        "leaf_blast",
        "leaf_scald",
        "sheath_blight",
    ]
    session, v1_classes = disease_service._load_model()
    assert v1_classes == class_names
    assert session.get_outputs()[0].shape[-1] == 6


# ---------------------------------------------------------------------------
# ONNX smoke tests (require the exported 15-class artifact)
# ---------------------------------------------------------------------------

V2_ONNX = MODEL_ROOT / "rice_disease_15class.onnx"
V2_METADATA = MODEL_ROOT / "model_metadata.json"

pytestmark_onnx = pytest.mark.skipif(
    not (V2_ONNX.is_file() and V2_METADATA.is_file()),
    reason="15-class ONNX artifact not exported yet",
)


@pytestmark_onnx
def test_v2_onnx_output_dimensions_and_class_order() -> None:
    import onnxruntime as ort

    metadata = json.loads(V2_METADATA.read_text(encoding="utf-8"))
    assert metadata["class_order"] == list(taxonomy.CLASS_IDS)
    session = ort.InferenceSession(str(V2_ONNX), providers=["CPUExecutionProvider"])
    assert session.get_inputs()[0].name == "images"
    assert session.get_outputs()[0].name == "logits"
    output = session.run(
        ["logits"],
        {"images": np.zeros((1, 3, 224, 224), dtype=np.float32)},
    )[0]
    assert output.shape == (1, 15)


@pytestmark_onnx
def test_v2_inference_accepts_valid_image_and_rejects_invalid() -> None:
    from io import BytesIO

    from app.rice_disease_15class import inference

    inference._cache.clear()
    image = _image(seed=7, size=320)
    buffer = BytesIO()
    image.save(buffer, format="JPEG")

    result = inference.analyze_image(buffer.getvalue())
    assert result["status"] in {"ok", "uncertain"}
    assert 0.0 <= result["confidence"] <= 1.0
    assert len(result["top_predictions"]) == 3
    assert all(item["class_id"] in taxonomy.CLASS_IDS for item in result["top_predictions"])

    with pytest.raises(ValueError):
        inference.analyze_image(b"not an image")
    with pytest.raises(ValueError):
        inference.analyze_image(b"")


@pytestmark_onnx
def test_v2_inference_is_not_served_by_the_production_api() -> None:
    from app.main import app

    routes = {route.path for route in app.routes}
    assert "/disease/predict" in routes
    source = (Path(__file__).resolve().parents[1] / "app" / "main.py").read_text(encoding="utf-8")
    assert "rice_disease_15class" not in source
