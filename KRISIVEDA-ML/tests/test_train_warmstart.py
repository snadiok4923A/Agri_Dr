"""Focused checks for the warm-start mode of the from-scratch trainer.

These pin the properties that make ``--init-from`` safe: an incompatible
checkpoint is rejected instead of silently mis-loaded, the new run starts at the
checkpoint's next epoch, the source run can never be the output directory, and
checkpoints carry the full training state (weights + optimizer + scheduler) so a
future *exact* resume is possible.

No training happens here: the checkpoint fixtures are tiny hand-written
checkpoints and the only model built is the real MobileNetV3-Small (random
init, no download, no checkpoint).
"""

from __future__ import annotations

import hashlib
import importlib.util
import subprocess
import sys
from pathlib import Path

import pytest
import torch

from app.rice_disease_15class import taxonomy

PROJECT_ROOT = Path(__file__).resolve().parents[1]
SCRIPT_PATH = PROJECT_ROOT / "scripts" / "train_rice_disease_scratch.py"


def _load_module():
    spec = importlib.util.spec_from_file_location("train_rice_disease_scratch_warm", SCRIPT_PATH)
    assert spec and spec.loader, "from-scratch training script could not be imported"
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


scratch = _load_module()

HISTORY = [
    {
        "epoch": epoch,
        "phase": "from_scratch",
        "learning_rate": 1e-3,
        "train_loss": 2.0 - 0.2 * epoch,
        "val_loss": 1.8 - 0.3 * epoch,
        "val_accuracy": 0.4 + 0.1 * epoch,
        "val_macro_f1": 0.30 + 0.12 * epoch,
        "val_per_class_f1": {class_id: 0.3 for class_id in taxonomy.CLASS_IDS},
        "seconds": 90.0,
    }
    for epoch in (1, 2, 3)
]


def _checkpoint(tmp_path: Path, name: str = "source/last.pt", **overrides) -> Path:
    """Write a minimal, structurally valid from-scratch checkpoint."""

    payload = {
        "model_state": {
            "classifier.3.weight": torch.zeros(taxonomy.NUM_CLASSES, 576),
            "classifier.3.bias": torch.zeros(taxonomy.NUM_CLASSES),
        },
        "optimizer_state": {},
        "scheduler_state": {},
        "class_ids": list(taxonomy.CLASS_IDS),
        "architecture": "mobilenet_v3_small",
        "training_mode": "from_scratch",
        "pretrained": False,
        "image_size": 224,
        "model_version": "rice-disease-scratch-v1",
        "epoch": 3,
        "val_macro_f1": 0.54568,
        "smoke_test": False,
        "history": [dict(entry) for entry in HISTORY],
        "config": {"epochs": 40, "learning_rate": 1e-3},
    }
    payload.update(overrides)
    path = tmp_path / name
    path.parent.mkdir(parents=True, exist_ok=True)
    torch.save(payload, path)
    return path


def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


# --------------------------------------------------------------------------
# A. Loading the source checkpoint
# --------------------------------------------------------------------------


def test_load_reads_a_scratch_checkpoint(tmp_path):
    path = _checkpoint(tmp_path)
    digest_before = _sha256(path)

    state = scratch.load_init_checkpoint(path)

    assert state.epoch == 3
    assert state.val_macro_f1 == pytest.approx(0.54568)
    assert state.training_mode == "from_scratch"
    assert state.image_size == 224
    assert state.class_ids == list(taxonomy.CLASS_IDS)
    assert state.architecture == "mobilenet_v3_small"
    assert state.history == HISTORY, "previous history must be carried over unchanged"
    assert len(state.sha256) == 64
    assert _sha256(path) == digest_before


def test_load_does_not_touch_the_source_file(tmp_path):
    path = _checkpoint(tmp_path)
    mtime_before = path.stat().st_mtime_ns
    bytes_before = path.read_bytes()

    scratch.load_init_checkpoint(path)

    assert path.stat().st_mtime_ns == mtime_before
    assert path.read_bytes() == bytes_before


def test_missing_checkpoint_is_a_clear_error(tmp_path):
    with pytest.raises(ValueError, match="not found"):
        scratch.load_init_checkpoint(tmp_path / "nope.pt")


