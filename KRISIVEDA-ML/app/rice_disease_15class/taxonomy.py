"""Canonical 15-class taxonomy for the new rice disease & pest dataset.

Folder names on disk contain spaces and inconsistent casing
(``Leaf Blast``, ``Healthy``, ``leaf_roller``). The model never consumes a
folder name directly: it uses a stable canonical ``class_id``. The original
folder name is preserved in every report and manifest so anything can be
traced back to the file on disk.

The class list deliberately mixes three kinds of label:

* ``disease``  — a named pathogen symptom.
* ``pest``     — insect damage (hispa, leaf roller, stem borers) and the
  ``dead_heart`` symptom those borers cause.
* ``healthy``  — no visible disease or pest damage.

That mix is a property of the dataset, not of this code. A prediction is a
*label*, not a causal diagnosis: ``dead_heart`` is a symptom of stem-borer
feeding, not a separate pathogen.
"""

from __future__ import annotations

import re
from dataclasses import asdict, dataclass
from typing import Iterable


@dataclass(frozen=True)
class ClassSpec:
    """One canonical class."""

    class_id: str
    folder_name: str
    display_name: str
    category: str  # "disease" | "pest" | "healthy"
    causal_agent: str
    notes: str = ""
    needs_review: bool = False


#: Fixed order — this ordering IS the model's output order. Append new
#: classes at the end and bump the model version; never reorder.
TAXONOMY: tuple[ClassSpec, ...] = (
    ClassSpec(
        "bacterial_leaf_blight",
        "bacterial_leaf_blight",
        "Bacterial leaf blight",
        "disease",
        "Xanthomonas oryzae pv. oryzae",
        "Water-soaked to yellow-white lesions starting at leaf tips.",
    ),
    ClassSpec(
        "bacterial_leaf_streak",
        "bacterial_leaf_streak",
        "Bacterial leaf streak",
        "disease",
        "Xanthomonas oryzae pv. oryzicola",
        "Narrow translucent streaks; frequently confused with leaf blight.",
    ),
    ClassSpec(
        "bacterial_panicle_blight",
        "bacterial_panicle_blight",
        "Bacterial panicle blight",
        "disease",
        "Burkholderia glumae / B. gladioli",
        "Panicle-centred symptoms; leaf-only photos may be unrepresentative.",
    ),
    ClassSpec(
        "bacterial_stripe_disease",
        "bacterial_stripe_disease",
        "Bacterial stripe disease",
        "disease",
        "Acidovorax avenae subsp. avenae",
        "Stripe symptoms overlap with leaf streak and blight.",
    ),
    ClassSpec(
        "brown_spot",
        "brown_spot",
        "Brown spot",
        "disease",
        "Bipolaris oryzae",
        "Oval brown lesions; overlaps with leaf smut and blast.",
    ),
    ClassSpec(
        "dead_heart",
        "dead_heart",
        "Dead heart",
        "pest",
        "Stem-borer feeding damage",
        "Symptom class (not a pathogen); caused by stem borers including the "
        "white and yellow stem borer classes in this dataset.",
    ),
    ClassSpec(
        "downy_mildew",
        "downy_mildew",
        "Downy mildew",
        "disease",
        "Peronosclerospora spp. (recorded on rice)",
        "Downy mildew is uncommon on rice; confirm these images are not "
        "another disease before trusting this class.",
        needs_review=True,
    ),
    ClassSpec(
        "healthy_rice_leaf",
        "Healthy",
        "Healthy leaf",
        "healthy",
        "No pathogen or pest damage",
        "Any early, low-contrast lesion can be absorbed into this class.",
    ),
    ClassSpec(
        "hispa",
        "hispa",
        "Rice hispa",
        "pest",
        "Dicladispa armigera",
        "Adult scraping and larval mining; label is an insect, not a disease.",
    ),
    ClassSpec(
        "leaf_blast",
        "Leaf Blast",
        "Leaf blast",
        "disease",
        "Magnaporthe oryzae",
        "Spindle-shaped lesions; early lesions resemble brown spot.",
    ),
    ClassSpec(
        "leaf_smut",
        "Leaf Smut",
        "Leaf smut",
        "disease",
        "Entyloma oryzae",
        "Rare in this dataset; smallest class, so metrics will be noisy.",
        needs_review=True,
    ),
    ClassSpec(
        "leaf_roller",
        "leaf_roller",
        "Leaf roller",
        "pest",
        "Cnaphalocrocis medinalis",
        "Folded/glued leaves with scraping damage.",
    ),
    ClassSpec(
        "tungro",
        "tungro",
        "Tungro",
        "disease",
        "Rice tungro virus (leafhopper-transmitted)",
        "Yellow-orange discolouration; whole-plant symptoms may be missed in "
        "leaf close-ups.",
    ),
    ClassSpec(
        "white_stem_borer",
        "white_stem_borer",
        "White stem borer",
        "pest",
        "Scirpophaga innotata",
        "Damage appears as dead heart / white ear; overlaps with dead_heart.",
    ),
    ClassSpec(
        "yellow_stem_borer",
        "yellow_stem_borer",
        "Yellow stem borer",
        "pest",
        "Scirpophaga incertulas",
        "Damage appears as dead heart / white ear; overlaps with dead_heart.",
    ),
)

