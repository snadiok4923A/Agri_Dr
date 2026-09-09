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
    const { t } = useLanguage();
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
                        {crop.field} · {crop.area} Acres · Market Price: ₹
                        {crop.marketPrice} / Quintal
                    </span>
                </div>
            </section>

            {/* Main Stats */}
            <section className="crop-details__stats section">
                <div className="crop-details__day-stat">
                    <span className="crop-details__day-label">
                        Day {crop.day} / {crop.totalDays} ({progress}%)
                    </span>
                    <div className="crop-details__day-bar">
                        <div
                            className="crop-details__day-fill"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                    <span
                        style={{
                            fontSize: 12,
                            color: "var(--text-muted)",
                            marginTop: 6,
                            display: "block",
                        }}
                    >
                        Current Stage: {crop.stage}
                    </span>
                </div>
                <div className="crop-details__stat-card">
                    <span className="crop-details__stat-label">
                        {t("crops.expectedYield")}
                    </span>
                    <span className="crop-details__stat-value">
                        {crop.expectedYield} Ton
                    </span>
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                        {(crop.expectedYield * 1000).toLocaleString()} kg target
                    </span>
                </div>
                <div className="crop-details__stat-card">
                    <span className="crop-details__stat-label">
                        {t("crops.estimatedCost")}
                    </span>
                    <span className="crop-details__stat-value">
                        ₹{crop.estimatedCost.toLocaleString("en-IN")}
                    </span>
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                        Input & labor
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
                        ₹{crop.expectedProfit.toLocaleString("en-IN")}
                    </span>
                    <span style={{ fontSize: 11, color: "var(--success)" }}>
                        {crop.profitMargin}% Margin
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
                    Required Agricultural Inputs
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
                                Medicine Requirement
                            </span>
                        </div>
                        <span
                            className="crop-details__advanced-value"
                            style={{ fontSize: 16 }}
                        >
                            {fieldInfo.medicineRequirement.medicine}
                        </span>
                        <span className="crop-details__advanced-note">
                            Purpose: {fieldInfo.medicineRequirement.purpose} ·
                            Qty: {fieldInfo.medicineRequirement.quantity} ·
                            Cost: ₹{fieldInfo.medicineRequirement.cost}
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
                                Fertilizer Requirement
                            </span>
                        </div>
                        <span
                            className="crop-details__advanced-value"
                            style={{ fontSize: 16 }}
                        >
                            {fieldInfo.fertilizerRequirement.fertilizer}
                        </span>
                        <span className="crop-details__advanced-note">
                            Qty: {fieldInfo.fertilizerRequirement.quantity} ·
                            Cost: ₹{fieldInfo.fertilizerRequirement.cost} ·
                            Benefit:{" "}
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
                                Mandi Selling Intelligence
                            </span>
                        </div>
                        <span
                            className="crop-details__advanced-value"
                            style={{ fontSize: 16 }}
                        >
                            ₹{crop.marketPrice} / Quintal
                        </span>
                        <span className="crop-details__advanced-note">
                            Expected Selling Value: ₹
                            {crop.expectedRevenue.toLocaleString("en-IN")} (
                            {crop.expectedYield} Ton)
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
                                Yield Gap & Potential
                            </span>
                        </div>
                        <span
                            className="crop-details__advanced-value"
                            style={{ fontSize: 16 }}
                        >
                            {(crop.potentialYield - crop.expectedYield).toFixed(
                                1,
                            )}{" "}
                            Ton Gap
                        </span>
                        <span className="crop-details__advanced-note">
                            Potential: {crop.potentialYield} Ton · Recoverable
                            with timely inputs
                        </span>
                    </div>
                </div>
            </section>

            {/* Financial Estimates */}
            <section className="crop-details__factors section">
                <h2 className="crop-details__section-title">
                    Production & Profit Efficiency
                </h2>
                <div className="crop-details__factors-grid">
                    <div className="crop-details__factor">
                        <ProgressBar
                            value={Math.round(
                                (crop.expectedProfit / crop.expectedRevenue) *
                                    100,
                            )}
                            label="Net Profit Margin"
                        />
                    </div>
                    <div className="crop-details__factor">
                        <ProgressBar
                            value={Math.round(
                                (crop.expectedYield / crop.potentialYield) *
                                    100,
                            )}
                            label="Yield Realization Rate"
                        />
                    </div>
                </div>
            </section>
        </div>
    );
}
