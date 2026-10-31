# KRISIVEDA model inventory and preservation policy

Inventory date: **2026-10-31**. All paths in this document are relative to the
`Agri_de` repository root unless stated otherwise. This is a filesystem and
source-reference inventory, not an accuracy claim, deployment record, or browser
certification. Dependencies, virtual environments, caches, and training image
datasets are outside the model-artifact inventory.

## 1. Scope and current status

- There are **16 original weight artifacts** under `KRISIVEDA-ML/models`: **4 ONNX
  exports and 12 PyTorch checkpoints**, totaling **124,388,738 bytes (118.63 MiB)**.
  Their metadata, mappings, histories, and logs comprise another **37 files**.
- The existing production/default image classifier is **six-class
  `rice-disease-v1`**, served by the Python API on `/disease/predict`.
- The separate HTTP V2 feature is a **15-class development classifier**. Its code
  default is `rice-disease-15class-v3-exp20`; the backend directory is configurable.
- An earlier local runtime check, supplied before this inventory, confirmed
  **`rice-disease-warmstart-v1`, 15 classes, on `127.0.0.1:8001`**. This is evidence
  of that local selection, not the default configuration or current remote API
  state. The inventory did not repeat that runtime request.
- The parent integration adds a separate, explicit frontend selector value
  **`browser-v2`**, labeled **Browser Model (15 Classes)**, for the unchanged
  warmstart ONNX using local ONNX Runtime Web/WASM. Browser validation is pending
  the parent's tests. **V1 remains the default; API V1 and backend V2 remain
  separate and unchanged.**
- The parent copied one original ONNX and three original companion files
  byte-for-byte into `public/models/rice-disease-warmstart-v1/`, with a new
  `manifest.json`. This is an additional publication copy, not another trained
  version: **17 physical weight files including the public duplicate**, but still
  the 16 original artifacts listed below.
- No saved nutrient/fertilizer model was found. The current fertilizer feature
  uses frontend records/catalogs and arithmetic. The referenced farm-yield
  `yield_model.joblib` does not exist. Neither caveat authorizes removing working
  features or substituting disease weights for those tasks.

**Preserve every original, its companion files, and all existing working model
paths. Ignoring or excluding an artifact from the static site is not deletion. No
retraining, re-export, quantization, weight edits, model replacement, or deletion
is part of this work.**

## 2. Complete inventory of the 16 original weights

Sizes are exact bytes measured from the existing files. `T` means Git-tracked;
`I` means locally present but Git-ignored at this snapshot. Roles `P`, `H`, `A`,
`W`, and `S` are traced to consumers in section 3. All 15-class checkpoints declare
`mobilenet_v3_small`; V1's version is the serving code's version stamp.

