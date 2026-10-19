# Farmer and field-worker collection guide

Use [rice_farm_collection_sheet.csv](rice_farm_collection_sheet.csv) as a
blank entry sheet. It has the exact same 22-column header and column order as
[rice_yield_template.csv](rice_yield_template.csv), so a reviewed copy can be
validated by the existing pipeline without renaming columns.

Each completed row must describe one real, individual rice-farm harvest. Do
not enter state, district, cooperative, survey-average, or other aggregate
statistics. Do not enter guessed, simulated, or example values.

## Required fields in simple terms

| CSV column | When collected | What to enter |
| --- | --- | --- |
| `record_id` | Before entry | A stable non-identifying code for this one harvest record, such as a code assigned by the data steward |
| `observation_level` | Before entry | Enter exactly `farm` |
| `target_yield` | **After harvest** | Verified yield in tonnes per hectare; calculate from verified production and harvested area when needed |
| `target_yield_unit` | **After harvest** | Enter exactly `tonnes_per_hectare` |
| `harvested_area` | **After harvest** | The measured area harvested for this record, converted to hectares |
| `harvested_area_unit` | **After harvest** | Enter exactly `hectare` |
| `production` | **After harvest** | The verified harvested rice quantity, converted to tonnes |
| `production_unit` | **After harvest** | Enter exactly `tonne` |
| `year` | **After harvest** | The harvest year as a four-digit number |
| `season` | During harvest record | The source record’s season name, such as `kharif`; do not guess |
| `district` | During field registration | The district where the farm or plot is located |
| `source` | During entry | A citation or reference to the original register, receipt, or field sheet; this is not the evidence file itself |
| `data_quality_status` | After review | Enter exactly `verified` only after a reviewer checks the source and measurements |

The four harvest measurements (`target_yield`, both area fields, and both
production fields) must come from the actual harvest record. They must not be
copied from a regional statistic.

## Optional cultivation and input fields

These fields describe conditions or management during cultivation. Record them
only when documented by a field log, measurement, or other source. Leave them
blank when unknown; never fill them from memory or a regional average.

| CSV column | When collected | What to enter |
| --- | --- | --- |
| `crop` | Before or during cultivation | The crop; for this collection use `rice` |
| `rice_variety` | Before planting | The documented rice variety |
| `growth_stage` | During cultivation | The documented stage when the observation was made |
| `temperature_mean_c` | During cultivation | Documented mean temperature in degrees Celsius for the relevant period |
| `humidity_mean_pct` | During cultivation | Documented mean relative humidity as a percentage |
| `precipitation_total_mm` | During cultivation | Documented total precipitation in millimetres for the relevant period |
| `rain_probability_mean_pct` | During cultivation | Documented mean rain probability as a percentage |
| `fertilizer_kg_per_hectare` | During cultivation | Documented fertilizer amount normalized to kilograms per hectare |
| `medicine_applications` | During cultivation | Count of documented medicine applications |

## Safe entry order

1. Create a non-identifying `record_id` and enter the farm, district, season,
   and any documented cultivation fields.
2. Keep the original source document unchanged and record its reference in
   `source`.
3. After harvest, enter measured harvested area and production, normalize the
   units, and calculate or reconcile yield.
4. Have a reviewer compare the row with the original source. Only then set
   `data_quality_status` to `verified`.
5. Run the validator before sharing the dataset:

   ```powershell
   python scripts/validate_dataset.py path\to\completed_sheet.csv
   ```

Do not add farmer names, phone numbers, addresses, government IDs, or other
direct identities to this training CSV. Keep the source documents, any
controlled linkage between `record_id` and a farm, the reviewer identity, the
verification date, and the review decision in a restricted collection system.
The CSV should retain only the non-identifying record code and the `source`
reference needed for audit.

The completed sheet is still only a candidate dataset until validation,
leakage-aware evaluation, and model-serving review are finished. It does not
activate `/predict`.