@pytest.mark.parametrize(
    ("overrides", "message"),
    [
        ({"architecture": "resnet18"}, "architecture"),
        ({"class_ids": list(reversed(taxonomy.CLASS_IDS))}, "class order"),
        ({"class_ids": list(taxonomy.CLASS_IDS)[:14]}, "class order"),
        ({"image_size": 192}, "image_size"),
        ({"training_mode": "transfer_learning"}, "training_mode"),
        ({"pretrained": True}, "pretrained"),
        ({"epoch": 0}, "epoch"),
        ({"epoch": "three"}, "epoch"),
    ],
)
def test_incompatible_metadata_is_rejected(tmp_path, overrides, message):
    path = _checkpoint(tmp_path, **overrides)

    with pytest.raises(ValueError, match=message):
        scratch.load_init_checkpoint(path)


@pytest.mark.parametrize("key", ["model_state", "epoch", "class_ids", "training_mode", "image_size"])
def test_missing_required_entries_are_rejected(tmp_path, key):
    path = _checkpoint(tmp_path)
    payload = torch.load(path, map_location="cpu", weights_only=True)
    payload.pop(key)
    torch.save(payload, path)

    with pytest.raises(ValueError, match=key):
        scratch.load_init_checkpoint(path)


def test_checkpoint_without_weights_is_rejected(tmp_path):
    path = _checkpoint(tmp_path, model_state={})

    with pytest.raises(ValueError, match="no model weights"):
        scratch.load_init_checkpoint(path)


def test_unreadable_file_is_reported_not_crashed(tmp_path):
    path = tmp_path / "broken.pt"
    path.write_bytes(b"not a torch checkpoint")

    with pytest.raises(ValueError, match="Could not read checkpoint"):
        scratch.load_init_checkpoint(path)


def test_a_warm_start_checkpoint_may_be_continued_again(tmp_path):
    path = _checkpoint(tmp_path, training_mode="warm_start")

    assert scratch.load_init_checkpoint(path).training_mode == "warm_start"


# --------------------------------------------------------------------------
# B. Weights actually load, and mismatches are named
# --------------------------------------------------------------------------


def test_weights_from_the_checkpoint_are_loaded_exactly():
    model = scratch.build_scratch_model()
    saved = {key: value.clone() for key, value in model.state_dict().items()}
    with torch.no_grad():
        for parameter in model.parameters():
            parameter.zero_()
    assert torch.count_nonzero(model.classifier[3].weight) == 0

    scratch.verify_state_dict_compatible(model, saved)
    model.load_state_dict(saved, strict=True)

    for key, value in model.state_dict().items():
        assert torch.equal(value, saved[key]), f"{key} was not restored"


def test_state_dict_shape_mismatch_names_the_tensor():
    model = scratch.build_scratch_model()
    bad = dict(model.state_dict())
    bad["classifier.3.weight"] = torch.zeros(taxonomy.NUM_CLASSES, 10)

    with pytest.raises(ValueError, match="classifier.3.weight"):
        scratch.verify_state_dict_compatible(model, bad)


def test_state_dict_key_mismatch_is_reported():
    model = scratch.build_scratch_model()
    bad = dict(model.state_dict())
    bad.pop("features.0.0.weight")

    with pytest.raises(ValueError, match="missing from checkpoint"):
        scratch.verify_state_dict_compatible(model, bad)


# --------------------------------------------------------------------------
# C. Epoch numbering continues, never restarts
# --------------------------------------------------------------------------


def test_start_epoch_follows_the_checkpoint():
    assert scratch.resolve_start_epoch(3) == 4
    assert scratch.resolve_start_epoch(1) == 2
    assert scratch.resolve_start_epoch(3, override=10) == 10


def test_start_epoch_cannot_repeat_trained_epochs():
    with pytest.raises(ValueError, match="already completed"):
        scratch.resolve_start_epoch(3, override=3)
    with pytest.raises(ValueError, match="already completed"):
        scratch.resolve_start_epoch(3, override=1)


def test_epoch_schedule_is_continuous_and_counts_new_epochs_only():
    assert scratch.epoch_schedule(4, 3) == [4, 5, 6]
    assert scratch.epoch_schedule(4, 1) == [4]
    assert 1 not in scratch.epoch_schedule(4, 10)
    with pytest.raises(ValueError):
        scratch.epoch_schedule(4, 0)


# --------------------------------------------------------------------------
# D. Warm-start defaults and output-directory safety
# --------------------------------------------------------------------------


def test_warm_start_defaults_are_conservative():
    assert scratch.WARMSTART_LR == pytest.approx(3e-4)
    assert scratch.WARMSTART_LR < scratch.SCRATCH_LR
    assert scratch.resolve_learning_rate(None, warm_start=True) == pytest.approx(3e-4)
    assert scratch.resolve_learning_rate(None, warm_start=False) == pytest.approx(1e-3)
    assert scratch.resolve_learning_rate(5e-4, warm_start=True) == pytest.approx(5e-4)