| Original artifact path | Bytes | Model version | Classes | Epoch / role | Git |
| --- | ---: | --- | ---: | --- | :---: |
| `KRISIVEDA-ML/models/rice_disease_model.onnx` | 6,105,659 | `rice-disease-v1` | 6 | **P:** production/default disease export | T |
| `KRISIVEDA-ML/models/rice_disease_15class/rice-disease-15class-v2/rice_disease_15class.onnx` | 6,142,549 | `rice-disease-15class-v2` | 15 | **H:** historical development export, from epoch 7 | I |
| `KRISIVEDA-ML/models/rice_disease_15class/rice-disease-15class-v2/best.pt` | 6,256,681 | `rice-disease-15class-v2` | 15 | **H:** best epoch 7; default evaluation/export source | I |
| `KRISIVEDA-ML/models/rice_disease_15class/rice-disease-15class-v2/last.pt` | 6,257,001 | `rice-disease-15class-v2` | 15 | **H:** final saved epoch 8 | I |
| `KRISIVEDA-ML/models/rice_disease_15class/rice-disease-15class-v3-exp20/rice_disease_15class.onnx` | 6,142,549 | `rice-disease-15class-v3-exp20` | 15 | **A:** HTTP V2 code default; export from epoch 18 | T |
| `KRISIVEDA-ML/models/rice_disease_15class/rice-disease-15class-v3-exp20/best.pt` | 6,260,393 | `rice-disease-15class-v3-exp20` | 15 | **A:** best epoch 18; export/audit source | I |
| `KRISIVEDA-ML/models/rice_disease_15class/rice-disease-15class-v3-exp20/last.pt` | 6,261,033 | `rice-disease-15class-v3-exp20` | 15 | **A:** final saved epoch 20 | I |
| `KRISIVEDA-ML/models/rice_disease_15class/rice-disease-warmstart-v1/rice_disease_15class.onnx` | 6,142,549 | `rice-disease-warmstart-v1` | 15 | **W:** configurable backend V2; source of browser copy; export from epoch 30 | I |
| `KRISIVEDA-ML/models/rice_disease_warmstart_v1/best.pt` | 18,637,719 | `rice-disease-warmstart-v1` | 15 | **W:** best epoch 30; warmstart ONNX export source | I |
| `KRISIVEDA-ML/models/rice_disease_warmstart_v1/last.pt` | 18,640,343 | `rice-disease-warmstart-v1` | 15 | **W:** latest saved epoch 38; training state, not a browser asset | I |
| `KRISIVEDA-ML/models/rice_disease_scratch_v1/best.pt` | 6,258,601 | `rice-disease-scratch-v1` | 15 | **S:** non-smoke scratch run, epoch 3 | I |
| `KRISIVEDA-ML/models/rice_disease_scratch_v1/last.pt` | 6,258,601 | `rice-disease-scratch-v1` | 15 | **S to W:** epoch 3; recorded warmstart initialization source | I |
| `KRISIVEDA-ML/models/rice_disease_scratch_smoke_v2/best.pt` | 6,254,569 | `rice-disease-scratch-v1` | 15 | **S:** epoch 1 smoke/plumbing test; not served | I |
| `KRISIVEDA-ML/models/rice_disease_scratch_smoke_v2/last.pt` | 6,254,569 | `rice-disease-scratch-v1` | 15 | **S:** epoch 1 smoke/plumbing test; not served | I |
| `KRISIVEDA-ML/models/rice_disease_scratch_gpu_smoke/best.pt` | 6,257,961 | `rice-disease-scratch-v1` | 15 | **S:** epoch 1 GPU smoke/plumbing test; not served | I |
| `KRISIVEDA-ML/models/rice_disease_scratch_gpu_smoke/last.pt` | 6,257,961 | `rice-disease-scratch-v1` | 15 | **S:** epoch 1 GPU smoke/plumbing test; not served | I |

### Identity and grouping cautions

No two complete original weight files have the same SHA-256, so each remains a
separate inventory row. Within each of `rice_disease_scratch_v1`,
`rice_disease_scratch_smoke_v2`, and `rice_disease_scratch_gpu_smoke`, the
`best.pt`/`last.pt` pair has identical ZIP-entry contents after normalizing the
archive root name; the complete container hashes still differ. Do not delete or
merge either file on that basis.

The three 15-class ONNX exports have equal sizes but different hashes. Their
shared architecture, class count, filename, or directory suffix is not evidence
of identical learned weights. The smoke configurations cap training and
validation at eight images per class; their shared `rice-disease-scratch-v1`
version string does not make them the full scratch run or a deployed model.

Original ONNX fingerprints:

| Version | SHA-256 |
| --- | --- |
| `rice-disease-v1` | `6ddcc716817d6d27abe53882dea98e9d1628d52fcdd3347813928cd5e8ab2fc2` |
| `rice-disease-15class-v2` | `69d20b49e261eab1e152b7ec84c10b335a2e327c7b1ceeed15b3f8ae78e7c559` |
| `rice-disease-15class-v3-exp20` | `b51bb92e8777fd8e57195f44bab323599c95c8332f648c7e157f4e7d4d637628` |
| `rice-disease-warmstart-v1` | `5593156d6da4c35132248e1aafcce6b8294e8cdf66f4255ca91db5d95c8fa12a` |

## 3. Active backend consumers and offline tooling

### P: production six-class disease API

- [app/main.py](../app/main.py) imports `disease_service` and exposes
  `GET /disease/status` and `POST /disease/predict`.
- [app/disease_service.py](../app/disease_service.py), `MODEL_PATH`, `CLASS_PATH`,
  `_load_model()`, and `get_disease_model_status()`, loads the fixed production
  ONNX plus `models/class_names.json` with `CPUExecutionProvider`, checks the
  output width against the mapping, and reports `rice-disease-v1`.
- [scripts/evaluate_disease_field_images.py](../scripts/evaluate_disease_field_images.py)
  evaluates the same six-class ONNX/mapping pair. The original V1 training
  notebook/export pipeline is not present in this repository.