#: Extra spellings accepted when resolving a folder name. Keys are the
#: normalized (lowercase, non-alphanumeric collapsed) forms.
_ALIASES: dict[str, str] = {
    "healthy": "healthy_rice_leaf",
    "healthy_leaf": "healthy_rice_leaf",
    "healthy_rice_leaf": "healthy_rice_leaf",
    "leafblast": "leaf_blast",
    "leaf_blight": "bacterial_leaf_blight",
    "brownspot": "brown_spot",
    "leafsmut": "leaf_smut",
    "rice_hispa": "hispa",
    "rice_tungro": "tungro",
    "deadheart": "dead_heart",
    "wsb": "white_stem_borer",
    "ysb": "yellow_stem_borer",
    "leafroller": "leaf_roller",
    "downy_mildew_rice": "downy_mildew",
}

#: Pairs that are visually similar; used to prioritise duplicate review.
CONFUSABLE_PAIRS: tuple[tuple[str, str], ...] = (
    ("bacterial_leaf_blight", "bacterial_leaf_streak"),
    ("bacterial_leaf_blight", "bacterial_stripe_disease"),
    ("bacterial_leaf_streak", "bacterial_stripe_disease"),
    ("brown_spot", "leaf_blast"),
    ("brown_spot", "leaf_smut"),
    ("dead_heart", "white_stem_borer"),
    ("dead_heart", "yellow_stem_borer"),
    ("white_stem_borer", "yellow_stem_borer"),
    ("hispa", "leaf_roller"),
    ("healthy_rice_leaf", "brown_spot"),
    ("healthy_rice_leaf", "leaf_smut"),
)

CLASS_IDS: tuple[str, ...] = tuple(spec.class_id for spec in TAXONOMY)
NUM_CLASSES = len(CLASS_IDS)
_BY_ID: dict[str, ClassSpec] = {spec.class_id: spec for spec in TAXONOMY}
_BY_FOLDER: dict[str, ClassSpec] = {spec.folder_name: spec for spec in TAXONOMY}


class TaxonomyError(ValueError):
    """Raised when dataset folders cannot be mapped unambiguously."""


def normalize_label(name: str) -> str:
    """Lowercase, collapse every non-alphanumeric run to ``_``."""

    return re.sub(r"_+", "_", re.sub(r"[^a-z0-9]+", "_", name.strip().lower())).strip("_")


def get_spec(class_id: str) -> ClassSpec:
    try:
        return _BY_ID[class_id]
    except KeyError as exc:  # pragma: no cover - programming error
        raise TaxonomyError(f"Unknown class id: {class_id!r}") from exc


def resolve_folder(folder_name: str) -> ClassSpec | None:
    """Map an on-disk folder name to a class, or ``None`` when unknown."""

    exact = _BY_FOLDER.get(folder_name)
    if exact is not None:
        return exact
    normalized = normalize_label(folder_name)
    for spec in TAXONOMY:
        if normalize_label(spec.class_id) == normalized or normalize_label(spec.folder_name) == normalized:
            return spec
    alias_target = _ALIASES.get(normalized)
    if alias_target is not None:
        return _BY_ID[alias_target]
    return None


@dataclass(frozen=True)
class FolderMapping:
    folder_name: str
    class_id: str | None
    display_name: str | None
    normalized: str
    note: str

    def as_dict(self) -> dict[str, object]:
        return asdict(self)


def build_folder_mapping(folder_names: Iterable[str]) -> list[FolderMapping]:
    """Resolve every folder, failing loudly on ambiguous collisions.

    Two different folders that normalize to the same canonical class would
    silently merge labels, so that case raises instead of guessing. Unknown
    folders are reported (``class_id=None``) and excluded from training.
    """

    resolved: list[FolderMapping] = []
    seen: dict[str, list[str]] = {}
    for name in folder_names:
        spec = resolve_folder(name)
        normalized = normalize_label(name)
        resolved.append(
            FolderMapping(
                folder_name=name,
                class_id=spec.class_id if spec else None,
                display_name=spec.display_name if spec else None,
                normalized=normalized,
                note=spec.notes if spec else "No taxonomy entry; excluded from training.",
            )
        )
        if spec is not None:
            seen.setdefault(spec.class_id, []).append(name)

    collisions = {class_id: names for class_id, names in seen.items() if len(names) > 1}
    if collisions:
        detail = "; ".join(f"{class_id} <- {sorted(names)}" for class_id, names in collisions.items())
        raise TaxonomyError(
            "Multiple dataset folders map to the same canonical class. "
            "Rename the folders or add explicit aliases before training: " + detail
        )
    return resolved


def mapping_payload() -> dict[str, object]:
    """Explicit, machine-readable class mapping for artifacts and reports."""

    return {
        "version": "rice-disease-15class-v1",
        "num_classes": NUM_CLASSES,
        "order_is_model_output_order": True,
        "classes": [asdict(spec) for spec in TAXONOMY],
        "confusable_pairs": [list(pair) for pair in CONFUSABLE_PAIRS],
        "label_notes": [
            "Class set mixes disease, pest-damage and healthy labels.",
            "dead_heart is a stem-borer symptom, not a distinct pathogen.",
            "Predictions are dataset labels, not confirmed agronomic diagnoses.",
        ],
    }
