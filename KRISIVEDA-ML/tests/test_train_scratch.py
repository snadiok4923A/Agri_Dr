"""Focused checks for the from-scratch 15-class training script.

These pin the properties that make the script safe: it must never request
pretrained weights, every parameter must be trainable from initialization, it
must be impossible to write into the production or existing-experiment model
directories, and a capped run must be labelled as a smoke test.

No training happens here — the model is built once (random init, no download)
and the path guards are pure functions.
"""

from __future__ import annotations

import importlib.util
import subprocess
import sys
from pathlib import Path

import numpy as np
import pytest
from PIL import Image

from app.rice_disease_15class import taxonomy
from app.rice_disease_15class.preprocess import to_model_tensor

PROJECT_ROOT = Path(__file__).resolve().parents[1]
SCRIPT_PATH = PROJECT_ROOT / "scripts" / "train_rice_disease_scratch.py"


def _load_module():
    spec = importlib.util.spec_from_file_location("train_rice_disease_scratch", SCRIPT_PATH)
    assert spec and spec.loader, "from-scratch training script could not be imported"
    module = importlib.util.module_from_spec(spec)
    # ``@dataclass`` resolves annotations through ``sys.modules``, so the module
    # has to be registered before it is executed.
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


scratch = _load_module()


def _gradient(size: int = 400, mode: str = "RGB") -> Image.Image:
    """Non-square gradient photo stand-in (4:3-ish, no alpha)."""

    height, width = size, size + 80
    horizontal = np.linspace(10, 240, width, dtype=np.uint8)
    vertical = np.linspace(10, 240, height, dtype=np.uint8)
    array = np.zeros((height, width, 3), dtype=np.uint8)
    array[..., 0] = horizontal[None, :]
    array[..., 1] = vertical[:, None]
    array[..., 2] = 90
    return Image.fromarray(array, mode)


# --------------------------------------------------------------------------
# A. No pretrained weights, every parameter trainable
# --------------------------------------------------------------------------


def test_scratch_model_requests_no_pretrained_weights(monkeypatch):
    """``weights=None`` must reach torchvision — no ImageNet download, no cache."""

    import torch.nn as nn
    import torchvision.models as tv_models

    recorded: list[object] = []

    class _StubBackbone(nn.Module):
        def __init__(self) -> None:
            super().__init__()
            self.classifier = nn.Sequential(nn.Linear(8, 1000))

    def fake_mobilenet(weights=None, **kwargs):  # noqa: ANN001, ANN003
        recorded.append(weights)
        return _StubBackbone()

    monkeypatch.setattr(tv_models, "mobilenet_v3_small", fake_mobilenet)

    model = scratch.build_scratch_model()

    assert recorded == [None], f"expected weights=None (random init), got {recorded}"
    assert model.classifier[-1].out_features == taxonomy.NUM_CLASSES


def test_every_parameter_is_trainable_from_scratch():
    import torch

    model = scratch.build_scratch_model()
    total = sum(parameter.numel() for parameter in model.parameters())
    trainable = sum(parameter.numel() for parameter in model.parameters() if parameter.requires_grad)

    assert total == trainable, "some parameters are frozen; a from-scratch run must train everything"
    assert total > 1_000_000, "unexpectedly small model — is the backbone fully built?"
    assert not any(not parameter.requires_grad for parameter in model.parameters())
    assert model.classifier[-1].out_features == taxonomy.NUM_CLASSES
    assert isinstance(model.features[0][0].weight, torch.Tensor)


# --------------------------------------------------------------------------
# B. Output-path safety
# --------------------------------------------------------------------------


@pytest.mark.parametrize(
    "target",
    [
        PROJECT_ROOT / "models",
        PROJECT_ROOT / "models" / "rice_disease_15class",
        PROJECT_ROOT / "models" / "rice_disease_15class" / "rice-disease-15class-v2",
        PROJECT_ROOT / "models" / "rice_disease_15class" / "rice-disease-15class-v3-exp20",
        PROJECT_ROOT / "models" / "rice_disease_15class" / "some-new-experiment",
        PROJECT_ROOT / "models" / "rice_disease_model.onnx",
        PROJECT_ROOT / "models" / "class_names.json",
        PROJECT_ROOT / "data" / "rice_disease_15class",
        PROJECT_ROOT / "reports" / "rice_disease_15class" / "splits",
    ],
)
def test_output_dir_rejects_protected_locations(target):
    with pytest.raises(ValueError):
        scratch.resolve_output_dir(target, overwrite=True)


