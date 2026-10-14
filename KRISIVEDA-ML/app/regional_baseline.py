"""Transparent regional rice-yield reference calculations.

This module uses only the explicitly published West Bengal aggregate rows.
It is intentionally separate from ``predictor.py``: a regional statistic is
not a farm-specific prediction and must not activate the farm ML API.
"""

from csv import DictReader
from dataclasses import dataclass
from pathlib import Path


REGIONAL_STATISTICS_PATH = (
    Path(__file__).resolve().parent.parent / "data" / "regional_rice_statistics.csv"
)
SUPPORTED_AREA_UNITS = {"hectare", "acre"}
ACRE_TO_HECTARE = 0.40468564224


class RegionalBaselineUnavailableError(RuntimeError):
    """Raised when the verified regional source cannot be loaded."""


@dataclass(frozen=True)
class RegionalStatistic:
    geography: str
    reporting_period: str
    yield_kg_per_hectare: float
    source_file: str
    source_url: str
    source_page: int
    table_title: str


@dataclass(frozen=True)
class RegionalEstimate:
    statistic: RegionalStatistic
    farm_area: float
    farm_area_unit: str
    area_hectares: float
    illustrative_production_tonnes: float
    label: str = "illustrative regional estimate, not expected or guaranteed farm production"


def _load_west_bengal_statistics(
    path: Path = REGIONAL_STATISTICS_PATH,
) -> list[RegionalStatistic]:
    if not path.is_file():
        raise RegionalBaselineUnavailableError(
            f"Verified regional statistics file is unavailable: {path}"
        )
    try:
        with path.open(newline="", encoding="utf-8") as source:
            rows = list(DictReader(source))
        statistics = [
            RegionalStatistic(
                geography=row["geography"],
                reporting_period=row["reporting_period"],
                yield_kg_per_hectare=float(row["yield"]),
                source_file=row["source_file"],
                source_url=row["source_url"],
                source_page=int(row["source_page"]),
                table_title=row["table_title"],
            )
            for row in rows
            if row.get("geography") == "West Bengal"
            and row.get("geographic_level") == "state"
            and row.get("crop") == "Rice"
            and row.get("yield_unit") == "kg_per_hectare"
        ]
    except (OSError, KeyError, TypeError, ValueError) as exc:
        raise RegionalBaselineUnavailableError(
            "Verified regional statistics could not be read or contain invalid fields."
        ) from exc
    if not statistics:
        raise RegionalBaselineUnavailableError(
            "No verified West Bengal rice statistics are available."
        )
    return statistics


def latest_west_bengal_statistic(
    path: Path = REGIONAL_STATISTICS_PATH,
) -> RegionalStatistic:
    """Return the latest reported statistic without inventing missing years."""

    statistics = _load_west_bengal_statistics(path)
    return max(statistics, key=lambda statistic: statistic.reporting_period)


def convert_area_to_hectares(area: float, unit: str) -> float:
    """Convert only units with an explicit, stable conversion."""

    if area <= 0:
        raise ValueError("Farm area must be greater than zero.")
    if unit == "hectare":
        return area
    if unit == "acre":
        return area * ACRE_TO_HECTARE
    raise ValueError(
        f"Area unit '{unit}' is not supported for this regional estimate."
    )


def estimate_regional_production(
    farm_area: float,
    area_unit: str,
    path: Path = REGIONAL_STATISTICS_PATH,
) -> RegionalEstimate:
    statistic = latest_west_bengal_statistic(path)
    area_hectares = convert_area_to_hectares(farm_area, area_unit)
    production = area_hectares * statistic.yield_kg_per_hectare / 1000
    return RegionalEstimate(
        statistic=statistic,
        farm_area=farm_area,
        farm_area_unit=area_unit,
        area_hectares=area_hectares,
        illustrative_production_tonnes=production,
    )
