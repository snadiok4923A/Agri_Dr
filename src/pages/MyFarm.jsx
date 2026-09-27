import { useNavigate } from "react-router-dom";
import { useLanguage } from "../hooks/useLanguage";
import { MapPin, Layers, Wheat, TrendingUp } from "lucide-react";
import EmptyFarmNotice from "../components/onboarding/EmptyFarmNotice";
import { useOnboarding } from "../hooks/useOnboarding";
import { CROP_STAGES } from "../data/cropStages";
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

/** Furthest stage across parcels (the crop's most advanced progress). */
function furthestStageKey(parcels) {
    const keys = CROP_STAGES.map((s) => s.key);
    let best = -1;
    parcels.forEach((p) => {
        const idx = keys.indexOf(p.stage);
        if (idx > best) best = idx;
    });
    return best >= 0 ? keys[best] : null;
}

export default function MyFarm() {
    const { t, formatNumber } = useLanguage();
    const navigate = useNavigate();
    const { isFarmComplete, farm } = useOnboarding();

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
    const furthest = furthestStageKey(parcels);
    const varieties = new Set(
        parcels.map((p) => p.riceVariety).filter(Boolean),
    );

    return (
        <div className="page-container myfarm">
            <section className="myfarm__header section">
                <h1 className="myfarm__title">{t("nav.myFarm")}</h1>
                <p className="myfarm__subtitle">{t("farm.selectField")}</p>
            </section>

            {/* Stats: Farm Overview — computed from the user's parcels */}
            <section className="myfarm__stats section">
                <div className="myfarm__stat">
                    <div
                        className="myfarm__stat-icon"
                        style={{
                            background: "var(--accent-soft)",
                            color: "var(--accent)",
                        }}
                    >
                        <MapPin size={20} />
                    </div>
                    <div className="myfarm__stat-content">
                        <span className="myfarm__stat-value">
                            {totals.label}
                        </span>
                        <span className="myfarm__stat-label">
                            {t("farm.totalLand")}
                        </span>
                    </div>
                </div>

                <div className="myfarm__stat">
                    <div
                        className="myfarm__stat-icon"
                        style={{
                            background: "var(--success-soft)",
                            color: "var(--success)",
                        }}
                    >
                        <Layers size={20} />
                    </div>
                    <div className="myfarm__stat-content">
                        <span className="myfarm__stat-value">
                            {formatNumber(parcels.length)}
                        </span>
                        <span className="myfarm__stat-label">
                            {t("onboarding.review.summaryParcels")}
                        </span>
                    </div>
                </div>

                <div className="myfarm__stat">
                    <div
                        className="myfarm__stat-icon"
                        style={{
                            background: "var(--info-soft)",
                            color: "var(--info)",
                        }}
                    >
                        <Wheat size={20} />
                    </div>
                    <div className="myfarm__stat-content">
                        <span className="myfarm__stat-value">
                            {formatNumber(varieties.size)}
                        </span>
                        <span className="myfarm__stat-label">
                            {t("farm.activeCrops")}
                        </span>
                    </div>
                </div>

                <div className="myfarm__stat">
                    <div
                        className="myfarm__stat-icon"
                        style={{
                            background: "var(--warning-soft)",
                            color: "var(--warning)",
                        }}
                    >
                        <TrendingUp size={20} />
                    </div>
                    <div className="myfarm__stat-content">
                        <span className="myfarm__stat-value">
                            {furthest
                                ? t(`onboarding.stages.${furthest}`)
                                : "—"}
                        </span>
                        <span className="myfarm__stat-label">
                            {t("farm.growthStage") || t("onboarding.review.summaryStage")}
                        </span>
                    </div>
                    </div>
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
                            marginBottom: 14,
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
        </div>
    );
}