- The frontend chain is [Dashboard.jsx](../../src/pages/Dashboard.jsx) to
  [CameraModal.jsx](../../src/components/common/CameraModal.jsx) to
  [cropAnalysisService.js](../../src/services/cropAnalysisService.js).
  The default selection is `v1`; this API path must remain available unchanged.

### A/W: additive, configurable HTTP V2 API

- `app/main.py` separately exposes `GET /disease/v2/status` and
  `POST /disease/v2/predict`, calling
  [app/disease_v2_service.py](../app/disease_v2_service.py).
- `DEFAULT_MODEL_DIR` selects
  `models/rice_disease_15class/rice-disease-15class-v3-exp20`.
  `KRISIVEDA_DISEASE_V2_MODEL_DIR` overrides it; relative values resolve beneath
  `KRISIVEDA-ML`, not beneath the frontend or `public` directory.
- The loader requires exactly one `.onnx` plus its adjacent
  `model_metadata.json`, matching the 15-class taxonomy and ONNX output width.
  It uses `CPUExecutionProvider` and reports `production: false`.
- The earlier warmstart runtime observation is consistent with this configurable
  loader. The warmstart metadata records
  `KRISIVEDA-ML/models/rice_disease_warmstart_v1/best.pt`, epoch 30, as its export
  source. Merely adding a browser copy does not change the backend environment or
  default directory.
- **HTTP V2 is not the historical directory named
  `rice-disease-15class-v2`.** The HTTP loader explicitly rejects the historical
  `MODEL_ROOT` directory. Neither is the new selector string `browser-v2` an alias
  for that directory or the existing API selector `v2`.

Older README/metadata text saying that all 15-class work is "not wired into
app.main" is stale for these additive HTTP V2 routes. Actual imports, routes, and
loader configuration are the evidence; do not rewrite preserved metadata merely
to update that prose.

### H: historical 15-class v2 and experiment comparisons

- [app/rice_disease_15class/config.py](../app/rice_disease_15class/config.py)
  defines historical `MODEL_ROOT` and `MODEL_VERSION` as
  `rice-disease-15class-v2`.
- [app/rice_disease_15class/inference.py](../app/rice_disease_15class/inference.py)
  is the standalone loader for that ONNX/metadata pair. Importing its threshold
  constant from the HTTP V2 service does not select or load its old ONNX.
- [scripts/train_rice_disease_15class.py](../scripts/train_rice_disease_15class.py),
  [scripts/evaluate_rice_disease_15class.py](../scripts/evaluate_rice_disease_15class.py),
  and [scripts/export_rice_disease_15class_onnx.py](../scripts/export_rice_disease_15class_onnx.py)
  default to the historical directory or its `best.pt`. Explicit checkpoint,
  output, and version options support separate experiments. These are consumer
  references, not instructions to train or export anything for Pages.
- [scripts/compare_rice_disease_versions.py](../scripts/compare_rice_disease_versions.py)
  defaults to historical v2 as baseline and v3-exp20 as candidate.
  [scripts/audit_root_cause_15class.py](../scripts/audit_root_cause_15class.py)
  also defaults to v3-exp20 and its `best.pt`.

### S/W: scratch, smoke, and warmstart provenance

- [scripts/train_rice_disease_scratch.py](../scripts/train_rice_disease_scratch.py)
  defines `rice-disease-scratch-v1` and `rice-disease-warmstart-v1`, with separate
  output roots. `--output-dir`, `--smoke`, and `--init-from` explain the existing
  scratch/smoke/warmstart artifacts. Warm starts are not exact resumes of the old
  scratch optimizer/schedule.
- [models/rice_disease_warmstart_v1/previous_run.json](../models/rice_disease_warmstart_v1/previous_run.json)
  records `models/rice_disease_scratch_v1/last.pt`, epoch 3, as the source. Its
  recorded hash matches the existing source file:
  `db9cc5f68b813b0892149b1c1aac65d18d3aed7118f0ec636a3f65be10cbe9f2`.
- The warmstart training configuration records early stopping; its best
  checkpoint is epoch 30 and latest checkpoint epoch 38. The smoke directories
  are plumbing runs, not production selections. No HTTP loader automatically
  chooses a checkpoint by filename, timestamp, size, or validation score.

## 4. Original companion files and Git preservation

