"""The single preprocessing implementation for the 15-class model.

Training augmentation lives in :mod:`app.rice_disease_15class.data`; the
deterministic transform used for validation, test and inference lives here so
that the ONNX parity check compares like with like.

Deterministic pipeline (identical to the v1 contract):

1. JPEG draft-decode to at least 512 px (speed only; no-op for small images)
2. EXIF orientation transposed
3. convert to 3-channel RGB (alpha composited onto white, so RGBA/LA/palette
   images never reach the model with a 4th channel)
4. resize so the short edge is 256 px (bilinear)
5. centre crop 224 x 224
6. scale to [0, 1], subtract ImageNet mean, divide by ImageNet std
7. HWC -> CHW float32
"""

from __future__ import annotations

from io import BytesIO
from pathlib import Path

import numpy as np
from PIL import Image, ImageOps

from .config import IMAGE_SIZE, IMAGENET_MEAN, IMAGENET_STD, RESIZE_SIZE

#: JPEG draft-decode target. Only affects decoding speed (and avoids decoding
#: a 4000 px photo at full size to produce a 224 px crop).
DRAFT_SIZE = 512


#: Modes that carry an alpha channel, including the premultiplied variants.
_ALPHA_MODES = frozenset({"RGBA", "LA", "La", "PA", "RGBa"})


def to_rgb(image: Image.Image) -> Image.Image:
    """Return a 3-channel RGB image, compositing any transparency onto white.

    ``Image.convert("RGB")`` silently drops the alpha channel instead of
    compositing it, and leaves a 4th channel in the array for RGBA input.
    Everything the model sees therefore goes through this helper: grayscale,
    palette, CMYK, LA and RGBA inputs all become ``(H, W, 3)`` uint8.

    The result may be the input object itself when it is already RGB; callers
    that close the source file must call ``.load()`` first (``load_rgb`` does).
    """

    if image.mode == "RGB":
        return image
    if image.mode in _ALPHA_MODES or (image.mode == "P" and "transparency" in image.info):
        rgba = image.convert("RGBA")
        background = Image.new("RGBA", rgba.size, (255, 255, 255, 255))
        return Image.alpha_composite(background, rgba).convert("RGB")
    return image.convert("RGB")


def load_rgb(source: Path | BytesIO | bytes, draft: bool = True) -> Image.Image:
    """Open an image file or byte buffer and return an upright RGB image."""

    if isinstance(source, (bytes, bytearray)):
        handle: object = BytesIO(source)
    else:
        handle = source
    try:
        with Image.open(handle) as image:  # type: ignore[arg-type]
            if draft and image.format == "JPEG":
                image.draft("RGB", (DRAFT_SIZE, DRAFT_SIZE))
            upright = ImageOps.exif_transpose(image)
            rgb = to_rgb(upright)
            rgb.load()  # decode now: the file handle closes when this block exits
            return rgb
    except (OSError, Image.DecompressionBombError) as exc:
        # One error type for every unreadable input, including truncated files.
        raise ValueError("Unreadable image data. Upload a valid JPG, PNG or WEBP photo.") from exc


def to_model_tensor(image: Image.Image) -> np.ndarray:
    """Deterministic (3, 224, 224) float32 tensor in RGB, ImageNet-normalized."""

    if image.mode != "RGB":
        # Defensive: callers may hand us RGBA/LA/L/P straight from Image.open.
        image = to_rgb(image)

    width, height = image.size
    if width < 32 or height < 32:
        raise ValueError("Image is too small. Upload a clearer photo.")

    scale = RESIZE_SIZE / min(width, height)
    resized = image.resize(
        (max(1, round(width * scale)), max(1, round(height * scale))),
        Image.Resampling.BILINEAR,
    )
    left = (resized.size[0] - IMAGE_SIZE) // 2
    top = (resized.size[1] - IMAGE_SIZE) // 2
    cropped = resized.crop((left, top, left + IMAGE_SIZE, top + IMAGE_SIZE))

    array = np.asarray(cropped, dtype=np.float32) / 255.0
    array = (array - np.array(IMAGENET_MEAN, dtype=np.float32)) / np.array(IMAGENET_STD, dtype=np.float32)
    return np.ascontiguousarray(np.transpose(array, (2, 0, 1)), dtype=np.float32)


def batch(array: np.ndarray) -> np.ndarray:
    return np.expand_dims(array, axis=0).astype(np.float32)
