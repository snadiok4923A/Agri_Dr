"""MobileNetV3-Small with a 15-class head.

The backbone is ImageNet-pretrained (torchvision weights, CPU-friendly) and
the 1000-class classifier is replaced with a fresh 15-class linear layer.
Input is a float32 NCHW tensor of shape ``(N, 3, 224, 224)`` in RGB,
ImageNet-normalized — the same contract as the v1 model.
"""

from __future__ import annotations

from typing import Any

from . import taxonomy
from .config import IMAGE_SIZE


def build_model(num_classes: int = taxonomy.NUM_CLASSES, pretrained: bool = True) -> Any:
    """Return a MobileNetV3-Small with ``num_classes`` outputs."""

    from torch import nn
    from torchvision import models

    weights = models.MobileNet_V3_Small_Weights.IMAGENET1K_V1 if pretrained else None
    model = models.mobilenet_v3_small(weights=weights)
    in_features = model.classifier[-1].in_features
    model.classifier[-1] = nn.Linear(in_features, num_classes)
    model.image_size = IMAGE_SIZE  # type: ignore[attr-defined]
    return model


def set_backbone_trainable(model: Any, trainable: bool) -> None:
    for parameter in model.features.parameters():
        parameter.requires_grad = trainable


def unfreeze_last_block(model: Any) -> None:
    """Unfreeze the final inverted-residual block plus the classifier."""

    set_backbone_trainable(model, False)
    for parameter in model.features[-1].parameters():
        parameter.requires_grad = True
    for parameter in model.classifier.parameters():
        parameter.requires_grad = True


def trainable_parameter_count(model: Any) -> int:
    return sum(parameter.numel() for parameter in model.parameters() if parameter.requires_grad)


def total_parameter_count(model: Any) -> int:
    return sum(parameter.numel() for parameter in model.parameters())