The following accounts for all **37 original non-weight files** under
`KRISIVEDA-ML/models`. Filenames in the middle column are relative to the directory
in the first column; all sizes are bytes. Current ignore rules also cover the
scratch and warmstart training directories, including companion files that were
untracked-but-not-ignored during the earlier read-only inventory.

| Directory | Existing companion files and exact bytes | Git status |
| --- | --- | --- |
| `KRISIVEDA-ML/models/` | `class_names.json` 119 | T; required V1 output order |
| `KRISIVEDA-ML/models/rice_disease_15class/rice-disease-15class-v2/` | `class_mapping.json` 6,216; `model_metadata.json` 6,204; `onnx_parity.json` 825; `training_config.json` 1,858; `training_history.csv` 806; `training_history.json` 6,498; `training.log` 22,982 | All I |
| `KRISIVEDA-ML/models/rice_disease_15class/rice-disease-15class-v3-exp20/` | `class_mapping.json` 6,222; `model_metadata.json` 6,075; `onnx_parity.json` 822; `training_config.json` 1,835; `training_history.csv` 1,893; `training_history.json` 16,258; `training.log` 49,975 | Metadata T; others I |
| `KRISIVEDA-ML/models/rice_disease_15class/rice-disease-warmstart-v1/` | `model_metadata.json` 39,030; `onnx_parity.json` 826 | Both I |
| `KRISIVEDA-ML/models/rice_disease_scratch_gpu_smoke/` | `class_mapping.json` 6,295; `training_config.json` 3,010; `training_history.csv` 121; `training_history.json` 686; `training.log` 1,465 | All I |
| `KRISIVEDA-ML/models/rice_disease_scratch_smoke/` | `training.log` 1,086 only | I; no checkpoint/export exists here |
| `KRISIVEDA-ML/models/rice_disease_scratch_smoke_v2/` | `class_mapping.json` 6,295; `training_config.json` 2,913; `training_history.csv` 120; `training_history.json` 685; `training.log` 1,419 | All I |
| `KRISIVEDA-ML/models/rice_disease_scratch_v1/` | `training_history.csv` 245; `training_history.json` 2,198; `training.log` 8,465 | All I; no adjacent training config or class mapping |
| `KRISIVEDA-ML/models/rice_disease_warmstart_v1/` | `class_mapping.json` 6,297; `previous_run.json` 3,864; `training_config.json` 32,782; `training_history.csv` 2,653; `training_history.json` 26,838; `training.log` 76,667 | All I |

The four existing backend runtime files below remain tracked and were verified
unchanged from `HEAD` during documentation preparation:

1. `KRISIVEDA-ML/models/rice_disease_model.onnx`
2. `KRISIVEDA-ML/models/class_names.json`
3. `KRISIVEDA-ML/models/rice_disease_15class/rice-disease-15class-v3-exp20/rice_disease_15class.onnx`
4. `KRISIVEDA-ML/models/rice_disease_15class/rice-disease-15class-v3-exp20/model_metadata.json`

[.gitignore](../../.gitignore) excludes training checkpoints, datasets, scratch
runs/logs, reports, and local environments, while retaining these backend runtime
files and allowing only the selected static model files. Ignored artifacts remain
part of the preservation set; ignoring them is neither deletion nor a backup.
A clean checkout does not contain the ignored originals/checkpoints. Do not
untrack working backend files or publish whole training directories to compensate.

## 5. Static warmstart copy: originals versus publication assets

The only model selected for the static site is
`public/models/rice-disease-warmstart-v1/`. It contains exactly the following five
files; the first four were copied byte-for-byte, without re-exporting the ONNX or
rewriting the training metadata:

| Static path | Bytes | Original source / purpose |
| --- | ---: | --- |
| `public/models/rice-disease-warmstart-v1/rice_disease_15class.onnx` | 6,142,549 | `KRISIVEDA-ML/models/rice_disease_15class/rice-disease-warmstart-v1/rice_disease_15class.onnx` |
| `public/models/rice-disease-warmstart-v1/model_metadata.json` | 39,030 | `KRISIVEDA-ML/models/rice_disease_15class/rice-disease-warmstart-v1/model_metadata.json` |
| `public/models/rice-disease-warmstart-v1/onnx_parity.json` | 826 | `KRISIVEDA-ML/models/rice_disease_15class/rice-disease-warmstart-v1/onnx_parity.json` |
| `public/models/rice-disease-warmstart-v1/class_mapping.json` | 6,297 | `KRISIVEDA-ML/models/rice_disease_warmstart_v1/class_mapping.json` (the training class map) |
| `public/models/rice-disease-warmstart-v1/manifest.json` | 732 | New publication integrity manifest: schema 1, version, 15 classes, threshold 0.6, and sizes/hashes of the four copied files |

