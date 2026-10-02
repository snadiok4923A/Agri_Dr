import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "../hooks/useLanguage";
import { MapPin, Wheat, Pencil } from "lucide-react";
import { riceVarieties } from "../data/riceVarieties";
import EditFarmModal from "../components/farm/EditFarmModal";
import EmptyFarmNotice from "../components/onboarding/EmptyFarmNotice";
import { useOnboarding } from "../hooks/useOnboarding";
import "./MyFarm.css";

/* Sum same-unit areas only — the survey stores number + unit without
   conversion (no invented conversion rates), so mixed units render as
   "X acre + Y bigha" instead of a misleading single total. */
function summarizeParcels(parcels) {
    const byUnit = new Map();
    parcels.forEach((p) => {
        const unit = p.unit || "acre";
        byUnit.set(unit, (byUnit.get(unit) || 0) + (Number(p.area) || 0));
    });
    const parts = [...byUnit.entries()].map(
        ([unit, sum]) => `${Math.round(sum * 100) / 100} ${unit}`,
    );
    return {
        parts,
        label: parts.length === 1 ? parts[0] : parts.join(" + "),
    };
}

/* Variety → fields hierarchy, derived only from the existing survey
   parcels (no duplicate data source). Varieties keep their
   first-appearance order; parcels without a variety stay diagram-only
   (the summary count follows the same rule). No stage info here —
   stages live in the field diagram's click details. */
function groupByVariety(parcels) {
    const groups = [];
    const byVariety = new Map();
    parcels.forEach((p, i) => {
        if (!p.riceVariety) return;
        if (!byVariety.has(p.riceVariety)) {
            byVariety.set(p.riceVariety, {
                variety: p.riceVariety,
                fields: [],
            });
            groups.push(byVariety.get(p.riceVariety));
        }
        byVariety.get(p.riceVariety).fields.push(i);
    });
    return groups;
}

/* Variety photo lookup — the rice dataset already maps each variety
   name to its image in /crops (single source of truth, nothing
   hardcoded here). Matches case/spacing-insensitively and falls back
   to the shared rice illustration, same as the Crops page. */
const RICE_LOGO = `${import.meta.env.BASE_URL}crop.svg`;
function varietyImage(name) {
    const match = riceVarieties.find(
        (v) => v.name.trim().toLowerCase() === name.trim().toLowerCase(),
    );
    return match?.image
        ? `${import.meta.env.BASE_URL}${match.image.replace(/^\//, "")}`
        : RICE_LOGO;
}

