import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { useLanguage } from "../hooks/useLanguage";
import {
    farmData,
    crops,
    weatherData,
    analyticsData,
} from "../data/mockData";
import {
    ChevronRight,
    Wheat,
    Camera,
    Upload,
    RotateCcw,
    ScanLine,
    Pill,
    ArrowRight,
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

    const totalYield = farmData.expectedYield;
    const currentEst = farmData.currentProductionEstimate;
    const yieldPct = Math.round((currentEst / totalYield) * 100);

    // Circular progress calculations (Radius 70, Stroke 10, Box 160)
    const ringRadius = 48;
    const ringCircumference = 2 * Math.PI * ringRadius;
    const ringOffset = ringCircumference - (yieldPct / 100) * ringCircumference;

    // ---- Crop Diagnosis (photo → AI analysis → treatment) ----
    const [photo, setPhoto] = useState(null);
    const [diagStage, setDiagStage] = useState("idle"); // idle | preview | analyzing | result
    const cameraInputRef = useRef(null);
    const uploadInputRef = useRef(null);
    const analyzeTimerRef = useRef(null);

    const handlePick = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            setPhoto(reader.result);
            setDiagStage("preview");
        };
        reader.readAsDataURL(file);
        e.target.value = "";
    };

    const startAnalysis = () => {
        setDiagStage("analyzing");
        analyzeTimerRef.current = setTimeout(() => setDiagStage("result"), 2400);
    };

    const resetDiagnosis = () => {
        clearTimeout(analyzeTimerRef.current);
        setPhoto(null);
        setDiagStage("idle");
    };

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

            </motion.section>

            {/* ==================== 2. PRODUCTION + WEATHER ROW ==================== */}
            <motion.section className="dashboard-top-row" {...reveal(1)}>
                {/* Compact Production Summary (left) */}
                <div className="dashboard-hero-card">
                    {/* Rice visual inside a subtle progress ring */}
                    <div className="dashboard-ring-container">
                        <svg
                            className="dashboard-ring-svg"
                            width="112"
                            height="112"
                            viewBox="0 0 112 112"
                        >
                            <circle
                                cx="56"
                                cy="56"
                                r={ringRadius}
                                className="dashboard-ring-bg"
                                strokeWidth="7"
                            />
                            <circle
                                cx="56"
                                cy="56"
                                r={ringRadius}
                                className="dashboard-ring-fill"
                                strokeWidth="7"
                                strokeDasharray={ringCircumference}
                                strokeDashoffset={ringOffset}
                                strokeLinecap="round"
                                transform="rotate(-90 56 56)"
                            />
                        </svg>
                        <div className="dashboard-ring-artwork">
                            <RicePlantIllustration size={64} />
                        </div>
                    </div>

                    {/* Expected vs Potential — big numbers only */}
                    <div className="dashboard-hero-stats">
                        <div className="dashboard-hero-stat">
                            <span className="dashboard-hero-stat-num">
                                <AnimatedNumber value={currentEst} decimals={1} />
                                <em>T</em>
                            </span>
                            <span className="dashboard-hero-stat-cap">Expected</span>
                        </div>
                        <div className="dashboard-hero-stat-sep" />
                        <div className="dashboard-hero-stat">
                            <span className="dashboard-hero-stat-num dashboard-hero-stat-num--potential">
                                <AnimatedNumber value={totalYield} decimals={1} />
                                <em>T</em>
                            </span>
                            <span className="dashboard-hero-stat-cap">Potential</span>
                        </div>
                    </div>
                </div>

                {/* Compact Weather Panel (right) */}
                <div
                    className="dashboard-weather-card"
                    onClick={() => navigate("/weather")}
                    role="button"
                    tabIndex={0}
                    title="View Weather & Spraying Advisory"
                >
                    <span className="dashboard-weather-card__label">Weather</span>
                    <div className="dashboard-weather-card__main">
                        <span className="dashboard-weather-card__icon">
                            <WeatherSunCloudIllustration size={40} />
                        </span>
                        <span className="dashboard-weather-card__temp">
                            {weatherData.current.temperature}°
                        </span>
                    </div>
                    <div className="dashboard-weather-card__cond">
                        {weatherData.current.condition}
                    </div>
                    <div className="dashboard-weather-card__meta">
                        <span className="dashboard-weather-card__meta-item">
                            <span className="dashboard-weather-card__meta-ico">💧</span>
                            {weatherData.current.humidity}%
                        </span>
                        <span className="dashboard-weather-card__meta-item">
                            <span className="dashboard-weather-card__meta-ico">💨</span>
                            {weatherData.current.wind} km/h
                        </span>
                    </div>
                </div>
            </motion.section>

            {/* ==================== 3. CROP DIAGNOSIS (AI PHOTO) ==================== */}
            <motion.section className="dashboard-diagnosis-section" {...reveal(2)}>
                <div className="dashboard-diagnosis-card">
                    <div className="dashboard-diagnosis-info">
                        <span className="dashboard-diagnosis-tag">
                            <ScanLine size={13} />
                            AI Plant Doctor
                        </span>
                        <h3 className="dashboard-diagnosis-title">Crop Diagnosis</h3>
                        <p className="dashboard-diagnosis-sub">
                            Snap a photo — AI detects the problem and the treatment
                        </p>

                        {/* Compact 3-step visual workflow: Camera → AI → Treatment */}
                        <div className="dashboard-diagnosis-flow">
                            <span className="dashboard-diagnosis-flow__step">
                                <Camera size={16} />
                            </span>
                            <span className="dashboard-diagnosis-flow__arrow" />
                            <span className="dashboard-diagnosis-flow__step dashboard-diagnosis-flow__step--ai">
                                <ScanLine size={16} />
                            </span>
                            <span className="dashboard-diagnosis-flow__arrow" />
                            <span className="dashboard-diagnosis-flow__step">
                                <Pill size={15} />
                            </span>
                        </div>

                        <div className="dashboard-diagnosis-cta">
                            <button
                                className="dashboard-diagnosis-btn dashboard-diagnosis-btn--primary"
                                onClick={() => cameraInputRef.current?.click()}
                            >
                                <Camera size={18} />
                                Take Photo
                            </button>
                            <button
                                className="dashboard-diagnosis-btn"
                                onClick={() => uploadInputRef.current?.click()}
                            >
                                <Upload size={16} />
                                Upload Photo
                            </button>
                        </div>

                        {/* Hidden inputs: camera capture + file upload */}
                        <input
                            ref={cameraInputRef}
                            type="file"
                            accept="image/*"
                            capture="environment"
                            hidden
                            onChange={handlePick}
                        />
                        <input
                            ref={uploadInputRef}
                            type="file"
                            accept="image/*"
                            hidden
                            onChange={handlePick}
                        />
                    </div>

                    {/* Photo / analysis area — appears only once an image is picked */}
                    {diagStage !== "idle" && (
                        <div className="dashboard-diagnosis-view">
                        {(diagStage === "preview" || diagStage === "analyzing") && (
                            <div className="dashboard-diagnosis-photo">
                                <img src={photo} alt="Crop for diagnosis" />
                                {diagStage === "analyzing" && (
                                    <>
                                        <div className="dashboard-diagnosis-scanline" />
                                        <div className="dashboard-diagnosis-status">
                                            <ScanLine size={14} />
                                            Analyzing crop…
                                        </div>
                                    </>
                                )}
                            </div>
                        )}

                        {diagStage === "result" && (
                            <div className="dashboard-diagnosis-result">
                                <div className="dashboard-diagnosis-result__head">
                                    <span className="dashboard-diagnosis-result__issue">
                                        Possible Issue
                                    </span>
                                    <span className="dashboard-diagnosis-result__confidence">
                                        92% match
                                    </span>
                                </div>
                                <span className="dashboard-diagnosis-result__name">
                                    Leaf Blast
                                </span>
                                <div className="dashboard-diagnosis-result__treatment">
                                    <Pill size={15} />
                                    <div>
                                        <span>Recommended Treatment</span>
                                        <strong>Tricyclazole · 250 g</strong>
                                    </div>
                                </div>
                                <div className="dashboard-diagnosis-result__actions">
                                    <button
                                        className="dashboard-diagnosis-btn dashboard-diagnosis-btn--primary"
                                        onClick={() => navigate("/disease")}
                                    >
                                        Full Guidance
                                        <ArrowRight size={15} />
                                    </button>
                                    <button
                                        className="dashboard-diagnosis-btn"
                                        onClick={resetDiagnosis}
                                    >
                                        <RotateCcw size={14} />
                                        Retake
                                    </button>
                                </div>
                            </div>
                        )}
                        </div>
                    )}
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

            {/* ==================== 5. SIMPLE PRODUCTION INSIGHTS ==================== */}
            <motion.section className="dashboard-section" {...reveal(4)}>
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