def test_warm_start_default_output_directory_is_separate():
    assert scratch.WARMSTART_MODEL_ROOT.name == "rice_disease_warmstart_v1"
    assert scratch.WARMSTART_MODEL_ROOT != scratch.SCRATCH_MODEL_ROOT
    assert "rice_disease_15class" not in scratch.WARMSTART_MODEL_ROOT.parts
    assert scratch.resolve_model_version(None, warm_start=True) == "rice-disease-warmstart-v1"
    assert scratch.resolve_model_version(None, warm_start=False) == scratch.MODEL_VERSION


def test_output_dir_cannot_be_the_source_directory(tmp_path):
    source = _checkpoint(tmp_path)
    before = source.read_bytes()

    with pytest.raises(ValueError, match="Refusing to warm-start into the directory"):
        scratch.resolve_output_dir_for_run(source.parent, source_checkpoint=source)
    with pytest.raises(ValueError, match="Refusing to warm-start into the directory"):
        scratch.resolve_output_dir_for_run(source.parent.parent, source_checkpoint=source)

    assert source.read_bytes() == before
    assert sorted(path.name for path in source.parent.iterdir()) == ["last.pt"]


def test_warm_start_refuses_the_protected_model_locations(tmp_path):
    source = _checkpoint(tmp_path)
    for target in (
        PROJECT_ROOT / "models",
        PROJECT_ROOT / "models" / "rice_disease_15class" / "rice-disease-15class-v2",
        PROJECT_ROOT / "models" / "class_names.json",
    ):
        with pytest.raises(ValueError):
            scratch.resolve_output_dir_for_run(target, source_checkpoint=source, overwrite=True)


def test_warm_start_output_dir_still_needs_overwrite_when_populated(tmp_path):
    source = _checkpoint(tmp_path)
    target = tmp_path / "rice_disease_warmstart_v1"
    target.mkdir()
    (target / "best.pt").write_bytes(b"older run")

    with pytest.raises(FileExistsError):
        scratch.resolve_output_dir_for_run(target, source_checkpoint=source)
    assert scratch.resolve_output_dir_for_run(target, source_checkpoint=source, overwrite=True) == target.resolve()


def test_warm_start_output_dir_is_accepted_when_new(tmp_path):
    source = _checkpoint(tmp_path)
    target = tmp_path / "models" / "rice_disease_warmstart_v1"

    assert scratch.resolve_output_dir_for_run(target, source_checkpoint=source) == target.resolve()
    assert target.is_dir()


# --------------------------------------------------------------------------
# E. Checkpoint payload: full state, separated history, honest labels
# --------------------------------------------------------------------------


def _toy_state():
    """A real optimizer/scheduler state from a one-layer model."""

    model = torch.nn.Linear(4, taxonomy.NUM_CLASSES)
    optimizer = torch.optim.AdamW(model.parameters(), lr=3e-4)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=5)
    for _ in range(2):
        optimizer.zero_grad()
        model(torch.ones(3, 4)).sum().backward()
        optimizer.step()
        scheduler.step()
    return {
        "model_state": model.state_dict(),
        "optimizer_state": optimizer.state_dict(),
        "scheduler_state": scheduler.state_dict(),
    }


def _config(**overrides):
    base = {
        "train_manifest": PROJECT_ROOT / "reports" / "rice_disease_15class" / "splits" / "train.csv",
        "val_manifest": PROJECT_ROOT / "reports" / "rice_disease_15class" / "splits" / "validation.csv",
        "epochs": 10,
        "learning_rate": 3e-4,
        "model_version": "rice-disease-warmstart-v1",
    }
    base.update(overrides)
    return scratch.ScratchConfig(**base)


def _warm_payload(tmp_path):
    source = _checkpoint(tmp_path)
    init_state = scratch.load_init_checkpoint(source)
    new_history = [
        {"epoch": 4, "phase": "warm_start", "learning_rate": 3e-4, "val_macro_f1": 0.55},
        {"epoch": 5, "phase": "warm_start", "learning_rate": 2.9e-4, "val_macro_f1": 0.58},
    ]
    payload = scratch.build_checkpoint_payload(
        **_toy_state(),
        epoch=5,
        val_macro_f1=0.58,
        best_val_macro_f1=0.58,
        best_epoch=5,
        best_source="warm_start",
        config=_config(init_from=source),
        history=new_history,
        previous_history=init_state.history,
        init_state=init_state,
    )
    return payload, init_state, source


