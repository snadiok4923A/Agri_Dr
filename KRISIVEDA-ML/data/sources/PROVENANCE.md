# Official rice-yield source review

Reviewed: 2026-10-13

## Downloaded official publication

- **Title:** Agricultural Statistics at a Glance 2024-25 (English)
- **Publisher:** Department of Agriculture & Farmers Welfare, Government of
  India / Directorate of Economics & Statistics
- **Exact URL:** <https://agriwelfare.gov.in/Documents/CWWGDATA/Agricultural_Statisitcs_at_a_Glance_2024_25_En.pdf>
- **Local preserved copy:** `Agricultural_Statistics_at_a_Glance_2024_25_En.pdf`
- **SHA-256:** `BCB1B9E0DA1B9B4EAF687D4F833CE506707D564388237844C69AE27B0E8EFF17`
- **Publication:** 2024-25 edition
- **Coverage:** India and state-level agricultural statistics, including
  principal-crop area, production, and yield tables where provided by the
  publication
- **Units:** The publication tables must be read table-by-table; reported
  area, production, and yield units are not assumed to be uniform across all
  tables. No values have been copied into the training CSV.
- **License/usage terms:** No explicit machine-readable license was available
  from the downloaded PDF or verified during this review. Treat it as an
  official government publication for research/reference and verify current
  reuse terms before redistribution.

This is aggregate regional/state statistics. It is **not** an individual farm
harvest dataset and is not eligible for farm-level supervised training.

## Official data.gov.in source

- **Catalog:** <https://www.data.gov.in/catalog/district-wise-season-wise-crop-production-statistics-0>
- **Related collection:** <https://data.gov.in/collections/state-district-and-season-wise-area-production-and-yield-statistics-for-each-crop>
- **Publisher:** Open Government Data (OGD) Platform India
- **Geographic coverage:** State/district, including West Bengal districts
- **Time/season coverage:** The catalog describes crop-, district-, season-, and
  year-wise observations; the exact resource version and coverage must be
  recorded after selecting a resource on the catalog page.
- **Expected measures:** Area and production, with yield where the selected
  resource exposes it. The exact resource schema and units must be verified
  before mapping.
- **Access result:** The catalog returned HTTP 403 from this environment, so no
  data.gov.in resource file or resource UUID was downloaded.
- **License/usage terms:** Verify the terms displayed on the selected OGD
  resource page before redistribution.

### Manual data.gov.in download instructions

1. Open the catalog URL above.
2. Select the resource covering district/season/year-wise rice area,
   production, and yield.
3. Record the resource UUID, title, publisher, last update, coverage years,
   West Bengal geographic scope, and displayed units.
4. Download the CSV/XLS/ZIP using the portal's download control, or request an
   API key and use the resource-specific API URL shown on the resource page.
5. Preserve the downloaded original under `data/sources/` unchanged.
6. Validate the original with `scripts/validate_dataset.py` only after a
   documented transformation. Keep district/state rows in a separate
   aggregate file; never rename them to `observation_level=farm`.

## Eligibility decision

No downloaded source currently meets the canonical farm-level training
contract. The DES publication and data.gov.in catalog are retained as
regional-baseline/research resources only. The prediction API must remain
`unavailable` until verified individual-farm harvest records or a separately
defined, defensible regional prediction method is available.
