"""Create CPU reference logits for fixed tensors, never train or change weights."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

import numpy as np
import onnxruntime as ort

ROOT = Path(__file__).resolve().parents[1]
VERSION = "rice-disease-warmstart-v1"
SHA256 = "5593156d6da4c35132248e1aafcce6b8294e8cdf66f4255ca91db5d95c8fa12a"
MODEL = ROOT / "public" / "models" / VERSION / "rice_disease_15class.onnx"
OUTPUT = ROOT / "playwright-test" / "fixtures" / "browser-model-reference.json"


def main() -> None:
    before = hashlib.sha256(MODEL.read_bytes()).hexdigest()
    if before != SHA256:
        raise ValueError(
            "The selected model does not match the verified warmstart weights"
        )
    session = ort.InferenceSession(str(MODEL), providers=["CPUExecutionProvider"])
    assert session.get_inputs()[0].name == "images"
    assert session.get_outputs()[0].name == "logits"
    indices = np.arange(3 * 224 * 224, dtype=np.int64)
    cases = []
    for seed in range(15):
        # Dyadic values have identical float32 representations in Python and JS.
        data = (((indices * 7 + seed * 31) % 257) - 128).astype(
            np.float32
        ) / np.float32(64)
        logits = session.run(["logits"], {"images": data.reshape(1, 3, 224, 224)})[0]
        assert logits.shape == (1, 15) and logits.dtype == np.float32
        assert np.isfinite(logits).all()
        cases.append({"seed": seed, "logits": logits[0].tolist()})
    assert hashlib.sha256(MODEL.read_bytes()).hexdigest() == before
    result = {
        "model_version": VERSION,
        "model_sha256": SHA256,
        "generated_with": {
            "onnxruntime": ort.__version__,
            "numpy": np.__version__,
            "provider": "CPUExecutionProvider",
            "input_shape": [1, 3, 224, 224],
            "input_formula": "(((index * 7 + seed * 31) % 257) - 128) / 64",
            "purpose": "Identical-tensor runtime parity, not an image accuracy benchmark",
        },
        "cases": cases,
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(
        f"Wrote {len(cases)} CPU reference tensors' logits to {OUTPUT.relative_to(ROOT)}; weights unchanged"
    )


if __name__ == "__main__":
    main()
