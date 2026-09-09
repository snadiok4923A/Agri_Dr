import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { useLanguage } from "../hooks/useLanguage";
import {
    farmData,
    crops,
    fields,
    weatherData,
    analyticsData,
} from "../data/mockData";
import {
    ArrowRight,
    ChevronRight,
    TrendingUp,
    Coins,
    Sprout,
    Wheat,
    Sparkles,
    IndianRupee,
    Pill,
} from "lucide-react";
import { AreaChart, Area, ResponsiveContainer, XAxis, Tooltip } from "recharts";
import {
    RicePlantIllustration,
    WeatherSunCloudIllustration,
    AgriActionIcon,
} from "../components/common/AgriIllustrations";
import AnimatedNumber from "../components/common/AnimatedNumber";
import "./Dashboard.css";

const getGreeting = (t) => {
    const hour = new Date().getHours();
    if (hour < 12) return t("dashboard.greeting") || "Good morning";
    if (hour < 17) return t("dashboard.greetingAfternoon") || "Good afternoon";
    return t("dashboard.greetingEvening") || "Good evening";
};

// Reveal sections with a subtle, staggered fade-up (skipped for reduced motion)
const sectionVariants = {
    hidden: { opacity: 0, y: 14 },
    show: (i) => ({
        opacity: 1,
        y: 0,
        transition: {
            duration: 0.45,
            delay: i * 0.06,
            ease: [0.16, 1, 0.3, 1],
        },
    }),
};