The four copied artifacts total **6,188,702 bytes** excluding the manifest.
[manifest.json](../../public/models/rice-disease-warmstart-v1/manifest.json) records:

| Copied filename | SHA-256 |
| --- | --- |
| `rice_disease_15class.onnx` | `5593156d6da4c35132248e1aafcce6b8294e8cdf66f4255ca91db5d95c8fa12a` |
| `model_metadata.json` | `d2ad6f1b080284bc74e745242a9b6588a6d60b15058cbead347270b758a61539` |
| `onnx_parity.json` | `645ed39572fef9e0c3fff64e63375acf4d287c3a571b4f95bb2b980cb71a9a52` |
| `class_mapping.json` | `1173b26ddeab918ef19a8d213143dff5c9c9c1fff1eb66cd7cd013b3f90a1109` |

File sizes, manifest hashes, and byte-for-byte agreement with all four sources
were checked during documentation preparation. In particular, the original
warmstart ONNX checksum remains **`559315...fa12a`**, with the full value above.
This integrity check does not execute the model or establish browser correctness.

Publication policy:

- **Keep the originals at their original paths and unchanged.** The public files
  are copies, not moves, replacements, regenerated exports, or permission to
  discard training checkpoints/provenance.
- Do not rewrite either metadata copy to change source paths or parity claims.
  Embedded training/checkpoint paths are provenance, not HTTP asset URLs. Browser
  asset paths must instead derive from the frontend deployment base.
- The static model allowlist is exactly these four artifacts plus `manifest.json`.
  The six-class backend export, historical v2, v3-exp20, all `.pt`/`.pth`/`.ckpt`
  files, training/source dataset images, reports, scratch logs, caches, and virtual
  environments do **not** belong in the static deployment bundle. This does not
  remove or untrack the preserved backend production models.
- Vite copies `public` into its build output. **Git ignore rules alone do not
  prevent a locally present file from being bundled.** The parent integration's
  bundle allowlist must enforce the same policy. The existing
  [scripts/verify-browser-model.mjs](../../scripts/verify-browser-model.mjs) contains
  exact model-file allowlist, hash, mapping, and site-tree checks; this document
  does not claim a completed production build or browser-test run.
- Existing UI/reference images such as `public/Disease/` are not model weights or
  a model taxonomy. Do not confuse them with training/source dataset images or
  remove them as part of model packaging.

The earlier inventory found no weights under `public`. This additive five-file
set is now present; no other original model has been selected for publication.
Presence under `public` is not evidence that it has been deployed to live Pages.

## 6. Taxonomies and selector identities must remain separate

V1's six-class output order comes from
[models/class_names.json](../models/class_names.json):

```text
0 bacterial_leaf_blight
1 brown_spot
2 healthy_rice_leaf
3 leaf_blast
4 leaf_scald
5 sheath_blight
```

The 15-class output order is the canonical `CLASS_IDS` order in
[app/rice_disease_15class/taxonomy.py](../app/rice_disease_15class/taxonomy.py),
recorded in the model's own metadata and copied training class map:

```text
0  bacterial_leaf_blight
1  bacterial_leaf_streak
2  bacterial_panicle_blight
3  bacterial_stripe_disease
4  brown_spot
5  dead_heart
6  downy_mildew
7  healthy_rice_leaf
8  hispa
9  leaf_blast
10 leaf_smut
11 leaf_roller
12 tungro
13 white_stem_borer
14 yellow_stem_borer
```

Never use the six-class mapping to label a 15-class output, sort the class IDs,
or infer output order from gallery images, display names, filenames, or source
folder names. `leaf_scald` and `sheath_blight` are V1 labels, not entries in this
15-class taxonomy. The latter mixes disease, pest/symptom, and healthy labels;
`dead_heart` is a damage symptom, not a separate pathogen. These are dataset
classification labels, not confirmed diagnoses, treatment prescriptions, nutrient
predictions, or yield estimates.

