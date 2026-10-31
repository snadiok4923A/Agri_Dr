"""Tests for the read-only v2 vs Experiment A comparison script.

The script must load each model from its own directory together with the
metadata beside it. These tests pin that down, and skip the ONNX-runtime
tests when the exported artifacts are not present.
"""

from __future__ import annotations

import importlib.util
import json
import sys
from io import BytesIO
from pathlib import Path

import numpy as np
import pytest
from PIL import Image

from app.rice_disease_15class import inference

SCRIPT_PATH = Path(__file__).resolve().parents[1] / "scripts" / "compare_rice_disease_versions.py"


def _load_module():
    spec = importlib.util.spec_from_file_location("compare_rice_disease_versions", SCRIPT_PATH)
    assert spec and spec.loader, "comparison script could not be imported"
    module = importlib.util.module_from_spec(spec)
    # ``@dataclass`` resolves annotations through ``sys.modules``, so the module
    # has to be registered before it is executed.
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


compare = _load_module()

HAS_MODELS = (
    (compare.MODEL_ROOT / "rice_disease_15class.onnx").is_file()
    and (compare.MODEL_ROOT / "model_metadata.json").is_file()
    and (compare.CANDIDATE_ROOT / "rice_disease_15class.onnx").is_file()
    and (compare.CANDIDATE_ROOT / "model_metadata.json").is_file()
)
requires_models = pytest.mark.skipif(not HAS_MODELS, reason="15-class ONNX artifacts not exported")


def _gradient(mode: str = "RGB", size: int = 128) -> Image.Image:
    array = np.zeros((size, size, 4), dtype=np.uint8)
    ramp = np.linspace(20, 230, size, dtype=np.uint8)
    array[..., 0] = ramp[None, :]
    array[..., 1] = ramp[:, None]
    array[..., 2] = 120
    array[..., 3] = 200
    return Image.fromarray(array, "RGBA").convert(mode)


def _png_bytes(image: Image.Image) -> bytes:
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


# --- artifact resolution (no ONNX runtime needed) --------------------------


def test_resolve_artifacts_pairs_model_with_metadata_in_the_same_directory(tmp_path: Path) -> None:
    directory = tmp_path / "some-version"
    directory.mkdir()
    (directory / "rice_disease_15class.onnx").write_bytes(b"not really onnx")
    (directory / "model_metadata.json").write_text(json.dumps({"class_order": []}), encoding="utf-8")

    artifacts = compare.resolve_artifacts("A", directory)

    assert artifacts.onnx_path.parent == directory
    assert artifacts.metadata_path.parent == directory
    assert artifacts.onnx_path.name == "rice_disease_15class.onnx"


def test_resolve_artifacts_requires_a_model_file(tmp_path: Path) -> None:
    directory = tmp_path / "empty"
    directory.mkdir()
    (directory / "model_metadata.json").write_text("{}", encoding="utf-8")

    with pytest.raises(compare.ComparisonError, match="no .onnx"):
        compare.resolve_artifacts("v2", directory)


def test_resolve_artifacts_rejects_ambiguous_model_files(tmp_path: Path) -> None:
    directory = tmp_path / "two-models"
    directory.mkdir()
    (directory / "a.onnx").write_bytes(b"x")
    (directory / "b.onnx").write_bytes(b"x")
    (directory / "model_metadata.json").write_text("{}", encoding="utf-8")

    with pytest.raises(compare.ComparisonError, match="exactly one"):
        compare.resolve_artifacts("v2", directory)


def test_resolve_artifacts_requires_metadata_beside_the_model(tmp_path: Path) -> None:
    directory = tmp_path / "no-metadata"
    directory.mkdir()
    (directory / "rice_disease_15class.onnx").write_bytes(b"x")

    with pytest.raises(compare.ComparisonError, match="metadata not found"):
        compare.resolve_artifacts("A", directory)


def test_missing_directory_is_reported_clearly(tmp_path: Path) -> None:
    with pytest.raises(compare.ComparisonError, match="model directory not found"):
        compare.resolve_artifacts("A", tmp_path / "does-not-exist")


# --- image handling (no ONNX runtime needed) -------------------------------


@pytest.mark.parametrize("mode", ["RGB", "RGBA", "L", "P"])
def test_prepare_tensor_accepts_every_common_mode(mode: str, tmp_path: Path) -> None:
    path = tmp_path / f"image_{mode}.png"
    path.write_bytes(_png_bytes(_gradient(mode)))

    tensor = compare.prepare_tensor(path)

    assert tensor.shape == (1, 3, 224, 224)
    assert tensor.dtype == np.float32
    assert np.isfinite(tensor).all()


@pytest.mark.parametrize("raw", [b"", b"not an image", b"\xff\xd8\xff\xe0garbage"])
def test_prepare_tensor_rejects_invalid_images(raw: bytes, tmp_path: Path) -> None:
    path = tmp_path / "broken.jpg"
    path.write_bytes(raw)

    with pytest.raises(ValueError):
        compare.prepare_tensor(path)


def test_prepare_tensor_rejects_missing_files(tmp_path: Path) -> None:
    with pytest.raises(ValueError, match="file not found"):
        compare.prepare_tensor(tmp_path / "absent.jpg")


# --- both models load from their own paths ---------------------------------


@requires_models
def test_load_runners_uses_two_separate_model_directories() -> None:
    inference._cache.clear()  # noqa: SLF001 - guard against the default-path loader

    baseline, candidate = compare.load_runners()

    assert baseline.artifacts.onnx_path != candidate.artifacts.onnx_path
    assert baseline.artifacts.onnx_path.parent == compare.MODEL_ROOT
    assert candidate.artifacts.onnx_path.parent == compare.CANDIDATE_ROOT
    assert baseline.version == "rice-disease-15class-v2"
    assert candidate.version == "rice-disease-15class-v3-exp20"
    assert baseline.version != candidate.version
    # The default inference paths must never be consulted by the comparison.
    assert inference._cache == {}  # noqa: SLF001


@requires_models
def test_both_models_predict_on_the_same_tensor(tmp_path: Path) -> None:
    path = tmp_path / "sample.png"
    path.write_bytes(_png_bytes(_gradient("RGBA")))
    tensor = compare.prepare_tensor(path)

    baseline, candidate = compare.load_runners()
    results = [runner.predict(tensor, top_k=3) for runner in (baseline, candidate)]

    for result in results:
        assert result["status"] in {"ok", "uncertain"}
        assert 0.0 <= result["confidence"] <= 1.0
        assert len(result["top_predictions"]) == 3
        confidences = [prediction["confidence"] for prediction in result["top_predictions"]]
        assert confidences == sorted(confidences, reverse=True)


@requires_models
def test_comparison_reports_both_versions_and_exits_zero(tmp_path: Path, capsys) -> None:
    path = tmp_path / "sample.png"
    path.write_bytes(_png_bytes(_gradient("RGB")))

    exit_code = compare.main([str(path)])
    output = capsys.readouterr().out

    assert exit_code == 0
    assert "rice-disease-15class-v2" in output
    assert "rice-disease-15class-v3-exp20" in output
    assert "threshold 0.60" in output
    assert "images compared : 1" in output


@requires_models
def test_unreadable_image_is_reported_without_crashing(tmp_path: Path, capsys) -> None:
    broken = tmp_path / "broken.jpg"
    broken.write_bytes(b"\xff\xd8\xff\xe0garbage")

    exit_code = compare.main([str(broken)])
    output = capsys.readouterr().out

    assert exit_code == 1
    assert "ERROR" in output
    assert "unreadable      : 1" in output
