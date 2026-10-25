"""Versioned 15-class rice disease & pest pipeline (development only).

Nothing in this package is imported by ``app.main``. The production
6-class ONNX service (``app.disease_service``) stays authoritative until
this pipeline has passed evaluation and ONNX parity review.

Modules
-------
``config``     paths, preprocessing contract, versions
``taxonomy``   folder -> canonical class mapping and label-risk notes
``audit``      read-only dataset inspection (counts, corruption, duplicates)
``splitting``  reproducible, duplicate-aware train/val/test manifests
``data``       manifest-backed ``torch`` datasets and transforms
``model``      MobileNetV3-Small with a 15-class head
``train``      CPU training loop with early stopping
``evaluate``   held-out test metrics and misclassification listing
``export``     ONNX export plus PyTorch/ONNX parity checks
``inference``  optional v2 inference helper (not wired into the API)
"""

MODEL_VERSION = "rice-disease-15class-v2"

__all__ = ["MODEL_VERSION"]
