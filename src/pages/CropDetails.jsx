import { useParams, useNavigate, Navigate } from "react-router-dom";
import { useLanguage } from "../hooks/useLanguage";
import { useOnboarding } from "../hooks/useOnboarding";
import { crops, fields } from "../data/mockData";
import { CROP_STAGES } from "../data/cropStages";
import {
    ArrowLeft,
    CheckCircle2,
    Circle,
    Bug,
    FlaskConical,
    TrendingUp,
    Store,
} from "lucide-react";
import ProgressBar from "../components/common/ProgressBar";
import StatusBadge from "../components/common/StatusBadge";
import "./CropDetails.css";

/**
 * CropDetails.jsx — the existing field/variety detail view.
 *
 * TWO DATA SOURCES, one design (no redesign, no fake data):
 *
 *   • /crops/:id (variety catalogue)  → mock crop dataset, as before.
 *   • /crops/parcel-<n>               → the AUTHENTICATED user's real
 *     parcel n from the onboarding store (My Farm's field map links
 *     here). Only values the user actually entered are shown; anything
 *     the survey does not collect (yield, cost, profit, market price,
 *     inputs) renders as "—" instead of mock numbers.
 *
 * The growth timeline derives from the parcel's REAL selected stage:
 * stages before it are completed, it is current, later ones upcoming —
 * so a stage changed in onboarding is reflected here automatically.
 */
