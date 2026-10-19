# Verified rice-farm harvest data collection workflow

This workflow is the gate for adding records to
`rice_yield_template.csv`. It is for real, individual-farm rice harvests
only. Do not fill the template with estimates, examples, copied regional
averages, or generated records.

## 1. Collect the source record

For each harvested farm plot or farm harvest, retain the original source
material outside the training CSV and assign a stable `record_id`. Suitable
source material may include a signed harvest register, a weighbridge receipt,
an agronomist-verified field sheet, or another auditable farm record. Record
the source name or citation in `source` and preserve enough information to
locate the original record.

The source must identify an individual farm or plot and a harvest, not only a
district, state, cooperative total, survey average, or other aggregate. Do
not relabel an aggregate row as `observation_level=farm`.

## 2. Verify the harvest measurements

Before transcription, a reviewer must confirm:

1. the crop is rice and the rice variety is recorded when known;
2. harvested area is the measured area for that farm harvest, with its
   original unit retained in the source and normalized to hectares in the
   CSV;
3. production is the harvested quantity, with its original unit retained in
   the source and normalized to tonnes in the CSV;
4. harvest year and season match the source record and district is the
   farm’s source district; and
5. yield is calculated from the verified production and harvested area, or
   directly reconciled to a verified yield measurement.

Set `data_quality_status=verified` only after these checks pass. A citation in
`source` does not by itself make a row verified; the source record and the
review decision must be retained by the data steward.

## 3. Record relevant inputs without guessing

Copy measured or documented inputs when available: variety, growth stage,
temperature, humidity, precipitation, rain probability, fertilizer quantity,
and medicine applications. Leave optional columns blank when the source does
not provide them. Never infer an input from a regional statistic or invent a
value to complete a row.

The current contract does not require a farmer’s identity or expose one to the
model. Use a non-identifying record identifier and keep any linkage to
source documents in the controlled collection system, not in this repository.
If repeated harvests from the same farm are collected, the steward should
retain that linkage so future validation can use farm-grouped evaluation.

## 4. Normalize and load the canonical CSV

Create a copy of the template and populate one row per verified farm harvest.
Normalize units before validation:

- `target_yield_unit=tonnes_per_hectare`
- `harvested_area_unit=hectare`
- `production_unit=tonne`

Check that `production` equals `target_yield * harvested_area` within the
validator tolerance. Preserve the original source files unchanged and keep a
transformation note for any unit conversion.

Run:

```powershell
python scripts/validate_dataset.py path\to\verified_rice_yield.csv
```

Do not train if the command exits non-zero. In particular, reject duplicate
record identities, missing required values, non-canonical units, unverified
rows, and any row whose `observation_level` is not `farm`.

## 5. Review training eligibility

Keep `data/regional_rice_statistics.csv` and other district/state datasets in
their separate aggregate files. Those data are valid for the regional
baseline, but are not eligible as farm-level labels because they have no
farm/plot identity or farm-level inputs.

Training also requires at least two year/season groups. The pipeline holds out
the latest group, compares the mean baseline with Ridge and random forest
regression, and reports MAE and RMSE (plus R² when defined). The selected
model must improve on the mean baseline for the agreed evaluation criterion;
otherwise retain the baseline decision and do not claim a useful farm model.

## 6. Preserve review evidence and keep serving disabled

For every candidate dataset, retain the validation report, dataset identifier,
source list, transformation notes, reviewer decision, split description, and
metrics. A successful training run writes `serving_supported=false` by
design. Do not create a `.verified` marker, change serving metadata, activate
`/predict`, or deploy until model validation and the inference/serving adapter
have been separately reviewed.
