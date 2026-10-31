# 15-class rice disease & pest pipeline (development)

This documents the **new, versioned** 15-class pipeline. It is developed
alongside the production 6-class model and is **not** wired into the API.

| | v1 (production) | v2 (this pipeline) |
| --- | --- | --- |
| classes | 6 | 15 |
| artifacts | `models/rice_disease_model.onnx`, `models/class_names.json` | `models/rice_disease_15class/rice-disease-15class-v2/` |
| served by | `POST /disease/predict` | nothing yet |
| status | untouched | trained + evaluated, awaiting review |

The production files are never opened for writing by anything in
`app/rice_disease_15class/` or `scripts/*rice_disease_15class*`.

## 1. Environment (Windows, CPU only)

No GPU, no Colab. `runtime.txt` pins the Render service to Python 3.13.5;
the local CPU trainer was run on Python 3.14 and works on any version that
has CPU torch wheels.

```powershell
cd KRISIVEDA-ML
python -m pip install -r requirements-train.txt --extra-index-url https://download.pytorch.org/whl/cpu
```

`--extra-index-url` matters: `--index-url` replaces PyPI with the PyTorch
index, which only serves torch/torchvision, so `fastapi`, `onnx` and
everything else becomes unresolvable.

`requirements-train.txt` includes the production requirements and adds
CPU torch/torchvision/onnx. The Render service keeps using
`requirements.txt`, so it never downloads torch.

## 2. Dataset layout

```
data/rice_disease_15class/
  bacterial_leaf_blight/       bacterial_leaf_streak/
  bacterial_panicle_blight/    bacterial_stripe_disease/
  brown_spot/                  dead_heart/
  downy_mildew/                Healthy/
  hispa/                       Leaf Blast/
  Leaf Smut/                   leaf_roller/
  tungro/                      white_stem_borer/
  yellow_stem_borer/
```

Folder names may contain spaces and mixed case. They are mapped to stable
canonical ids in `app/rice_disease_15class/taxonomy.py`; the mapping is
written to `reports/rice_disease_15class/class_mapping.json`.

**Do not rename, move, delete or relabel the source images.** Every script
here is read-only on the dataset.

## 3. Audit

```powershell
python scripts/audit_rice_disease_dataset.py --workers 4
```

Reads every file, does not modify anything, and writes:

| file | contents |
| --- | --- |
| `reports/rice_disease_15class/dataset_audit.json` | counts, formats, imbalance, duplicates, label flags, limitations |
| `.../dataset_audit_classes.csv` | per-class counts, share, duplicate counts, cluster counts |
| `.../dataset_audit_review.csv` | per-image review list (duplicates, look-alikes, broken/unsupported files) |
| `.../dataset_index.csv` | one row per image: class, status, sha256, dHash, cluster id (input for splitting) |
| `.../class_mapping.json` | explicit folder → class mapping and class order |

Duplicate detection has two layers:

1. **exact** — SHA-256 of file bytes;
2. **perceptual** — 64-bit dHash within Hamming ≤ 6 **and** a 16×16 thumbnail
   mean-absolute-difference ≤ 12.

The second check matters: a hash alone chained 2,244 images from 9 classes
into one "duplicate" group on this dataset, because flat/low-contrast photos
share a hash. Images with almost no contrast are excluded from perceptual
matching and counted in `low_detail_images_excluded_from_matching`.

Near-duplicate clusters are merged **within a class only**. Identical bytes
found in two classes are merged (they would otherwise leak across splits)
and reported as a label conflict.

## 4. Split manifests

```powershell
python scripts/split_rice_disease_dataset.py --seed 42
python scripts/split_rice_disease_dataset.py --verify-only
```

70 / 15 / 15, stratified by class, duplicate-cluster aware: every image in
a cluster lands in the same split, so exact and near duplicates cannot leak.
The source images are not copied or moved; only CSV manifests are written to
`reports/rice_disease_15class/splits/`.

A class with fewer than three clusters cannot be split honestly: it stays in
training and is listed under `insufficient_cluster_classes` in
`split_summary.json`. This is reported, never silently papered over.

## 5. Training (CPU)

```powershell
python scripts/train_rice_disease_15class.py --epochs 6 --batch-size 32 --workers 2
```