def test_output_dir_refuses_non_empty_target_without_overwrite(tmp_path):
    target = tmp_path / "rice_disease_scratch_v1"
    target.mkdir()
    (target / "best.pt").write_bytes(b"existing run")

    with pytest.raises(FileExistsError):
        scratch.resolve_output_dir(target)

    assert scratch.resolve_output_dir(target, overwrite=True) == target.resolve()


def test_output_dir_accepts_empty_or_new_target(tmp_path):
    empty = tmp_path / "empty"
    empty.mkdir()
    assert scratch.resolve_output_dir(empty) == empty.resolve()

    fresh = tmp_path / "nested" / "run"
    assert scratch.resolve_output_dir(fresh) == fresh.resolve()
    assert fresh.is_dir()


def test_default_output_dir_is_the_new_scratch_directory():
    expected = (PROJECT_ROOT / "models" / "rice_disease_scratch_v1").resolve()
    assert scratch.SCRATCH_MODEL_ROOT.resolve() == expected
    assert "rice_disease_15class" not in scratch.SCRATCH_MODEL_ROOT.parts


# --------------------------------------------------------------------------
# C. Smoke-test labelling and CLI surface
# --------------------------------------------------------------------------


def test_capped_runs_are_labelled_smoke_tests():
    config = scratch.ScratchConfig(
        train_manifest=PROJECT_ROOT / "reports" / "rice_disease_15class" / "splits" / "train.csv",
        val_manifest=PROJECT_ROOT / "reports" / "rice_disease_15class" / "splits" / "validation.csv",
    )
    assert config.smoke_test is False
    assert config.serialisable()["model_version"] == scratch.MODEL_VERSION
    assert scratch.MODEL_VERSION.startswith("rice-disease-scratch")

    capped = scratch.ScratchConfig(
        train_manifest=config.train_manifest,
        val_manifest=config.val_manifest,
        max_train_per_class=8,
    )
    assert capped.smoke_test is True


def test_smoke_flag_applies_default_caps():
    assert scratch.smoke_caps(None, None, False) == (None, None)
    assert scratch.smoke_caps(None, None, True) == (8, 8)
    assert scratch.smoke_caps(20, None, True) == (20, 8)


def test_parser_never_accepts_the_test_split():
    parser = scratch.build_parser()
    dests = {action.dest for action in parser._actions}
    assert "train_manifest" in dests and "val_manifest" in dests
    assert not any("test" in dest for dest in dests), f"test split must stay untouched: {sorted(dests)}"
    defaults = parser.parse_args([])
    assert defaults.val_manifest.name == "validation.csv"


def test_help_runs_and_exits_zero():
    completed = subprocess.run(
        [sys.executable, str(SCRIPT_PATH), "--help"],
        capture_output=True,
        text=True,
        timeout=120,
    )
    assert completed.returncode == 0, completed.stderr
    assert "from scratch" in completed.stdout.lower()
    assert "--batch-size" in completed.stdout


# --------------------------------------------------------------------------
# D. Validation transform still matches the serving contract
# --------------------------------------------------------------------------


def test_eval_transform_matches_shared_preprocessing_at_224():
    import torch

    image = _gradient()
    from_script = scratch.EvalTransform(224)(image)
    from_contract = torch.from_numpy(to_model_tensor(image))

    assert from_script.shape == (3, 224, 224)
    assert torch.equal(from_script, from_contract)


def test_eval_transform_supports_a_smaller_resolution():
    tensor = scratch.EvalTransform(192)(_gradient(size=300))
    assert tuple(tensor.shape) == (3, 192, 192)


def test_eval_transform_handles_rgba_without_a_fourth_channel():
    rgba = _gradient(mode="RGB").convert("RGBA")
    tensor = scratch.EvalTransform(224)(rgba)
    assert tuple(tensor.shape) == (3, 224, 224)