def test_payload_carries_full_training_state(tmp_path):
    payload, _init, _source = _warm_payload(tmp_path)

    for key in (
        "model_state",
        "optimizer_state",
        "scheduler_state",
        "epoch",
        "best_epoch",
        "best_val_macro_f1",
        "val_macro_f1",
        "config",
        "history",
        "previous_history",
        "warm_start",
        "training_mode",
        "class_ids",
        "image_size",
        "model_version",
    ):
        assert key in payload, f"checkpoint is missing {key}"

    assert payload["format_version"] == scratch.CHECKPOINT_FORMAT_VERSION
    assert payload["resume_ready"] is True
    assert payload["optimizer_state"], "optimizer state must be present for a future exact resume"
    assert payload["scheduler_state"], "scheduler state must be present for a future exact resume"


def test_payload_round_trips_and_optimizer_state_is_loadable(tmp_path):
    payload, _init, _source = _warm_payload(tmp_path)
    path = tmp_path / "checkpoint.pt"
    torch.save(payload, path)

    restored = torch.load(path, map_location="cpu", weights_only=True)
    model = torch.nn.Linear(4, taxonomy.NUM_CLASSES)
    optimizer = torch.optim.AdamW(model.parameters(), lr=3e-4)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=5)

    model.load_state_dict(restored["model_state"], strict=True)
    optimizer.load_state_dict(restored["optimizer_state"])
    scheduler.load_state_dict(restored["scheduler_state"])

    assert optimizer.param_groups[0]["lr"] == pytest.approx(restored["optimizer_state"]["param_groups"][0]["lr"])
    assert restored["scheduler_state"]["last_epoch"] >= 1


def test_payload_is_labelled_warm_start_not_from_scratch(tmp_path):
    payload, init_state, source = _warm_payload(tmp_path)

    assert payload["training_mode"] == "warm_start"
    assert payload["pretrained"] is False
    assert payload["warm_start"]["init_from"] == str(source)
    assert payload["warm_start"]["source_epoch"] == 3
    assert payload["warm_start"]["source_sha256"] == init_state.sha256
    assert payload["warm_start"]["optimizer_reset"] is True
    assert payload["warm_start"]["scheduler_reset"] is True
    assert payload["warm_start"]["exact_resume"] is False
    assert payload["warm_start"]["started_at_epoch"] == 4


def test_previous_history_is_preserved_separately_from_new_epochs(tmp_path):
    payload, _init, _source = _warm_payload(tmp_path)

    assert [entry["epoch"] for entry in payload["previous_history"]] == [1, 2, 3]
    assert [entry["epoch"] for entry in payload["history"]] == [4, 5]
    assert all(entry["phase"] == "warm_start" for entry in payload["history"])
    assert payload["previous_run"]["source_epoch"] == 3
    assert payload["previous_run"]["epochs_preserved"] == 3
    # The old and new epochs are never mixed in one list.
    assert not set(entry["epoch"] for entry in payload["history"]) & {1, 2, 3}


def test_scratch_payload_has_no_warm_start_block(tmp_path):
    payload = scratch.build_checkpoint_payload(
        **_toy_state(),
        epoch=1,
        val_macro_f1=0.4,
        best_val_macro_f1=0.4,
        best_epoch=1,
        best_source="scratch",
        config=_config(epochs=3, model_version="rice-disease-scratch-v1"),
        history=[{"epoch": 1, "phase": "from_scratch", "val_macro_f1": 0.4}],
    )

    assert payload["training_mode"] == "from_scratch"
    assert payload["warm_start"] is None
    assert payload["previous_run"] is None
    assert payload["previous_history"] == []


# --------------------------------------------------------------------------
# F. CLI surface
# --------------------------------------------------------------------------


def test_parser_exposes_warm_start_flags():
    args = scratch.build_parser().parse_args([])
    assert args.init_from is None
    assert args.init_start_epoch is None
    assert args.output_dir is None, "the default depends on --init-from and is resolved at run time"
    assert args.lr is None


def test_parser_still_never_accepts_the_test_split():
    dests = {action.dest for action in scratch.build_parser()._actions}
    assert not any("test" in dest for dest in dests), sorted(dests)


def test_help_documents_warm_start():
    completed = subprocess.run(
        [sys.executable, str(SCRIPT_PATH), "--help"],
        capture_output=True,
        text=True,
        timeout=120,
    )
    assert completed.returncode == 0, completed.stderr
    assert "--init-from" in completed.stdout
    # argparse rewraps help text, so compare on collapsed whitespace.
    flattened = " ".join(completed.stdout.split())
    assert "not an exact resume" in flattened
    assert "warm start" in flattened.lower()