export default function Dashboard() {
    const { t } = useLanguage();
    const navigate = useNavigate();
    const shouldReduceMotion = useReducedMotion();

    // Helper to spread the fade-up reveal props onto a section, in order
    const reveal = (i) =>
        shouldReduceMotion
            ? {}
            : {
                  variants: sectionVariants,
                  initial: "hidden",
                  animate: "show",
                  custom: i,
              };

    // Active variety selection for quick spotlight
    const [selectedVarietyId, setSelectedVarietyId] = useState(crops[0].id);
    const selectedVariety =
        crops.find((c) => c.id === selectedVarietyId) || crops[0];

    const totalYield = farmData.expectedYield;
    const currentEst = farmData.currentProductionEstimate;
    const yieldPct = Math.round((currentEst / totalYield) * 100);

    // Highest-urgency treatment across fields (drives the medicine card)
    const urgentField =
        fields.find((f) => f.medicineRequirement?.urgency === "high") || fields[0];
    const treatment = urgentField.medicineRequirement;
    const costShare = Math.round(
        (farmData.estimatedCost / farmData.estimatedRevenue) * 100,
    );

    // Circular progress calculations (Radius 70, Stroke 10, Box 160)
    const ringRadius = 66;
    const ringCircumference = 2 * Math.PI * ringRadius;
    const ringOffset = ringCircumference - (yieldPct / 100) * ringCircumference;

    // Simple, high-priority action cards
    const actionItems = [
        {
            id: "med",
            type: "medicine",
            title: "Leaf Blast Treatment",
            subtitle: "Spray Tricyclazole in Field B",
            badge: "Action Needed",
            path: "/disease",
        },
        {
            id: "fert",
            type: "fertilizer",
            title: "Urea Top-Dressing",
            subtitle: "40 kg required in Field A",
            badge: "Due Tomorrow",
            path: "/fertilizer",
        },
        {
            id: "mkt",
            type: "market",
            title: "Basmati Price Up +5.1%",
            subtitle: "₹5,200/Q at Burdwan Mandi",
            badge: "Sell Premium",
            path: "/market",
        },
        {
            id: "yield",
            type: "production",
            title: "Expected Profit Opportunity",
            subtitle: `Close ${(
                farmData.potentialYield - totalYield
            ).toFixed(1)}T gap for +₹89K profit`,
            badge: "+78% Margin",
            path: "/improve",
        },
    ];

    return (
        <div className="page-container dashboard-page">
            {/* ==================== 1. GREETING + WEATHER ==================== */}
            <motion.section className="dashboard-greeting-row" {...reveal(0)}>
                <div className="dashboard-greeting-left">
                    <span className="dashboard-greeting-tag">
                        <Wheat size={14} className="dashboard-greeting-icon" />
                        {farmData.name} · {farmData.totalLand} Acres
                    </span>
                    <h1 className="dashboard-greeting-title">
                        {getGreeting(t)}, {farmData.owner}
                    </h1>
                </div>

                {/* Compact Weather Widget */}
                <div
                    className="dashboard-weather-compact"
                    onClick={() => navigate("/weather")}
                    title="View Weather & Spraying Advisory"
                >
                    <WeatherSunCloudIllustration size={38} />
                    <div className="dashboard-weather-info">
                        <div className="dashboard-weather-temp-row">
                            <span className="dashboard-weather-temp">
                                {weatherData.current.temperature}°
                            </span>
                            <span className="dashboard-weather-cond">
                                {weatherData.current.condition}
                            </span>
                        </div>
                        <div className="dashboard-weather-meta">
                            <span>💧 {weatherData.current.humidity}%</span>
                            <span>💨 {weatherData.current.wind} km/h</span>
                        </div>
                    </div>
                </div>
            </motion.section>

            {/* ==================== 2. MAIN RICE PRODUCTION VISUAL ==================== */}
            <motion.section className="dashboard-hero-section" {...reveal(1)}>
                <div className="dashboard-hero-card">
                    {/* Soft floating pollen particles — atmosphere, not distraction */}
                    <div className="dashboard-hero-particles" aria-hidden="true">
                        <span />
                        <span />
                        <span />
                    </div>
                    {/* Left: Beautiful Agricultural Vector with Circular Progress Ring */}
                    <div className="dashboard-hero-visual">
                        <div className="dashboard-ring-container">
                            <svg
                                className="dashboard-ring-svg"
                                width="160"
                                height="160"
                                viewBox="0 0 160 160"
                            >
                                {/* Background Ring */}
                                <circle
                                    cx="80"
                                    cy="80"
                                    r={ringRadius}
                                    className="dashboard-ring-bg"
                                    strokeWidth="9"
                                />
                                {/* Progress Ring with Smooth Dasharray */}
                                <circle
                                    cx="80"
                                    cy="80"
                                    r={ringRadius}
                                    className="dashboard-ring-fill"
                                    strokeWidth="9"
                                    strokeDasharray={ringCircumference}
                                    strokeDashoffset={ringOffset}
                                    strokeLinecap="round"
                                    transform="rotate(-90 80 80)"
                                />
                            </svg>

                            {/* Centered Rice Illustration */}
                            <div className="dashboard-ring-artwork">
                                <RicePlantIllustration size={105} />
                            </div>
                        </div>

                        {/* Overall Percentage Badge */}
                        <div className="dashboard-hero-progress-pill">
                            <span className="dashboard-hero-pct">
                                <AnimatedNumber value={yieldPct} />%
                            </span>
                            <span className="dashboard-hero-pct-label">
                                Production Target
                            </span>
                        </div>
                    </div>

                    {/* Right: Quick Production Summary */}
                    <div className="dashboard-hero-details">
                        <div className="dashboard-hero-badge">
                            <Sprout size={14} />
                            <span>
                                Kharif Season · {farmData.activeCrops} Rice
                                Varieties
                            </span>
                        </div>
                        <h2 className="dashboard-hero-heading">
                            <AnimatedNumber value={currentEst} decimals={1} />{" "}
                            of{" "}
                            <AnimatedNumber value={totalYield} decimals={1} />{" "}
                            Tons
                        </h2>

                        <div className="dashboard-hero-metrics-row">
                            <div className="dashboard-hero-mini-stat">
                                <span className="dashboard-hero-stat-label">
                                    In-Field Now
                                </span>
                                <span className="dashboard-hero-stat-val">
                                    <AnimatedNumber
                                        value={currentEst}
                                        decimals={1}
                                    />{" "}
                                    Ton
                                </span>
                            </div>
                            <div className="dashboard-hero-stat-div" />
                            <div className="dashboard-hero-mini-stat">
                                <span className="dashboard-hero-stat-label">
                                    Season Target
                                </span>
                                <span className="dashboard-hero-stat-val">
                                    <AnimatedNumber
                                        value={totalYield}
                                        decimals={1}
                                    />{" "}
                                    Ton
                                </span>
                            </div>
                            <div className="dashboard-hero-stat-div" />
                            <div className="dashboard-hero-mini-stat">
                                <span className="dashboard-hero-stat-label">
                                    Max Potential
                                </span>
                                <span className="dashboard-hero-stat-val">
                                    <AnimatedNumber
                                        value={farmData.potentialYield}
                                        decimals={1}
                                    />{" "}
                                    Ton
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </motion.section>

            {/* ==================== 3. PRODUCTION + PROFIT CARDS ==================== */}
            <motion.section className="dashboard-stats-grid" {...reveal(2)}>
                {/* Production Card */}
                <div
                    className="dashboard-stat-card dashboard-stat-card--prod"
                    onClick={() => navigate("/crops")}
                    role="button"
                    tabIndex={0}
                >
                    <div className="dashboard-stat-card__top">
                        <span className="dashboard-stat-card__label">
                            Expected Yield
                        </span>
                        <div className="dashboard-stat-card__icon dashboard-stat-card__icon--prod">
                            <Wheat size={18} />
                        </div>
                    </div>
                    <div className="dashboard-stat-card__main">
                        <span className="dashboard-stat-card__number">
                            <AnimatedNumber value={totalYield} decimals={1} />
                        </span>
                        <span className="dashboard-stat-card__unit">Ton</span>
                    </div>
                    <div className="dashboard-stat-card__footer">
                        <span className="dashboard-stat-card__pill dashboard-stat-card__pill--prod">
                            <TrendingUp size={12} />
                            <span>
                                <AnimatedNumber
                                    value={farmData.potentialYield}
                                    decimals={1}
                                />
                                T Potential
                            </span>
                        </span>
                        <span className="dashboard-stat-card__arrow">
                            <ArrowRight size={14} />
                        </span>
                    </div>
                </div>

                {/* Profit Card */}
                <div
                    className="dashboard-stat-card dashboard-stat-card--profit"
                    onClick={() => navigate("/finance")}
                    role="button"
                    tabIndex={0}
                >
                    <div className="dashboard-stat-card__top">
                        <span className="dashboard-stat-card__label">
                            Expected Net Profit
                        </span>
                        <div className="dashboard-stat-card__icon dashboard-stat-card__icon--profit">
                            <Coins size={18} />
                        </div>
                    </div>
                    <div className="dashboard-stat-card__main">
                        <span className="dashboard-stat-card__currency">₹</span>
                        <span className="dashboard-stat-card__number">
                            <AnimatedNumber value={farmData.expectedProfit} />
                        </span>
                    </div>
                    <div className="dashboard-stat-card__footer">
                        <span className="dashboard-stat-card__pill dashboard-stat-card__pill--profit">
                            <Sparkles size={12} />
                            <span>
                                +
                                <AnimatedNumber
                                    value={farmData.profitMargin}
                                    decimals={1}
                                />
                                % Margin
                            </span>
                        </span>
                        <span className="dashboard-stat-card__arrow">
                            <ArrowRight size={14} />
                        </span>
                    </div>
                </div>

                {/* Production Cost Card */}
                <div
                    className="dashboard-stat-card dashboard-stat-card--cost"
                    onClick={() => navigate("/finance")}
                    role="button"
                    tabIndex={0}
                >
                    <div className="dashboard-stat-card__top">
                        <span className="dashboard-stat-card__label">
                            Estimated Production Cost
                        </span>
                        <div className="dashboard-stat-card__icon dashboard-stat-card__icon--cost">
                            <IndianRupee size={18} />
                        </div>
                    </div>
                    <div className="dashboard-stat-card__main">
                        <span className="dashboard-stat-card__currency">₹</span>
                        <span className="dashboard-stat-card__number">
                            <AnimatedNumber value={farmData.estimatedCost} />
                        </span>
                    </div>
                    <div className="dashboard-stat-card__footer">
                        <span className="dashboard-stat-card__pill dashboard-stat-card__pill--cost">
                            <TrendingUp size={12} style={{ transform: "rotate(180deg)" }} />
                            <span>
                                <AnimatedNumber value={costShare} decimals={1} />
                                % of Revenue
                            </span>
                        </span>
                        <span className="dashboard-stat-card__arrow">
                            <ArrowRight size={14} />
                        </span>
                    </div>
                </div>

                {/* Treatment / Medicine Card */}
                <div
                    className="dashboard-stat-card dashboard-stat-card--medicine"
                    onClick={() => navigate("/disease")}
                    role="button"
                    tabIndex={0}
                >
                    <div className="dashboard-stat-card__top">
                        <span className="dashboard-stat-card__label">
                            Treatment Required
                        </span>
                        <div className="dashboard-stat-card__icon dashboard-stat-card__icon--medicine">
                            <Pill size={18} />
                        </div>
                    </div>
                    <div className="dashboard-stat-card__main dashboard-stat-card__main--stacked">
                        <span className="dashboard-stat-card__medicine-name">
                            {treatment.medicine.split(" ").slice(0, 2).join(" ")}
                        </span>
                        <span className="dashboard-stat-card__medicine-qty">
                            Required: {treatment.quantity}
                        </span>
                    </div>
                    <div className="dashboard-stat-card__footer">
                        <span className="dashboard-stat-card__pill dashboard-stat-card__pill--medicine">
                            <Sparkles size={12} />
                            <span>
                                {urgentField.name} · {treatment.purpose.split(" ")[0]} Blast
                            </span>
                        </span>
                        <span className="dashboard-stat-card__arrow">
                            <ArrowRight size={14} />
                        </span>
                    </div>
                </div>
            </motion.section>

            {/* ==================== 4. IMPORTANT ACTIONS ==================== */}
            <motion.section className="dashboard-section" {...reveal(3)}>
                <div className="dashboard-section-header">
                    <h3 className="dashboard-section-title">
                        What Needs Attention?
                    </h3>
                </div>

                <div className="dashboard-actions-grid">
                    {actionItems.map((action) => (
                        <div
                            key={action.id}
                            className="dashboard-action-card"
                            onClick={() => navigate(action.path)}
                            role="button"
                            tabIndex={0}
                        >
                            <div
                                className={`dashboard-action-card__icon dashboard-action-card__icon--${action.type}`}
                            >
                                <AgriActionIcon type={action.type} size={22} />
                            </div>
                            <div className="dashboard-action-card__content">
                                <div className="dashboard-action-card__header">
                                    <span className="dashboard-action-card__title">
                                        {action.title}
                                    </span>
                                    <span
                                        className={`dashboard-action-card__badge dashboard-action-card__badge--${action.type}`}
                                    >
                                        {action.badge}
                                    </span>
                                </div>
                                <span className="dashboard-action-card__subtitle">
                                    {action.subtitle}
                                </span>
                            </div>
                            <ChevronRight
                                size={16}
                                className="dashboard-action-card__arrow"
                            />
                        </div>
                    ))}
                </div>
            </motion.section>

            {/* ==================== 5. RICE VARIETIES ==================== */}
            <motion.section className="dashboard-section" {...reveal(4)}>
                <div className="dashboard-section-header">
                    <h3 className="dashboard-section-title">Rice Varieties</h3>
                    <span
                        className="dashboard-section-link"
                        onClick={() => navigate("/crops")}
                    >
                        All {crops.length} Varieties →
                    </span>
                </div>

                {/* Variety Selection Chips */}
                <div className="dashboard-variety-chips">
                    {crops.map((c) => (
                        <button
                            key={c.id}
                            className={`dashboard-variety-chip ${
                                selectedVarietyId === c.id
                                    ? "dashboard-variety-chip--active"
                                    : ""
                            }`}
                            onClick={() => setSelectedVarietyId(c.id)}
                        >
                            <Wheat size={14} />
                            <span>{c.variety}</span>
                            <span className="dashboard-variety-chip__acre">
                                {c.area} ac
                            </span>
                        </button>
                    ))}
                </div>

                {/* Selected Variety Spotlight Card */}
                <div className="dashboard-variety-spotlight">
                    <div className="dashboard-variety-spotlight__header">
                        <div>
                            <span className="dashboard-variety-spotlight__tag">
                                {selectedVariety.field} · {selectedVariety.area}{" "}
                                Acres · {selectedVariety.stage} Stage
                            </span>
                            <h4 className="dashboard-variety-spotlight__name">
                                {selectedVariety.variety} Paddy
                            </h4>
                        </div>
                        <button
                            className="dashboard-variety-spotlight__btn"
                            onClick={() =>
                                navigate(`/crops/${selectedVariety.id}`)
                            }
                        >
                            <span>Details</span>
                            <ChevronRight size={14} />
                        </button>
                    </div>

                    <div className="dashboard-variety-spotlight__metrics">
                        <div className="dashboard-variety-metric-box">
                            <span className="dashboard-variety-metric-lbl">
                                Expected Yield
                            </span>
                            <span className="dashboard-variety-metric-val">
                                <AnimatedNumber
                                    value={selectedVariety.expectedYield}
                                    decimals={1}
                                />{" "}
                                Ton
                            </span>
                        </div>
                        <div className="dashboard-variety-metric-box">
                            <span className="dashboard-variety-metric-lbl">
                                Expected Profit
                            </span>
                            <span className="dashboard-variety-metric-val dashboard-variety-metric-val--profit">
                                ₹
                                <AnimatedNumber
                                    value={selectedVariety.expectedProfit}
                                />
                            </span>
                        </div>
                        <div className="dashboard-variety-metric-box">
                            <span className="dashboard-variety-metric-lbl">
                                Production Cost
                            </span>
                            <span className="dashboard-variety-metric-val">
                                ₹
                                <AnimatedNumber
                                    value={selectedVariety.estimatedCost}
                                />
                            </span>
                        </div>
                        <div className="dashboard-variety-metric-box">
                            <span className="dashboard-variety-metric-lbl">
                                Mandi Rate
                            </span>
                            <span className="dashboard-variety-metric-val">
                                ₹{selectedVariety.marketPrice} / Q
                            </span>
                        </div>
                    </div>
                </div>
            </motion.section>

            {/* ==================== 6. SIMPLE PRODUCTION INSIGHTS ==================== */}
            <motion.section className="dashboard-section" {...reveal(5)}>
                <div className="dashboard-section-header">
                    <h3 className="dashboard-section-title">
                        Production & Profit Trends
                    </h3>
                    <span
                        className="dashboard-section-link"
                        onClick={() => navigate("/insights")}
                    >
                        Deep Analytics →
                    </span>
                </div>

                <div className="dashboard-insights-grid">
                    {/* Visual Mini Chart: Cumulative Production */}
                    <div className="dashboard-insight-card">
                        <div className="dashboard-insight-card__header">
                            <div>
                                <span className="dashboard-insight-card__title">
                                    Production Forecast
                                </span>
                                <span className="dashboard-insight-card__sub">
                                    April – September (Tons)
                                </span>
                            </div>
                            <span className="dashboard-insight-card__badge">
                                16.1T Target
                            </span>
                        </div>

                        <div className="dashboard-insight-card__chart">
                            <ResponsiveContainer width="100%" height={90}>
                                <AreaChart
                                    data={analyticsData.productionTrend}
                                    margin={{
                                        top: 4,
                                        right: 4,
                                        left: 4,
                                        bottom: 0,
                                    }}
                                >
                                    <defs>
                                        <linearGradient
                                            id="agriAreaGrad"
                                            x1="0"
                                            y1="0"
                                            x2="0"
                                            y2="1"
                                        >
                                            <stop
                                                offset="0%"
                                                stopColor="var(--accent)"
                                                stopOpacity={0.25}
                                            />
                                            <stop
                                                offset="100%"
                                                stopColor="var(--accent)"
                                                stopOpacity={0}
                                            />
                                        </linearGradient>
                                    </defs>
                                    <XAxis
                                        dataKey="month"
                                        tick={{
                                            fontSize: 10,
                                            fill: "var(--text-muted)",
                                        }}
                                        axisLine={false}
                                        tickLine={false}
                                    />
                                    <Tooltip
                                        formatter={(val) => [
                                            `${val} Ton`,
                                            "Projected Yield",
                                        ]}
                                        contentStyle={{
                                            background: "var(--bg-surface)",
                                            border: "1px solid var(--border)",
                                            borderRadius: "var(--radius-sm)",
                                            fontSize: 12,
                                            padding: "4px 8px",
                                        }}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="production"
                                        stroke="var(--accent)"
                                        strokeWidth={2.5}
                                        fill="url(#agriAreaGrad)"
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Variety Profit Breakdown */}
                    <div className="dashboard-insight-card">
                        <div className="dashboard-insight-card__header">
                            <div>
                                <span className="dashboard-insight-card__title">
                                    Profit Forecast
                                </span>
                                <span className="dashboard-insight-card__sub">
                                    By variety · Total ₹4,89,680
                                </span>
                            </div>
                            <span className="dashboard-insight-card__badge dashboard-insight-card__badge--profit">
                                Highest: Basmati
                            </span>
                        </div>

                        <div className="dashboard-profit-bars">
                            {crops.map((c) => {
                                const maxProfit = 213200;
                                const barWidth = Math.round(
                                    (c.expectedProfit / maxProfit) * 100,
                                );
                                return (
                                    <div
                                        key={c.id}
                                        className="dashboard-profit-bar-row"
                                    >
                                        <span className="dashboard-profit-bar-name">
                                            {c.variety}
                                        </span>
                                        <div className="dashboard-profit-bar-track">
                                            <div
                                                className="dashboard-profit-bar-fill"
                                                style={{
                                                    width: `${barWidth}%`,
                                                }}
                                            />
                                        </div>
                                        <span className="dashboard-profit-bar-val">
                                            ₹
                                            {(c.expectedProfit / 1000).toFixed(
                                                0,
                                            )}
                                            k
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </motion.section>
        </div>
    );
}
