# Rice-yield dataset contract

Training input is a CSV containing one row per **verified individual farm
harvest record**. This repository intentionally contains no harvest rows.

District-level averages may be stored separately for future district-level
analysis, but they must not be mixed into this file or used as individual-farm
ground truth.

The official aggregate extraction from *Agricultural Statistics at a Glance,
2024-25* is stored separately in
[regional_rice_statistics.csv](regional_rice_statistics.csv) with its
documentation in [regional_rice_statistics.md](regional_rice_statistics.md).
It is not eligible for this farm-level training contract.

## Required columns

| Column | Type | Required value |
| --- | --- | --- |
| `record_id` | string | Stable unique record identifier |
| `observation_level` | string | Must be `farm` for supervised training |
| `target_yield` | number | Harvest yield in tonnes per hectare |
| `target_yield_unit` | string | Must be `tonnes_per_hectare` |
| `harvested_area` | number | Harvested area in hectares |
| `harvested_area_unit` | string | Must be `hectare` |
| `production` | number | Harvest production in tonnes |
| `production_unit` | string | Must be `tonne` |
| `year` | integer | Harvest year |
| `season` | string | Season identifier |
| `district` | string | Source district |
| `source` | string | Provenance or source citation |
| `data_quality_status` | string | Must be `verified` for training |

## Optional feature columns

```text
crop
rice_variety
growth_stage
temperature_mean_c
humidity_mean_pct
precipitation_total_mm
rain_probability_mean_pct
fertilizer_kg_per_hectare
medicine_applications
```

All numeric values must be finite and non-negative unless the validator
explicitly documents another range. `production` should equal
`target_yield * harvested_area` within the validator tolerance. A source that
uses other units must be normalized before it is supplied to this pipeline;
the validator rejects mixed or non-canonical units rather than guessing a
conversion.

## Training safeguards

The training command only proceeds when:

- every required column exists;
- every row is a verified farm-level observation;
- no required value is missing or invalid;
- record IDs and farm harvest identities are not duplicated;
- at least two year/season groups exist;
- the final year/season group is held out as the test set.

The test split is the latest year/season group, not a random row split. This
reduces season leakage. A small or single-season dataset is rejected rather
than evaluated with an unsupported claim.

## Data collection

Use the documented [verified rice-farm harvest data collection
workflow](collection_workflow.md) before adding any rows. It requires an
auditable source record and reviewer verification; the `source` CSV field is
provenance, not a substitute for retaining that evidence. Do not use the
official aggregate regional CSV as farm training data.