* MobileNetV3-Small, ImageNet weights, new 15-class head.
* Epoch 1 freezes the backbone (`--freeze-epochs`), then the last block and
  classifier are fine-tuned.
* Augmentation is training-only and mild: random resized crop (65–100 %),
  ±12° rotation, horizontal flip, brightness/contrast jitter. No vertical
  flip and no colour shift that could change lesion appearance.
* Validation/test/inference transforms are identical: short edge 256,
  centre crop 224, ImageNet normalization.
* Class-weighted cross-entropy (inverse frequency, normalized) and label
  smoothing 0.05.
* Model selection and early stopping use validation **macro-F1**
  (`--patience`).
* `--max-train-per-class` / `--max-val-per-class` cap a CPU-budgeted run;
  the caps are recorded in `training_config.json`.

Artefacts in `models/rice_disease_15class/rice-disease-15class-v2/`:

| file | contents |
| --- | --- |
| `best.pt` | best validation macro-F1 checkpoint |
| `last.pt` | most recent completed epoch |
| `training_history.json/.csv` | per-epoch loss, accuracy, macro-F1, per-class F1, LR, seconds |
| `training_config.json` | full config, caps, seed, class order, timings |
| `class_mapping.json` | class order + taxonomy notes |
| `training.log` | run log |

Interrupting with Ctrl+C keeps the last completed epoch's checkpoints and
history. There is no resume mode; re-running starts a new run.

## 6. Evaluation

```powershell
python scripts/evaluate_rice_disease_15class.py
```

Runs once on the untouched test split and writes
`reports/rice_disease_15class/evaluation/`:

* `test_metrics.json` — accuracy, balanced accuracy, macro/weighted
  precision/recall/F1, per-class table, confusion matrix, top confusions,
  baselines, limitations;
* `test_per_class.csv`, `test_confusion_matrix.csv`, `test_confusion_matrix.md`;
* `test_misclassified.csv` — true class, predicted class, confidence,
  runner-up;
* `report.md` — human-readable summary.

The test split is not used for hyperparameter selection. Metrics describe
this dataset's labels, not field-verified diagnoses.

## 7. ONNX export and parity

```powershell
python scripts/export_rice_disease_15class_onnx.py
python scripts/export_rice_disease_15class_onnx.py --parity-only
```

* Export uses the TorchScript exporter, opset 17, input `images`
  `(N, 3, 224, 224)` float32, output `logits` `(N, 15)`.
* ONNX Runtime runs on `CPUExecutionProvider`.
* Parity runs both runtimes on the **same** preprocessed tensor and reports
  max/mean absolute logit difference, max probability difference, predicted
  class agreement, and whether everything is within `1e-4`.
* `model_metadata.json` records the class order, preprocessing contract,
  preprocessing parameters, hashes, parity result and rollback note.

### Exporting a second version

Output paths are explicit, and the script refuses to write into the v2
folder when the checkpoint is not the v2 model:

```powershell
python scripts/export_rice_disease_15class_onnx.py `
  --checkpoint models/rice_disease_15class/rice-disease-15class-v3-exp20/best.pt `
  --output     models/rice_disease_15class/rice-disease-15class-v3-exp20/rice_disease_15class.onnx `
  --metadata   models/rice_disease_15class/rice-disease-15class-v3-exp20/model_metadata.json `
  --parity     models/rice_disease_15class/rice-disease-15class-v3-exp20/onnx_parity.json `
  --model-version rice-disease-15class-v3-exp20
```

### Comparing two versions on your own photos

`scripts/compare_rice_disease_versions.py` is read-only: it loads each model
from its own directory plus the metadata beside it (never the default
inference paths), feeds both the **same** preprocessed tensor, and applies the
same 0.60 threshold. Nothing is written and no image is modified.

```powershell
python scripts/compare_rice_disease_versions.py `
  "C:\Users\Sandipan Paul\Pictures\PICS\23.jpg" `
  "C:\Users\Sandipan Paul\Pictures\PICS\24.jpg"