| Frontend selector | Execution target | Identity / selection rule |
| --- | --- | --- |
| `v1` | Existing Python `/disease/predict` API | Six-class production classifier; **unchanged default** |
| `v2` | Existing Python `/disease/v2/predict` API | Configurable 15-class backend; v3-exp20 code default, warmstart only when explicitly configured |
| `browser-v2` | Additive local ONNX Runtime Web/WASM browser path | **Browser Model (15 Classes)**; explicit choice of the unchanged public warmstart copy; parent browser tests pending |

The browser selector must be handled explicitly, not treated as an alias for
`v2` or allowed to fall through the legacy unknown-selector-to-V1 behavior.
Neither API V2 availability nor a browser failure authorizes silently selecting a
different model. Keep backend error/unavailable states explicit; any switch to
another model must be an explicit user selection with the correct identity.
No model is automatically substituted, promoted, or deleted.

## 7. GitHub Pages, API deployment, and environment settings

GitHub Pages serves **`dist` as static files**. It does not run FastAPI, PyTorch,
or a Python inference process. [vite.config.js](../../vite.config.js) sets the
Pages base to **`/Agri_Dr/`**. Browser model and local ORT Web/WASM asset URLs must
respect that base rather than assuming the host root or a source filesystem path.
For example, the model URL derives from `BASE_URL`:

```js
const modelUrl = `${import.meta.env.BASE_URL}models/rice-disease-warmstart-v1/rice_disease_15class.onnx`;
```

Use the same base-aware resolution for manifest/metadata/class-map URLs and the
locally bundled ONNX Runtime Web/WASM assets. The public ONNX is served as
`/Agri_Dr/models/rice-disease-warmstart-v1/rice_disease_15class.onnx`; the `public`
segment is not part of its URL. The browser path uses the static copy, not a
checkpoint and not a Python API request. This is the integration contract, not a
claim that WASM loading or inference has passed browser tests.

**V1 and backend V2 still require the separately running Python API.** The new
static copy does not replace those routes, launch Python on Pages, or redirect
existing API calls to local inference.

| Environment name | Consumer / purpose |
| --- | --- |
| `VITE_KRISIVEDA_ML_API_URL` | Existing frontend Python API base. `cropAnalysisService.js` falls back to `https://krisiveda-ml-api.onrender.com` and protects production from a configured loopback URL. Production V1 and backend V2 retain this API routing. |
| `VITE_KRISIVEDA_ML_V2_API_URL` | Development-only Vite V2 proxy target; defaults to `http://127.0.0.1:8001`. Not a production Pages proxy or a browser-model selector. |
| `KRISIVEDA_DISEASE_V2_MODEL_DIR` | Backend V2 directory override; unset selects v3-exp20. Does not configure the browser copy. |
| `KRISIVEDA_ML_CORS_ORIGINS` | Explicit comma-separated frontend origins for FastAPI; `*` is rejected. A browser origin is scheme plus host/port, not the `/Agri_Dr/` path. |
| `PORT` | Hosting port used by the Render start command. |

[render.yaml](../render.yaml) uses root directory `KRISIVEDA-ML`, installs
`requirements.txt`, and starts `uvicorn app.main:app`; its declared environment
entry is `KRISIVEDA_ML_CORS_ORIGINS`. It does not train/export weights or set the
V2 override. Production requirements use Python ONNX Runtime; training/export
dependencies remain separate in `requirements-train.txt`.

The development proxy is `/Agri_Dr/api/disease/v2`, forwarding to the separately
running local backend. It is not available on static production Pages. A local
warmstart runtime at port 8001 therefore says nothing about which model a remote
Render service is serving. A fresh backend checkout still gets the tracked V1
and v3-exp20 pairs; selecting an ignored original warmstart directory remotely
requires explicitly making that backend artifact pair available. Publishing its
browser copy does not automatically change the backend loader path.

## 8. Absent yield artifact and static fertilizer caveats

[app/predictor.py](../app/predictor.py) references these paths, all absent at the
inventory snapshot:

- `KRISIVEDA-ML/models/yield_model.joblib`
- `KRISIVEDA-ML/models/yield_model.metadata.json`
- `KRISIVEDA-ML/models/yield_model.verified`
- `KRISIVEDA-ML/data/verified_baseline.csv`
- `KRISIVEDA-ML/data/verified_baseline.verified`

`GET /model/status` and `POST /predict` are separate from disease inference.
The artifact availability guard requires metadata with `serving_supported: true`
and a verification marker; the current yield serving adapter remains a
placeholder, not a way to serve disease weights as farm-yield predictions.
[scripts/train_model.py](../scripts/train_model.py) delegates to
[app/training.py](../app/training.py), which can write a joblib artifact and
metadata but deliberately records `serving_supported: false`. Referencing a
filename does not establish that a trained model exists.

