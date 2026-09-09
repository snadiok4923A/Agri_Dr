import { useState } from "react";
import { useLanguage } from "../hooks/useLanguage";
import {
    fields,
    diseaseData,
    cropProtectionData,
    analyticsData,
} from "../data/mockData";
import { useNavigate } from "react-router-dom";
import {
    ShieldCheck,
    AlertTriangle,
    Bug,
    TrendingUp,
    DollarSign,
    Coins,
    ArrowRight,
    CheckCircle2,
} from "lucide-react";
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from "recharts";
import ProgressRing from "../components/common/ProgressRing";
import ProgressBar from "../components/common/ProgressBar";
import StatusBadge from "../components/common/StatusBadge";
import "./Health.css";

export default function Health() {
    const { t } = useLanguage();
    const navigate = useNavigate();
    const [period, setPeriod] = useState("7d");

    const {
        yieldProtectedPercent,
        yieldAtRiskTon,
        protectedYieldTon,
        totalTreatmentCost,
        valueProtected,
        breakdown,
    } = cropProtectionData;

    return (
        <div className="page-container health-page">
            {/* Header */}
            <section className="health-page__header section">
                <div>
                    <h1 className="health-page__title">
                        {t("health.overallHealth")}
                    </h1>
                    <p className="dashboard__section-subtitle">
                        Rice crop protection, disease prevention, medicine
                        requirements, and safeguarded yield
                    </p>
                </div>
            </section>

            {/* Yield Protection Summary */}
            <section className="health-page__score section">
                <div className="health-page__score-main">
                    <ProgressRing
                        value={yieldProtectedPercent}
                        size={150}
                        strokeWidth={10}
                    />
                    <div className="health-page__score-info">
                        <span className="health-page__score-status">
                            {yieldProtectedPercent}% Protected
                        </span>
                        <span className="health-page__score-label">
                            {t("health.yieldProtected")}
                        </span>
                        <span className="health-page__score-trend health-page__score-trend--up">
                            <TrendingUp size={14} /> 16.1T of 17.5T Baseline
                        </span>
                    </div>
                </div>

                {/* Protection Impact Metrics */}
                <div className="health-page__metrics-row">
                    <div className="health-page__stat-box">
                        <span className="health-page__stat-label">
                            {t("health.treatmentCost")}
                        </span>
                        <span className="health-page__stat-val">
                            ₹{totalTreatmentCost.toLocaleString("en-IN")}
                        </span>
                        <span className="health-page__stat-sub">
                            Active medicine spend
                        </span>
                    </div>
                    <div className="health-page__stat-box">
                        <span className="health-page__stat-label">
                            {t("health.valueProtected")}
                        </span>
                        <span
                            className="health-page__stat-val"
                            style={{ color: "var(--success)" }}
                        >
                            ₹{valueProtected.toLocaleString("en-IN")}
                        </span>
                        <span className="health-page__stat-sub">
                            Crop market value saved
                        </span>
                    </div>
                    <div className="health-page__stat-box">
                        <span className="health-page__stat-label">
                            {t("health.yieldAtRisk")}
                        </span>
                        <span
                            className="health-page__stat-val"
                            style={{ color: "var(--warning)" }}
                        >
                            {yieldAtRiskTon} Ton
                        </span>
                        <span className="health-page__stat-sub">
                            Without immediate spray
                        </span>
                    </div>
                </div>
            </section>

            {/* Protection Factor Breakdown */}
            <section className="health-page__breakdown-section section">
                <h2 className="health-page__section-title">
                    {t("health.breakdownTitle")}
                </h2>
                <div className="health-page__breakdown-grid">
                    {breakdown.map((item, idx) => (
                        <div key={idx} className="health-page__factor-card">
                            <div className="health-page__factor-header">
                                <div>
                                    <span className="health-page__factor-title">
                                        {item.factor}
                                    </span>
                                    <span className="health-page__factor-sub">
                                        {item.field} · {item.medicine}
                                    </span>
                                </div>
                                <span className="health-page__factor-badge">
                                    {item.status}
                                </span>
                            </div>
                            <ProgressBar
                                value={item.score}
                                label="Protection Level"
                            />
                        </div>
                    ))}
                </div>
            </section>

            {/* Active Treatments & Production Impact (Disease -> Treatment -> Cost -> Impact) */}
            <section className="health-page__treatments-section section">
                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                    }}
                >
                    <div>
                        <h2 className="health-page__section-title">
                            Active Crop Threats & Medicine Treatments
                        </h2>
                        <p className="dashboard__section-subtitle">
                            Disease identification, recommended medicine dosage,
                            cost, and yield impact
                        </p>
                    </div>
                    <button
                        className="dashboard__action-btn"
                        onClick={() => navigate("/disease")}
                    >
                        View Disease Center <ArrowRight size={14} />
                    </button>
                </div>

                <div className="health-page__treatments-list">
                    {diseaseData.map((d) => (
                        <div key={d.id} className="health-page__treatment-card">
                            <div className="health-page__treatment-header">
                                <div
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 10,
                                    }}
                                >
                                    <div className="health-page__treatment-icon">
                                        <Bug size={18} />
                                    </div>
                                    <div>
                                        <h3 className="health-page__treatment-name">
                                            {d.name}
                                        </h3>
                                        <span className="health-page__treatment-field">
                                            {d.field} · Variety: {d.variety}
                                        </span>
                                    </div>
                                </div>
                                <StatusBadge
                                    status={
                                        d.severity === "critical"
                                            ? "critical"
                                            : "needs-attention"
                                    }
                                />
                            </div>

                            <div className="health-page__treatment-grid">
                                <div className="health-page__treatment-col">
                                    <span className="health-page__col-label">
                                        Recommended Medicine
                                    </span>
                                    <span className="health-page__col-val">
                                        {d.medicine}
                                    </span>
                                    <span className="health-page__col-sub">
                                        Dosage: {d.dosage}
                                    </span>
                                </div>

                                <div className="health-page__treatment-col">
                                    <span className="health-page__col-label">
                                        Treatment Cost
                                    </span>
                                    <span
                                        className="health-page__col-val"
                                        style={{ color: "var(--accent)" }}
                                    >
                                        {d.treatmentCost}
                                    </span>
                                    <span className="health-page__col-sub">
                                        Immediate application
                                    </span>
                                </div>

                                <div className="health-page__treatment-col">
                                    <span className="health-page__col-label">
                                        Expected Production Impact
                                    </span>
                                    <span
                                        className="health-page__col-val"
                                        style={{
                                            color:
                                                d.severity === "critical"
                                                    ? "var(--danger)"
                                                    : "var(--warning)",
                                        }}
                                    >
                                        {d.productionImpact}
                                    </span>
                                    <span className="health-page__col-sub">
                                        {d.confidence}% AI diagnostic confidence
                                    </span>
                                </div>
                            </div>

                            <div className="health-page__treatment-action-bar">
                                <span className="health-page__action-text">
                                    <strong>Action:</strong>{" "}
                                    {d.recommendedAction}
                                </span>
                                <button
                                    className="health-page__apply-btn"
                                    onClick={() => navigate("/disease")}
                                >
                                    Apply Treatment <ArrowRight size={13} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Field Protection Status */}
            <section className="health-page__fields section">
                <h2 className="health-page__section-title">
                    {t("health.fieldTitle")}
                </h2>
                <div className="health-page__fields-grid">
                    {fields.map((f) => (
                        <div
                            key={f.id}
                            className="health-page__field-item"
                            onClick={() => navigate(`/crops/${f.cropId}`)}
                            style={{ cursor: "pointer" }}
                        >
                            <div className="health-page__field-info">
                                <span className="health-page__field-name">
                                    {f.name}
                                </span>
                                <span className="health-page__field-crop">
                                    {f.variety} ({f.area} ac)
                                </span>
                                <span className="health-page__field-yield">
                                    Target: {f.expectedYield} Ton
                                </span>
                                <span className="health-page__field-med">
                                    Med: {f.medicineRequirement.medicine}
                                </span>
                            </div>
                            <div
                                style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: "flex-end",
                                    gap: 8,
                                }}
                            >
                                <StatusBadge status={f.status} />
                                <span
                                    style={{
                                        fontSize: 11,
                                        fontWeight: 700,
                                        color: "var(--accent)",
                                    }}
                                >
                                    ₹{f.medicineRequirement.cost}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Production Safeguard Trend */}
            <section className="health-page__trend section">
                <div className="health-page__trend-header">
                    <div>
                        <h2 className="health-page__section-title">
                            {t("health.trendTitle")}
                        </h2>
                        <span className="dashboard__section-subtitle">
                            Monthly protected yield accumulation vs potential
                            ceiling (Apr - Sep)
                        </span>
                    </div>
                    <div className="health-page__period-selector">
                        <button
                            className={period === "7d" ? "active" : ""}
                            onClick={() => setPeriod("7d")}
                        >
                            {t("health.sevenDay")}
                        </button>
                        <button
                            className={period === "14d" ? "active" : ""}
                            onClick={() => setPeriod("14d")}
                        >
                            {t("health.fourteenDay")}
                        </button>
                        <button
                            className={period === "30d" ? "active" : ""}
                            onClick={() => setPeriod("30d")}
                        >
                            {t("health.thirtyDay")}
                        </button>
                    </div>
                </div>
                <div className="health-page__chart">
                    <ResponsiveContainer width="100%" height={220}>
                        <AreaChart data={cropProtectionData.trend}>
                            <defs>
                                <linearGradient
                                    id="healthTrendGrad"
                                    x1="0"
                                    y1="0"
                                    x2="0"
                                    y2="1"
                                >
                                    <stop
                                        offset="0%"
                                        stopColor="var(--accent)"
                                        stopOpacity={0.2}
                                    />
                                    <stop
                                        offset="100%"
                                        stopColor="var(--accent)"
                                        stopOpacity={0}
                                    />
                                </linearGradient>
                            </defs>
                            <CartesianGrid
                                stroke="var(--chart-grid)"
                                strokeDasharray="3 3"
                            />
                            <XAxis
                                dataKey="month"
                                tick={{
                                    fontSize: 11,
                                    fill: "var(--chart-text)",
                                }}
                                axisLine={false}
                                tickLine={false}
                            />
                            <YAxis
                                domain={[0, 20]}
                                tick={{
                                    fontSize: 11,
                                    fill: "var(--chart-text)",
                                }}
                                axisLine={false}
                                tickLine={false}
                            />
                            <Tooltip
                                formatter={(val, name) => [
                                    `${val} Ton`,
                                    name === "protectedYield"
                                        ? "Protected Yield"
                                        : "Potential",
                                ]}
                                contentStyle={{
                                    background: "var(--bg-surface)",
                                    border: "1px solid var(--border)",
                                    borderRadius: "var(--radius-md)",
                                    fontSize: 12,
                                }}
                            />
                            <Area
                                type="monotone"
                                dataKey="protectedYield"
                                stroke="var(--accent)"
                                fill="url(#healthTrendGrad)"
                                strokeWidth={2}
                                name="protectedYield"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </section>
        </div>
    );
}