```

* Positional arguments are image paths; `--top-k` (default 3) sets how many
  classes per model are printed.
* `--baseline-dir` / `--candidate-dir` point at other model folders; each
  folder must contain exactly one `.onnx` and a `model_metadata.json`.
* RGB, RGBA, grayscale, palette and WEBP inputs are converted identically for
  both models; unreadable files are reported and the script exits with code 1.
* A result marked `uncertain` means below threshold, not a different answer.

## 8. Tests

```powershell
python -m pytest
```

`tests/test_rice_disease_15class.py` covers taxonomy mapping/collision
handling, read-only auditing, class-aware duplicate clustering, split
reproducibility and leak checks, insufficient-cluster reporting, preservation
of the 6-class production artifacts, and ONNX smoke tests (skipped until the
15-class ONNX file exists).

## 9. Limitations

* The dataset has no capture/field identifier, so images of the same plant
  that are not visually near-duplicates can still cross splits.
* Class labels are inherited from folder names and were not verified in the
  field. `dataset_audit_review.csv` lists look-alike pairs across classes.
* The class set mixes diseases, pest damage and healthy leaves;
  `dead_heart` is a stem-borer symptom, not a separate pathogen.
* Class imbalance is substantial (largest ≈ 43× smallest), and `leaf_smut`
  is very small, so its metrics are high variance.
* Test accuracy alone does not establish real-world diagnostic suitability.

## 10. Integration and rollback

Migration is deliberately **not** performed here. Before switching:

1. review `evaluation/test_metrics.json` and the label-review CSV;
2. confirm `onnx_parity.json` shows `all_within_atol: true`;
3. add a new endpoint/version flag (e.g. `POST /disease/v2/predict`) instead
   of editing the 6-class response contract, so clients can opt in;
4. load class names from the new `model_metadata.json`, never from
   `models/class_names.json` (6 classes) — a mismatch would silently
   mislabel every prediction;
5. keep the old endpoint and model available until the new one is validated
   in the field.

Rollback: delete `models/rice_disease_15class/` and the new route/flag. The
production model, mapping and `/disease/predict` behaviour are unaffected by
anything in this pipeline.

## 11. Recorded run (2026-10-24, CPU only)

Everything below was produced by the commands in sections 3–7 on this machine
(Python 3.14, CPU torch 2.14.1, no GPU).

### Audit (`reports/rice_disease_15class/dataset_audit.json`)

| | |
| --- | --- |
| files scanned | 43,387 |
| readable images | 43,384 |
| unreadable / corrupt | 0 |
| unsupported files | 3 |
| class folders | 15 (0 empty, 0 unmapped) |
| largest / smallest class | `leaf_blast` 7,594 / `leaf_smut` 176 (43.2×) |
| exact duplicate groups | 5,296 (12,875 images) |
| near-duplicate pairs | 71,806 |
| cross-class near-duplicate pairs | 10,418 (review list) |
| duplicate clusters | 4,805 (largest 400) |
| clusters spanning classes | 1 (`brown_spot` + `Leaf Smut`, exact bytes — label conflict) |

Perceptual matching is class-aware and requires a 16×16 thumbnail distance
check, so look-alikes in different classes are reported for review but never
merged. The single cross-class cluster is a genuine byte-identical pair.

### Split (`reports/rice_disease_15class/splits/`)

30,195 train / 6,698 validation / 6,491 test (0.696 / 0.154 / 0.150, seed 42),
cluster-disjoint, `verify_splits` clean, no insufficient-cluster classes.

### Training (`models/rice_disease_15class/rice-disease-15class-v2/`)

8 epochs, batch 32, AdamW, 1 frozen epoch then last-block fine-tune,
class-weighted CE + label smoothing 0.05, 29.7 min total on CPU.

| epoch | stage | train loss | val loss | val acc | val macro-F1 |
| --- | --- | --- | --- | --- | --- |
| 1 | frozen backbone | 1.6618 | 1.1574 | 0.6474 | 0.5735 |
| 2 | fine-tune | 1.3592 | 0.7372 | 0.7838 | 0.7165 |
| 4 | fine-tune | 1.1234 | 0.5747 | 0.8546 | 0.7932 |
| 6 | fine-tune | 1.0244 | 0.5166 | 0.8701 | 0.8082 |
| 7 (best) | fine-tune | 0.9889 | 0.5017 | 0.8776 | **0.8177** |
| 8 | fine-tune | 0.9763 | 0.4984 | 0.8767 | 0.8168 |

### Test evaluation (`reports/rice_disease_15class/evaluation/`)

6,491 held-out images: **accuracy 0.8566**, balanced accuracy 0.8566,
macro-F1 **0.7936**, weighted-F1 0.8593, 931 misclassified. Baselines:
always-`leaf_blast` 0.1755, uniform random 0.0667.

Weakest classes: `leaf_smut` F1 0.42 (26 test images), `dead_heart` 0.50
(43.5 % predicted as `white_stem_borer`), `white_stem_borer` 0.60,
`leaf_roller` 0.73. Strongest: `bacterial_leaf_blight` 0.96,
`bacterial_panicle_blight` 0.96, `bacterial_leaf_streak` 0.94, `tungro` 0.94.

The 0.8566 headline number is the honest all-images figure. With the
`MIN_CONFIDENCE = 0.60` gate that `inference.py` applies, 74.3 % of test
images are answered at 94.5 % accuracy and the rest are returned as
`uncertain`:

| threshold | coverage | accuracy on accepted |
| --- | --- | --- |
| 0.50 | 0.8287 | 0.9243 |
| 0.60 (current gate) | 0.7426 | 0.9450 |
| 0.70 | 0.6381 | 0.9582 |
| 0.80 | 0.4768 | 0.9709 |

Coverage is the share of images the API would actually label; the remainder
gets the "upload a clearer leaf photo" message. Raising the gate buys
precision by refusing more images — do not tune it on the test split.

### ONNX parity (`models/.../onnx_parity.json`)

6.1 MB opset-17 export, `images (N,3,224,224)` → `logits (N,15)`, CPU EP.
128 held-out images: max |Δlogit| 2.68e-05, mean 3.17e-06, argmax agreement
1.0000, all within `1e-4`.

### Tests

`python -m pytest` → **65 passed** (38 pre-existing + 27 new), including the
production-preservation, ONNX smoke and confidence-gate tests.

## 12. Label-review workflow

`dataset_audit_review.csv` has 73,369 rows, but they describe only ~230
decisions. The review builder collapses pair rows into **cases** (one question
each) and merges duplicate and model evidence.

```powershell
python scripts/build_review_queue.py
start reports\rice_disease_15class\review\review.html
```

Outputs in `reports/rice_disease_15class/review/`:

| file | contents |
| --- | --- |
| `review.html` | self-contained review page: thumbnails, filters, Confirm / Incorrect / Defer, exports a decisions CSV |
| `review_cases.csv` | one row per case, empty decision columns (Excel-friendly UTF-8 BOM) |
| `review_items.csv` | one row per image shown in a case, with per-image `evidence`, a plain-language `reason`, and empty `decision`/`corrected_class` columns |
| `review_queue.json` | the same queue for scripts |
| `review_cases.md` | short human summary |

### Case kinds and priority

| kind | meaning | priority |
| --- | --- | --- |
| `exact_label_conflict` | byte-identical files in two classes | P1 |
| `misclassified_with_duplicate_evidence` | model says X **and** the image copies an X-labelled image | P1 |
| `near_duplicate_cross_class` | a look-alike family, or an aggregated per-pair case for isolated 2-4 image groups | P1 when the evidence is a near-identical hash, otherwise P2 |
| `confident_misclassification` | confidence ≥ 0.90 on the wrong class, no duplicate support | P2 |
| `systematic_confusion` | ≥ 3 low-confidence errors for one (true → predicted) pair | P3 |

A case shows at most 24 images (`--max-images-per-case`); its true size is
always reported. `--max-images-per-case 8` gives a quicker skim.

### Decisions and recording them

Allowed decisions: `confirm` (labels are right), `incorrect` (name the correct
class), `defer` (needs an agronomist). The HTML page stores decisions in the
browser until you export `review_decisions.csv`. Then:

```powershell
python scripts/apply_label_decisions.py reports\rice_disease_15class\review\review_decisions.csv
```

That command validates every row (unknown path, unknown class, `confirm` with a
correction, conflicting decisions for one image) and **aborts the whole run** if
any row is bad, so a review cannot be half-applied. It writes
`reports/rice_disease_15class/labels/label_overrides_proposed.csv` plus a
summary of per-class moves.

It writes nothing to `data/`. Labels on disk are folder names, so a correction
is materialised only by building a **new dataset version**: copy the folder,
apply the override file to the copy, re-run the audit and the split with the
same seed, retrain, and publish the new metrics beside the current ones. The
current evaluation stays the honest record for the current dataset.

### Boundaries

* No image is moved, renamed, relabelled, deleted or overwritten by any script here.
* Test-split images appear in cases as **label evidence only**. Case counts are
  never used to choose hyperparameters, and the test split is never re-scored
  to tune the model.
* Confirming corrections makes the current test numbers stale for those images;
  that is why fixes ship as a version bump, not as an in-place edit.
* The 6-class production model, its mapping and `/disease/predict` are untouched.

## 13. Local API for Experiment A (`/disease/v2`)

Two additive routes serve the 15-class Experiment A ONNX file. The production
routes keep serving the 6-class model:

| route | model |
| --- | --- |
| `POST /disease/predict`, `GET /disease/status` | 6-class production model (unchanged) |
| `POST /disease/v2/predict`, `GET /disease/v2/status` | Experiment A, 15 classes |

### Which model file is used

The directory comes from `KRISIVEDA_DISEASE_V2_MODEL_DIR`. When unset it points
at `models/rice_disease_15class/rice-disease-15class-v3-exp20`. A relative value
is resolved from `KRISIVEDA-ML/`. The directory must contain exactly one `.onnx`
file and its `model_metadata.json`.

Before any inference the service checks that:

* `model_version` is present in the metadata and is what the response reports
  (never a hardcoded string);
* `class_order` matches the 15-class taxonomy exactly;
* the ONNX output width equals the class count;
* the configured directory is **not** the v2 development folder. Pointing the
  variable at `rice-disease-15class-v2` returns 503 instead of labelling the
  older model as Experiment A.

Preprocessing is the shared, alpha-safe 15-class implementation
(`app/rice_disease_15class/preprocess.py`), and the confidence gate stays 0.60
for both endpoints.

### Response shape

```json
{
  "status": "ok",
  "class_id": "leaf_blast",
  "display_name": "Leaf blast",
  "disease": "Leaf blast",
  "category": "disease",
  "confidence": 0.8742,
  "top_predictions": [
    {"class_id": "leaf_blast", "display_name": "Leaf blast", "disease": "Leaf blast", "category": "disease", "confidence": 0.8742}
  ],
  "message": "...",
  "model_version": "rice-disease-15class-v3-exp20",
  "classes_total": 15,
  "threshold": 0.6,
  "disclaimer": "..."
}
```

`disease` duplicates `display_name` so the existing React modal renders 15-class
results unchanged. `category` is `disease`, `pest` or `healthy` — the class set
mixes pathogens, insect damage and healthy leaves, so the UI must not call a
pest finding a disease. For `uncertain` results `class_id`, `display_name`,
`disease` and `category` are `null` while `confidence`, `top_predictions` and
`message` are still present.

### Running it locally

```powershell
cd KRISIVEDA-ML
uvicorn app.main:app --port 8000

curl.exe -s http://127.0.0.1:8000/disease/v2/status
curl.exe -s -X POST "http://127.0.0.1:8000/disease/v2/predict" -F "file=@C:\path\leaf.jpg"
```

Errors: 415 unsupported type, 413 over 10 MB, 422 unreadable image, 503 model or
metadata unavailable.

### Showing 15-class results on the website (opt-in)

Frontend selection is **off by default**. With no variable set,
`src/services/cropAnalysisService.js` calls `/disease/predict` exactly as before.
To try the new model locally, set in `.env.local`:

```
VITE_KRISIVEDA_DISEASE_API_VERSION=v2
```

Remove the line (or set `v1`) to return to the 6-class model. Add the dev
origin to `KRISIVEDA_ML_CORS_ORIGINS` when the API runs locally.

### Rollback

Delete `app/disease_v2_service.py`, `app/disease_v2_schemas.py`, the two v2
routes in `app/main.py` and `tests/test_disease_v2.py`, then revert the three
lines in `cropAnalysisService.js`. No model, checkpoint, manifest, report or
threshold changes, so v1 keeps working at every step.
