# Regional rice statistics extracted from the official publication

## Source

- **Publication:** *Agricultural Statistics at a Glance, 2024-25*
- **Publisher:** Department of Agriculture & Farmers Welfare / Directorate of
  Economics & Statistics, Government of India
- **Exact URL:** <https://agriwelfare.gov.in/Documents/CWWGDATA/Agricultural_Statisitcs_at_a_Glance_2024_25_En.pdf>
- **Preserved source:** `data/sources/Agricultural_Statistics_at_a_Glance_2024_25_En.pdf`
- **Source SHA-256:** `BCB1B9E0DA1B9B4EAF687D4F833CE506707D564388237844C69AE27B0E8EFF17`
- **Extraction method:** `pypdf` text extraction followed by manual verification
  of the table heading, row labels, column order, and units in the preserved
  PDF. Values are direct transcriptions; no aggregate row was relabeled as a
  farm record.

## Extracted table

The extracted rows are in [regional_rice_statistics.csv](regional_rice_statistics.csv).

- **Table:** 2.4(b), “Rice: Area, Production and Yield during 2023-24 and
  2024-25 in major Producing States alongwith coverage under Irrigation”
- **PDF page:** 80
- **Geographic levels:** West Bengal state and All India
- **Reporting periods:** 2023-24 and 2024-25
- **Area:** million hectares
- **Production:** million tonnes
- **Yield:** kg/hectare
- **Additional source fields:** percentage share of All-India area and
  production, and irrigation coverage percentage

The all-India time series for rice is also continued in Table 2.4(a) on PDF
pages 77-79. The 2023-24 and 2024-25 All India values in the CSV are
cross-checked against the All India row on page 80.

## Yield verification

Yield is explicitly reported in the source. It does not need to be inferred.
As a consistency check only:

- West Bengal 2023-24:
  `15.69 million tonnes / 5.12 million hectares = 3.06445 tonnes/hectare`,
  equivalent to approximately `3064 kg/hectare`, matching the reported value.
- West Bengal 2024-25:
  `16.02 / 5.59 = 2.86583 tonnes/hectare`, equivalent to approximately
  `2866 kg/hectare`; the table reports `2865 kg/hectare`. The small difference
  is consistent with rounded published area and production values. The
  reported yield is retained unchanged.

The same calculation is not used to replace any published yield value.

## Eligibility and limitations

These are state-level and national aggregates. They are useful for regional
descriptive analysis or a future regional baseline, but they are not
individual-farm harvest observations. They contain no farmer, farm, or parcel
identifiers and no farm-level input history. They must not be placed in the
farm-level training CSV and cannot establish farm-level prediction accuracy.

The publication's reuse/license terms were not available as an explicit
machine-readable license in this review. Verify current terms before
redistribution.