The working regional-baseline feature instead reads
`KRISIVEDA-ML/data/regional_rice_statistics.csv` (**2,252 bytes**) through
[app/regional_baseline.py](../app/regional_baseline.py) and the
`/regional-baseline` and `/regional-baseline/estimate` routes. Its frontend
consumer is [regionalBaselineService.js](../../src/services/regionalBaselineService.js)
via [Improve.jsx](../../src/pages/Improve.jsx). Preserve that CSV/API; the
calculation is an aggregate historical reference, not farm-specific learned
inference.

[Fertilizer.jsx](../../src/pages/Fertilizer.jsx) imports `fertilizerData` from
`src/data/mockData.js`, product catalogs from `src/data/marketCatalog.js`, and area
conversion from `src/lib/financeCalc.js`. Its calculator multiplies a configured
land-area rate by converted area; it does not load saved nutrient/fertilizer
weights or call a corresponding ML route. Preserve those working records,
catalogs, and calculations. Other mock helpers such as
`src/data/mockData.js`'s `analyzeCropImage` are not the real camera consumer, which
imports `cropAnalysisService.js`.

No additional saved model artifacts were found in the other relevant project
locations scanned during the original inventory; specifically, no joblib/pickle,
Keras, TensorFlow Lite, or safetensors model was found outside the listed ONNX/PT
artifacts. The new public ONNX is the documented byte-identical duplicate, not an
additional historical model.

## 9. Validation boundary: existing CPU parity is not Web certification

The copied [onnx_parity.json](../../public/models/rice-disease-warmstart-v1/onnx_parity.json)
is a **pre-existing** PyTorch/ONNX CPU parity record. It reports 128 samples,
class agreement 1.0, and differences within `atol: 0.0001`, and explicitly notes
that both runtimes consumed the same float32 tensor and ONNX Runtime used the
CPU execution provider. These are recorded results, not tests rerun for this
document.

That record does **not** certify JavaScript image preprocessing, browser image
decoding, ONNX Runtime Web/WASM execution, asset delivery beneath `/Agri_Dr/`,
selector behavior, or end-to-end browser predictions. Byte-identical files and a
matching manifest also do not establish any of those properties. Detailed
warmstart preprocessing/parity review belongs to the separate audit; browser
validation remains pending the parent's tests. Do not change the original or
copied parity record to imply Web validation.

Documentation preparation used read-only file enumeration, exact byte sizes,
SHA-256 comparisons, JSON parsing, static checkpoint ZIP/pickle-opcode inspection,
source-reference tracing, and Git tracking/ignore/diff checks. It did not load
checkpoint objects, execute inference, run training/evaluation/export scripts,
run a build or browser tests, deploy, commit, or push. The only file authored for
this documentation task is `KRISIVEDA-ML/docs/model_inventory.md`.

## 10. Preservation checklist

1. Preserve all 16 original weights, their original paths, all 37 companion files,
   and the six-class/15-class mappings. Not selected, ignored, historical, or
   smoke-only does not mean disposable.
2. Preserve the four tracked backend runtime files and the existing working
   disease, fertilizer, and regional-baseline features. Do not repurpose their
   endpoints or untrack their models to shrink the static site.
3. Keep the public warmstart copy additive and byte-identical to its originals;
   retain the four-file hashes and manifest. No retraining, re-export,
   quantization, normalization of metadata, weight editing, or automatic model
   upgrades are authorized.
4. Enforce the five-file static model allowlist. Exclude training checkpoints,
   source dataset images, scratch logs, reports, and environments from `dist`
   without deleting them from their original locations.
5. Keep `v1` the default. Keep `v1`, backend `v2`, and `browser-v2` explicit and
   distinct; do not silently substitute models or convert failures into another
   model's apparently successful result.
6. Preserve class order and model/version identity. Never combine V1's six-class
   mapping with any 15-class output or treat reference-gallery images as labels.
7. Keep CPU parity provenance separate from pending Web/browser validation.
   Do not advertise browser parity, accuracy, or successful deployment on the
   basis of this inventory.
8. No model/file deletion, cleanup, deploy, commit, or push is implied by this
   document. In particular, old rollback prose suggesting deletion does not
   override these preservation constraints.
