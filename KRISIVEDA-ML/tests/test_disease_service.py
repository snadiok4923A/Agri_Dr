"""Regression tests for disease preprocessing and output interpretation."""

from io import BytesIO

import numpy as np
from PIL import Image

from app import disease_service


def _image_bytes() -> bytes:
    image = Image.new("RGB", (320, 180), (255, 0, 0))
    output = BytesIO()
    image.save(output, format="JPEG")
    return output.getvalue()


def test_preprocess_shape_layout_and_rgb_scaling() -> None:
    tensor = disease_service._preprocess_image(
        Image.new("RGB", (320, 180), (255, 0, 0))
    )
    assert tensor.shape == (1, 3, 224, 224)
    assert tensor.dtype == np.float32
    assert tensor[0, 0].mean() > 1.5
    assert tensor[0, 1].mean() < -1.5
    assert tensor[0, 2].mean() < -1.5


def test_class_mapping_matches_model_output_width() -> None:
    session, class_names = disease_service._load_model()
    assert class_names == [
        "bacterial_leaf_blight",
        "brown_spot",
        "healthy_rice_leaf",
        "leaf_blast",
        "leaf_scald",
        "sheath_blight",
    ]
    assert session.get_outputs()[0].shape[-1] == len(class_names)


def test_logits_are_softmaxed_and_top_three_are_ranked(monkeypatch) -> None:
    class FakeValue:
        name = "images"

    class FakeOutput:
        name = "logits"

    class FakeSession:
        def get_inputs(self):
            return [FakeValue()]

        def get_outputs(self):
            return [FakeOutput()]

        def run(self, names, inputs):
            return [np.array([[0.0, 0.1, 0.2, 0.3, 0.4, 0.5]], dtype=np.float32)]

    monkeypatch.setattr(
        disease_service,
        "_load_model",
        lambda: (
            FakeSession(),
            [
                "bacterial_leaf_blight",
                "brown_spot",
                "healthy_rice_leaf",
                "leaf_blast",
                "leaf_scald",
                "sheath_blight",
            ],
        ),
    )
    result = disease_service.analyze_disease_image(_image_bytes())
    assert result["status"] == "uncertain"
    assert result["disease"] is None
    assert result["top_predictions"][0]["disease"] == "sheath_blight"
    assert result["top_predictions"][0]["confidence"] > result["top_predictions"][1]["confidence"]
    assert sum(item["confidence"] for item in result["top_predictions"]) < 1
