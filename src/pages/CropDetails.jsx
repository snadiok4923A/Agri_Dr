import { useParams, useNavigate } from "react-router-dom";
import { useLanguage } from "../hooks/useLanguage";
import { crops, fields } from "../data/mockData";
import {
    ArrowLeft,
    CheckCircle2,
    Circle,
    Bug,
    FlaskConical,
    TrendingUp,
    DollarSign,
    Store,
} from "lucide-react";
import ProgressBar from "../components/common/ProgressBar";
import StatusBadge from "../components/common/StatusBadge";
import "./CropDetails.css";

export default function CropDetails() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { t, formatNumber } = useLanguage();
    const crop = crops.find((c) => c.id === id || c.fieldId === id) || crops[0];
    const fieldInfo = fields.find((f) => f.id === crop.fieldId) || fields[0];

    const progress = Math.round((crop.day / crop.totalDays) * 100);

    return (
        <div className="page-container crop-details">
            <button
                className="crop-details__back"
                onClick={() => navigate("/crops")}
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
                            {crop.variety}
                        </h1>
                        <StatusBadge
                            status={
                                crop.variety === "Swarna"
                                    ? "needs-attention"
                                    : "optimal"
                            }
                        />
                    </div>
                    <span className="crop-details__crop-field">
                        {crop.field} · {formatNumber(crop.area)} {t("dashboard.acres")} · {t("crops.marketPrice")}: ₹
                        {formatNumber(crop.marketPrice)} {t("crops.perQuintal")}
                    </span>
                </div>
            </section>

            {/* Main Stats */}
            <section className="crop-details__stats section">
                <div className="crop-details__day-stat">
                    <span className="crop-details__day-label">
                        {t("crops.dayOf")} {formatNumber(crop.day)} / {formatNumber(crop.totalDays)} ({formatNumber(progress)}%)
                    </span>
                    <div className="crop-details__day-bar">
                        <div
                            className="crop-details__day-fill"
                            style={{ width: `${progress}%` }}
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
                        {t("crops.currentStage")}: {crop.stage}
                    </span>
                </div>
                <div className="crop-details__stat-card">
                    <span className="crop-details__stat-label">
                        {t("crops.expectedYield")}
                    </span>
                    <span className="crop-details__stat-value">
                        {formatNumber(crop.expectedYield)} {t("common.ton")}
                    </span>
                    <span style={{ fontSize: "min(max(calc(11px * var(--ts-small, 1)), 8px), 17px)", color: "var(--text-muted)" }}>
                        {formatNumber(crop.expectedYield * 1000)} {t("crops.kgTarget")}
                    </span>
                </div>
                <div className="crop-details__stat-card">
                    <span className="crop-details__stat-label">
                        {t("crops.estimatedCost")}
                    </span>
                    <span className="crop-details__stat-value">
                        ₹{formatNumber(crop.estimatedCost)}
                    </span>
                    <span style={{ fontSize: "min(max(calc(11px * var(--ts-small, 1)), 8px), 17px)", color: "var(--text-muted)" }}>
                        {t("crops.inputLabor")}
                    </span>
                </div>
                <div className="crop-details__stat-card">
                    <span className="crop-details__stat-label">
                        {t("crops.expectedProfit")}
                    </span>
                    <span
                        className="crop-details__stat-value"
                        style={{ color: "var(--success)" }}
                    >
                        ₹{formatNumber(crop.expectedProfit)}
                    </span>
                    <span style={{ fontSize: "min(max(calc(11px * var(--ts-small, 1)), 8px), 17px)", color: "var(--success)" }}>
                        {formatNumber(crop.profitMargin)}% {t("crops.margin")}
                    </span>
                </div>
            </section>

            {/* Growth Timeline */}
            <section className="crop-details__timeline section">
                <h2 className="crop-details__section-title">
                    {t("crops.growthTimeline")}
                </h2>
                <div className="crop-details__timeline-track">
                    {crop.timeline.map((step, i) => (
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
                                {t(`crops.${step.stage.toLowerCase()}`)}
                            </span>
                            {step.current && (
                                <span className="crop-details__timeline-badge">
                                    {t("crops.current")}
                                </span>
                            )}
                            {i < crop.timeline.length - 1 && (
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
                            {fieldInfo.medicineRequirement.medicine}
                        </span>
                        <span className="crop-details__advanced-note">
                            {t("crops.purpose")}: {fieldInfo.medicineRequirement.purpose} ·
                            {t("crops.qty")}: {fieldInfo.medicineRequirement.quantity} ·
                            {t("crops.costLabel")}: ₹{formatNumber(fieldInfo.medicineRequirement.cost)}
                        </span>
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
                            {fieldInfo.fertilizerRequirement.fertilizer}
                        </span>
                        <span className="crop-details__advanced-note">
                            {t("crops.qty")}: {fieldInfo.fertilizerRequirement.quantity} ·
                            {t("crops.costLabel")}: ₹{formatNumber(fieldInfo.fertilizerRequirement.cost)} ·
                            {t("crops.benefit")}:{" "}
                            {fieldInfo.fertilizerRequirement.expectedBenefit}
                        </span>
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
                            ₹{formatNumber(crop.marketPrice)} {t("crops.perQuintal")}
                        </span>
                        <span className="crop-details__advanced-note">
                            {t("crops.expectedSellingValue")}: ₹
                            {formatNumber(crop.expectedRevenue)} (
                            {formatNumber(crop.expectedYield)} {t("common.ton")})
                        </span>
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
                            {formatNumber(+(crop.potentialYield - crop.expectedYield).toFixed(1), { minimumFractionDigits: 1 })}{" "}
                            {t("crops.tonGap")}
                        </span>
                        <span className="crop-details__advanced-note">
                            {t("crops.potentialLabel")} {formatNumber(crop.potentialYield)} {t("common.ton")} · {t("crops.recoverable")}
                        </span>
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
                        <ProgressBar
                            value={Math.round(
                                (crop.expectedProfit / crop.expectedRevenue) *
                                    100,
                            )}
                            label={t("crops.netProfitMargin")}
                        />
                    </div>
                    <div className="crop-details__factor">
                        <ProgressBar
                            value={Math.round(
                                (crop.expectedYield / crop.potentialYield) *
                                    100,
                            )}
                            label={t("crops.yieldRealization")}
                        />
                    </div>
                </div>
            </section>
        </div>
    );
}
