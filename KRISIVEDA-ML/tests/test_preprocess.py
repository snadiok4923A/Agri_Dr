"""Preprocessing tests: every input mode must reach the model as 3-channel RGB.

The regression these cover: an RGBA PNG used to arrive at normalization as
``(H, W, 4)`` and fail with ``operands could not be broadcast together with
shapes (224,224,4) (3,)``.
"""

from __future__ import annotations

from io import BytesIO
from pathlib import Path

import numpy as np
import pytest
from PIL import Image

from app.rice_disease_15class import inference
from app.rice_disease_15class.config import IMAGE_SIZE, IMAGENET_MEAN, IMAGENET_STD
from app.rice_disease_15class.inference import V2_METADATA_PATH, V2_MODEL_PATH
from app.rice_disease_15class.preprocess import load_rgb, to_model_tensor, to_rgb

MEAN = np.array(IMAGENET_MEAN, dtype=np.float32)
STD = np.array(IMAGENET_STD, dtype=np.float32)


def _encoded(image: Image.Image, fmt: str, **kwargs) -> bytes:
    buffer = BytesIO()
    image.save(buffer, format=fmt, **kwargs)
    return buffer.getvalue()


def _gradient(mode: str, size: int = 128) -> Image.Image:
    """A non-uniform image, so a wrong crop would show up as a wrong value."""

    array = np.zeros((size, size, 4), dtype=np.uint8)
    ramp = np.linspace(20, 230, size, dtype=np.uint8)
    array[..., 0] = ramp[None, :]
    array[..., 1] = ramp[:, None]
    array[..., 2] = 120
    array[..., 3] = 255
    return Image.fromarray(array, "RGBA").convert(mode)


def _assert_model_ready(tensor: np.ndarray) -> None:
    assert tensor.shape == (3, IMAGE_SIZE, IMAGE_SIZE)
    assert tensor.dtype == np.float32
    assert np.isfinite(tensor).all()
    # ImageNet-normalized data is not confined to [0, 1]; just bound the range.
    assert float(tensor.min()) > -3.5 and float(tensor.max()) < 3.5


@pytest.mark.parametrize(
    ("mode", "fmt", "kwargs"),
    [
        ("RGB", "JPEG", {"quality": 92}),
        ("RGB", "PNG", {}),
        ("L", "PNG", {}),
        ("P", "PNG", {}),
    ],
)
def test_common_modes_produce_three_channel_tensor(mode: str, fmt: str, kwargs: dict) -> None:
    raw = _encoded(_gradient(mode), fmt, **kwargs)
    image = load_rgb(BytesIO(raw))
    assert image.mode == "RGB"
    _assert_model_ready(to_model_tensor(image))


def test_rgba_png_is_composited_onto_white() -> None:
    rgba = Image.new("RGBA", (64, 64), (0, 0, 0, 0))  # fully transparent
    raw = _encoded(rgba, "PNG")

    image = load_rgb(BytesIO(raw))
    assert image.mode == "RGB"
    assert image.getpixel((10, 10)) == (255, 255, 255), "transparency must show as white, not black"

    tensor = to_model_tensor(image)
    _assert_model_ready(tensor)
    expected = (1.0 - MEAN) / STD
    assert np.allclose(tensor[:, 0, 0], expected, atol=1e-4)


def test_semi_transparent_pixel_blends_with_white() -> None:
    rgba = Image.new("RGBA", (32, 32), (255, 0, 0, 128))
    red, green, blue = to_rgb(rgba).getpixel((5, 5))
    assert red == 255
    assert 120 <= green <= 135, green  # half red over white
    assert green == blue


def test_palette_with_transparency_is_composited() -> None:
    palette = Image.new("P", (32, 32), 0)
    palette.putpalette([0, 0, 0, 255, 0, 0] + [0] * 762)
    palette.info["transparency"] = 0
    assert to_rgb(palette).getpixel((1, 1)) == (255, 255, 255)


def test_to_model_tensor_accepts_non_rgb_images_directly() -> None:
    """The original bug path: PIL image straight from Image.open, no conversion."""

    rgba = _gradient("RGBA")
    assert rgba.mode == "RGBA"
    _assert_model_ready(to_model_tensor(rgba))
    _assert_model_ready(to_model_tensor(_gradient("L")))


def test_rgb_input_is_unchanged_by_the_conversion() -> None:
    rgb = _gradient("RGB")
    assert to_rgb(rgb) is rgb
    assert np.array_equal(to_model_tensor(rgb), to_model_tensor(rgb.convert("RGB")))


@pytest.mark.parametrize(
    "raw",
    [
        b"",
        b"not an image",
        b"\x89PNG\r\n\x1a\n" + b"\x00" * 20,  # truncated PNG header
        b"\xff\xd8\xff\xe0" + b"garbage",  # truncated JPEG
    ],
)
def test_invalid_bytes_raise_clear_errors(raw: bytes) -> None:
    with pytest.raises(ValueError):
        load_rgb(BytesIO(raw))
    with pytest.raises(ValueError):
        inference.analyze_image(raw)


@pytest.mark.skipif(
    not (V2_MODEL_PATH.is_file() and V2_METADATA_PATH.is_file()),
    reason="15-class ONNX artifact not exported yet",
)
def test_inference_handles_rgba_png_end_to_end() -> None:
    inference._cache.clear()  # noqa: SLF001 - module-level session cache
    raw = _encoded(_gradient("RGBA"), "PNG")
    result = inference.analyze_image(raw)
    assert result["status"] in {"ok", "uncertain"}
    assert 0.0 <= result["confidence"] <= 1.0
    assert len(result["top_predictions"]) == 3
    assert all(prediction["class_id"] for prediction in result["top_predictions"])


@pytest.mark.skipif(
    not (V2_MODEL_PATH.is_file() and V2_METADATA_PATH.is_file()),
    reason="15-class ONNX artifact not exported yet",
)
def test_inference_handles_grayscale_and_palette() -> None:
    for mode in ("L", "P"):
        result = inference.analyze_image(_encoded(_gradient(mode), "PNG"))
        assert result["status"] in {"ok", "uncertain"}
        assert result["top_predictions"][0]["class_id"]