export default function CropDetails() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { t, formatNumber } = useLanguage();
    const { isFarmComplete, farm } = useOnboarding();

    /* ---------- resolve the data source for this URL ---------- */
    const parcels = farm?.parcels || [];
    const parcelMatch = id ? /^parcel-(\d+)$/.exec(id) : null;
    const parcelIndex = parcelMatch ? Number(parcelMatch[1]) : -1;
    const parcel =
        parcelMatch && isFarmComplete ? parcels[parcelIndex] : null;

    // A parcel URL that points beyond the user's parcels (stale link,
    // deleted farm) must never fall through to mock data → back to My Farm.
    if (parcelMatch && !parcel) {
        return <Navigate to="/farm" replace />;
    }
    const isParcelView = !!parcel;

    const crop = crops.find((c) => c.id === id || c.fieldId === id) || crops[0];
    const fieldInfo = fields.find((f) => f.id === crop.fieldId) || fields[0];
    const progress = Math.round((crop.day / crop.totalDays) * 100);

    /* ---------- parcel view model (real data only) ---------- */
    const stageIdx = parcel?.stage
        ? CROP_STAGES.findIndex((s) => s.key === parcel.stage)
        : -1;
    const stageProgress =
        stageIdx >= 0
            ? Math.round(((stageIdx + 1) / CROP_STAGES.length) * 100)
            : 0;
    const parcelTimeline = CROP_STAGES.map((s, i) => ({
        key: s.key,
        completed: stageIdx >= 0 && i < stageIdx,
        current: i === stageIdx,
    }));
    const parcelLabel = `${t("onboarding.area.parcelLabel")} ${formatNumber(parcelIndex + 1)}`;
    const dash = "—";

    /* Shared values — real parcel values win; mock values for the
       catalogue view; "—" where the survey collected nothing. */
    const headerName = isParcelView
        ? parcel.riceVariety || dash
        : crop.variety;
    const headerSub = isParcelView
        ? `${parcelLabel} · ${formatNumber(parcel.area)} ${t(`onboarding.unitNames.${parcel.unit}`)}`
        : `${crop.field} · ${formatNumber(crop.area)} ${t("dashboard.acres")} · ${t("crops.marketPrice")}: ₹${formatNumber(crop.marketPrice)} ${t("crops.perQuintal")}`;
    const currentStageLabel = isParcelView
        ? parcel.stage
            ? t(`onboarding.stages.${parcel.stage}`)
            : dash
        : crop.stage;
    const progressLabel = isParcelView
        ? t("onboarding.progress", {
              x: formatNumber(stageIdx + 1),
              n: formatNumber(CROP_STAGES.length),
          }) + (stageProgress ? ` (${formatNumber(stageProgress)}%)` : "")
        : `${t("crops.dayOf")} ${formatNumber(crop.day)} / ${formatNumber(crop.totalDays)} (${formatNumber(progress)}%)`;
    const progressPct = isParcelView ? stageProgress : progress;

    return (
        <div className="page-container crop-details">
            <button
                className="crop-details__back"
                onClick={() => navigate(isParcelView ? "/farm" : "/crops")}
            >
                <ArrowLeft size={16} />
                {t("common.back")}
            </button>

            <section className="crop-details__header section">
                <div className="crop-details__header-left">
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
                        }}
                    >
                        <h1 className="crop-details__crop-name">
                            {headerName}
                        </h1>
                        {/* Status badge only for the catalogue view —
                            parcel health is not tracked, so nothing is
                            fabricated here. */}
                        {!isParcelView && (
                            <StatusBadge
                                status={
                                    crop.variety === "Swarna"
                                        ? "needs-attention"
                                        : "optimal"
                                }
                            />
                        )}
                    </div>
                    <span className="crop-details__crop-field">
                        {headerSub}
                    </span>
                </div>
            </section>

            {/* Main Stats */}
            <section className="crop-details__stats section">
                <div className="crop-details__day-stat">
                    <span className="crop-details__day-label">
                        {progressLabel}
                    </span>
                    <div className="crop-details__day-bar">
                        <div
                            className="crop-details__day-fill"
                            style={{ width: `${progressPct}%` }}
                        />
                    </div>
                    <span
                        style={{
                            fontSize: "min(max(calc(12px * var(--ts-body, 1)), 9px), 24px)",
                            color: "var(--text-muted)",
                            marginTop: 6,
                            display: "block",
                        }}
                    >
                        {t("crops.currentStage")}: {currentStageLabel}
                    </span>
                </div>
                <div className="crop-details__stat-card">
                    <span className="crop-details__stat-label">
                        {t("crops.expectedYield")}
                    </span>
                    <span className="crop-details__stat-value">
                        {isParcelView
                            ? dash
                            : `${formatNumber(crop.expectedYield)} ${t("common.ton")}`}
                    </span>
                    {!isParcelView && (
                        <span style={{ fontSize: "min(max(calc(11px * var(--ts-small, 1)), 8px), 17px)", color: "var(--text-muted)" }}>
                            {formatNumber(crop.expectedYield * 1000)} {t("crops.kgTarget")}
                        </span>
                    )}
                </div>
                <div className="crop-details__stat-card">
                    <span className="crop-details__stat-label">
                        {t("crops.estimatedCost")}
                    </span>
                    <span className="crop-details__stat-value">
                        {isParcelView ? dash : `₹${formatNumber(crop.estimatedCost)}`}
                    </span>
                    {!isParcelView && (
                        <span style={{ fontSize: "min(max(calc(11px * var(--ts-small, 1)), 8px), 17px)", color: "var(--text-muted)" }}>
                            {t("crops.inputLabor")}
                        </span>
                    )}
                </div>
                <div className="crop-details__stat-card">
                    <span className="crop-details__stat-label">
                        {t("crops.expectedProfit")}
                    </span>
                    <span
                        className="crop-details__stat-value"
                        style={{ color: "var(--success)" }}
                    >
                        {isParcelView ? dash : `₹${formatNumber(crop.expectedProfit)}`}
                    </span>
                    {!isParcelView && (
                        <span style={{ fontSize: "min(max(calc(11px * var(--ts-small, 1)), 8px), 17px)", color: "var(--success)" }}>
                            {formatNumber(crop.profitMargin)}% {t("crops.margin")}
                        </span>
                    )}
                </div>
            </section>

            {/* Growth Timeline */}
            <section className="crop-details__timeline section">
                <h2 className="crop-details__section-title">
                    {t("crops.growthTimeline")}
                </h2>
                <div className="crop-details__timeline-track">
                    {(isParcelView
                        ? parcelTimeline
                        : crop.timeline
                    ).map((step, i) => (
                        <div
                            key={i}
                            className={`crop-details__timeline-step ${step.completed ? "crop-details__timeline-step--done" : ""} ${step.current ? "crop-details__timeline-step--current" : ""}`}
                        >
                            <div className="crop-details__timeline-icon">
                                {step.completed ? (
                                    <CheckCircle2 size={20} />
                                ) : step.current ? (
                                    <div className="crop-details__timeline-current" />
                                ) : (
                                    <Circle size={20} />
                                )}
                            </div>
                            <span className="crop-details__timeline-label">
                                {isParcelView
                                    ? t(`onboarding.stages.${step.key}`)
                                    : t(`crops.${step.stage.toLowerCase()}`)}
                            </span>
                            {step.current && (
                                <span className="crop-details__timeline-badge">
                                    {t("crops.current")}
                                </span>
                            )}
                            {i < (isParcelView ? parcelTimeline : crop.timeline).length - 1 && (
                                <div
                                    className={`crop-details__timeline-connector ${step.completed ? "crop-details__timeline-connector--done" : ""}`}
                                />
                            )}
                        </div>
                    ))}
                </div>
            </section>

            {/* Input Requirements (Medicine & Fertilizer) */}
            <section className="crop-details__advanced section">
                <h2 className="crop-details__section-title">
                    {t("crops.requiredInputs")}
                </h2>
                <div className="crop-details__advanced-grid">
                    <div
                        className="crop-details__advanced-card"
                        onClick={() => navigate("/disease")}
                        style={{ cursor: "pointer" }}
                    >
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                marginBottom: 8,
                            }}
                        >
                            <Bug size={16} color="var(--warning)" />
                            <span className="crop-details__advanced-label">
                                {t("crops.medicineRequirement")}
                            </span>
                        </div>
                        <span
                            className="crop-details__advanced-value"
                            style={{ fontSize: "max(min(calc(16px * var(--ts-mid, 1)), 26px), 10px)" }}
                        >
                            {isParcelView
                                ? dash
                                : fieldInfo.medicineRequirement.medicine}
                        </span>
                        {!isParcelView && (
                            <span className="crop-details__advanced-note">
                                {t("crops.purpose")}: {fieldInfo.medicineRequirement.purpose} ·
                                {t("crops.qty")}: {fieldInfo.medicineRequirement.quantity} ·
                                {t("crops.costLabel")}: ₹{formatNumber(fieldInfo.medicineRequirement.cost)}
                            </span>
                        )}
                    </div>

                    <div
                        className="crop-details__advanced-card"
                        onClick={() => navigate("/fertilizer")}
                        style={{ cursor: "pointer" }}
                    >
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                marginBottom: 8,
                            }}
                        >
                            <FlaskConical size={16} color="var(--accent)" />
                            <span className="crop-details__advanced-label">
                                {t("crops.fertilizerRequirement")}
                            </span>
                        </div>
                        <span
                            className="crop-details__advanced-value"
                            style={{ fontSize: "max(min(calc(16px * var(--ts-mid, 1)), 26px), 10px)" }}
                        >
                            {isParcelView
                                ? dash
                                : fieldInfo.fertilizerRequirement.fertilizer}
                        </span>
                        {!isParcelView && (
                            <span className="crop-details__advanced-note">
                                {t("crops.qty")}: {fieldInfo.fertilizerRequirement.quantity} ·
                                {t("crops.costLabel")}: ₹{formatNumber(fieldInfo.fertilizerRequirement.cost)} ·
                                {t("crops.benefit")}:{" "}
                                {fieldInfo.fertilizerRequirement.expectedBenefit}
                            </span>
                        )}
                    </div>

                    <div
                        className="crop-details__advanced-card"
                        onClick={() => navigate("/market")}
                        style={{ cursor: "pointer" }}
                    >
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                marginBottom: 8,
                            }}
                        >
                            <Store size={16} color="var(--accent)" />
                            <span className="crop-details__advanced-label">
                                {t("crops.mandiIntel")}
                            </span>
                        </div>
                        <span
                            className="crop-details__advanced-value"
                            style={{ fontSize: "max(min(calc(16px * var(--ts-mid, 1)), 26px), 10px)" }}
                        >
                            {isParcelView
                                ? dash
                                : `₹${formatNumber(crop.marketPrice)} ${t("crops.perQuintal")}`}
                        </span>
                        {!isParcelView && (
                            <span className="crop-details__advanced-note">
                                {t("crops.expectedSellingValue")}: ₹
                                {formatNumber(crop.expectedRevenue)} (
                                {formatNumber(crop.expectedYield)} {t("common.ton")})
                            </span>
                        )}
                    </div>

                    <div className="crop-details__advanced-card">
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                marginBottom: 8,
                            }}
                        >
                            <TrendingUp size={16} color="var(--success)" />
                            <span className="crop-details__advanced-label">
                                {t("crops.yieldGap")}
                            </span>
                        </div>
                        <span
                            className="crop-details__advanced-value"
                            style={{ fontSize: "max(min(calc(16px * var(--ts-mid, 1)), 26px), 10px)" }}
                        >
                            {isParcelView
                                ? dash
                                : `${formatNumber(+(crop.potentialYield - crop.expectedYield).toFixed(1), { minimumFractionDigits: 1 })} ${t("crops.tonGap")}`}
                        </span>
                        {!isParcelView && (
                            <span className="crop-details__advanced-note">
                                {t("crops.potentialLabel")} {formatNumber(crop.potentialYield)} {t("common.ton")} · {t("crops.recoverable")}
                            </span>
                        )}
                    </div>
                </div>
            </section>

            {/* Financial Estimates */}
            <section className="crop-details__factors section">
                <h2 className="crop-details__section-title">
                    {t("crops.profitEfficiency")}
                </h2>
                <div className="crop-details__factors-grid">
                    <div className="crop-details__factor">
                        {isParcelView ? (
                            /* No cost/revenue data collected → honest
                               unknown state, never a fabricated ratio. */
                            <div className="progress-bar">
                                <div className="progress-bar__header">
                                    <span className="progress-bar__label">{t("crops.netProfitMargin")}</span>
                                    <span className="progress-bar__value">{dash}</span>
                                </div>
                                <div className="progress-bar__track" style={{ height: 8 }} />
                            </div>
                        ) : (
                            <ProgressBar
                                value={Math.round(
                                    (crop.expectedProfit / crop.expectedRevenue) *
                                        100,
                                )}
                                label={t("crops.netProfitMargin")}
                            />
                        )}
                    </div>
                    <div className="crop-details__factor">
                        {isParcelView ? (
                            <div className="progress-bar">
                                <div className="progress-bar__header">
                                    <span className="progress-bar__label">{t("crops.yieldRealization")}</span>
                                    <span className="progress-bar__value">{dash}</span>
                                </div>
                                <div className="progress-bar__track" style={{ height: 8 }} />
                            </div>
                        ) : (
                            <ProgressBar
                                value={Math.round(
                                    (crop.expectedYield / crop.potentialYield) *
                                        100,
                                )}
                                label={t("crops.yieldRealization")}
                            />
                        )}
                    </div>
                </div>
            </section>
        </div>
    );
}