export default function MyFarm() {
    const { t, formatNumber } = useLanguage();
    const navigate = useNavigate();
    const { isFarmComplete, farm } = useOnboarding();
    const [editOpen, setEditOpen] = useState(false);

    /* NO FAKE DATA for users without farm details: until the onboarding
       survey is completed (or a skipped user fills it via the empty
       state's CTA), the page shows an empty state instead of demo data. */
    if (!isFarmComplete) {
        return (
            <div className="page-container myfarm">
                <section className="myfarm__header section">
                    <h1 className="myfarm__title">{t("nav.myFarm")}</h1>
                </section>
                <EmptyFarmNotice variant="page" />
            </div>
        );
    }

    /* Real user farm data (from the onboarding survey). */
    const parcels = farm.parcels || [];
    const totals = summarizeParcels(parcels);
    const varietyGroups = groupByVariety(parcels);

    return (
        <div className="page-container myfarm">
            <section className="myfarm__header section">
                <div className="myfarm__header-row">
                    <div>
                        <h1 className="myfarm__title">{t("nav.myFarm")}</h1>
                        <p className="myfarm__subtitle">
                            {t("farm.selectField")}
                        </p>
                    </div>
                    <button
                        type="button"
                        className="myfarm__edit-btn"
                        onClick={() => setEditOpen(true)}
                    >
                        <Pencil size={13} />
                        {t("editfarm.open")}
                    </button>
                </div>
            </section>

            {/* Compact summary — only the two facts the diagram doesn't
                show at a glance: total area and variety count. */}
            <section className="myfarm__summary section">
                <div className="myfarm__summary-item">
                    <span className="myfarm__summary-icon myfarm__summary-icon--land">
                        <MapPin size={15} />
                    </span>
                    <div className="myfarm__summary-text">
                        <span className="myfarm__summary-value">
                            {totals.label}
                        </span>
                        <span className="myfarm__summary-label">
                            {t("farm.totalLand")}
                        </span>
                    </div>
                </div>
                <div className="myfarm__summary-item myfarm__summary-item--divided">
                    <span className="myfarm__summary-icon myfarm__summary-icon--variety">
                        <Wheat size={15} />
                    </span>
                    <div className="myfarm__summary-text">
                        <span className="myfarm__summary-value">
                            {formatNumber(varietyGroups.length)}
                            {t("farm.countSuffix")}
                        </span>
                        <span className="myfarm__summary-label">
                            {t("farm.riceVarieties")}
                        </span>
                    </div>
                </div>
            </section>

            {/* Variety grid — names only, derived from the existing survey
                parcels (no duplicate data source). Fields, stages and areas
                stay in the field diagram below. */}
            <section className="myfarm__varieties section">
                <h2 className="myfarm__section-title">
                    {t("farm.riceVarieties")}
                </h2>
                {varietyGroups.length === 0 ? (
                    <p className="myfarm__varieties-empty">
                        {t("farm.noFields")}
                    </p>
                ) : (
                    <div className="myfarm__variety-list">
                        {varietyGroups.map((group) => (
                            <div
                                className="myfarm__variety"
                                key={group.variety}
                            >
                                <img
                                    className="myfarm__variety-img"
                                    src={varietyImage(group.variety)}
                                    alt=""
                                    loading="lazy"
                                    decoding="async"
                                />
                                <span className="myfarm__variety-name">
                                    {group.variety}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {/* Farm parcels — real survey data, one card per parcel */}
            <section className="myfarm__map section">
                <div className="myfarm__map-container">
                    <div
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            flexWrap: "wrap",
                            gap: 8,
                            marginBottom: 10,
                        }}
                    >
                        <div>
                            <h2
                                className="myfarm__section-title"
                                style={{ margin: 0 }}
                            >
                                {t("farm.farmLayout")}
                            </h2>
                            <span
                                style={{
                                    fontSize: "min(max(calc(12px * var(--ts-body, 1)), 9px), 24px)",
                                    color: "var(--text-muted)",
                                }}
                            >
                                {t("farm.mapHint")}
                            </span>
                        </div>
                    </div>

                    <div className="myfarm__map-grid">
                        {parcels.map((p, i) => (
                            <div
                                key={i}
                                className="myfarm__map-field myfarm__map-field--healthy"
                                role="button"
                                tabIndex={0}
                                aria-label={`${t("onboarding.area.parcelLabel")} ${i + 1}`}
                                /* Whole card opens the existing field detail
                                   view (/crops/:id) with THIS parcel's data. */
                                onClick={() => navigate(`/crops/parcel-${i}`)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                        e.preventDefault();
                                        navigate(`/crops/parcel-${i}`);
                                    }
                                }}
                            >
                                <div className="myfarm__map-field-inner">
                                    <div
                                        style={{
                                            display: "flex",
                                            justifyContent: "space-between",
                                            alignItems: "center",
                                        }}
                                    >
                                        <span className="myfarm__map-field-name">
                                            {t("onboarding.area.parcelLabel")}{" "}
                                            {formatNumber(i + 1)}
                                        </span>
                                        <span className="myfarm__map-field-area">
                                            {formatNumber(p.area)}{" "}
                                            {t(`onboarding.unitNames.${p.unit}`)}
                                        </span>
                                    </div>
                                    <span className="myfarm__map-field-crop">
                                        {t("farm.variety")}{" "}
                                        <strong>{p.riceVariety || "—"}</strong>
                                    </span>
                                </div>
                                <div className="myfarm__map-field-bottom">
                                    <span>
                                        {p.stage
                                            ? t(`onboarding.stages.${p.stage}`)
                                            : "—"}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <EditFarmModal
                open={editOpen}
                onClose={() => setEditOpen(false)}
            />
        </div>
    );
}
