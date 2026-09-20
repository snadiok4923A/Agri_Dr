import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { useLanguage } from "../hooks/useLanguage";
import useMediaQuery from "../hooks/useMediaQuery";
import {
    farmData,
    crops,
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
    MapPinOff,
    CloudOff,
    Droplets,
    Wind,
} from "lucide-react";
import { AreaChart, Area, ResponsiveContainer, XAxis, Tooltip } from "recharts";
import {
    WeatherConditionIllustration,
    AgriActionIcon,
} from "../components/common/AgriIllustrations";
import AnimatedNumber from "../components/common/AnimatedNumber";
import WeatherModal from "../components/common/WeatherModal";
import CameraModal from "../components/common/CameraModal";
import VoiceModeCard from "../components/dashboard/VoiceModeCard";
import MarketCard from "../components/dashboard/MarketCard";
import { useVoiceMode, VOICE_OPEN_WEATHER_EVENT } from "../hooks/useVoiceMode";
import { registerOverlay } from "../voice/overlayBus";
import { useWeather } from "../hooks/useWeather";
import "./Dashboard.css";

// Large plant logo for the Expected/Potential hero card — public asset,
// base-path aware so it resolves identically on localhost and GitHub Pages.
const PLANT_LOGO = `${import.meta.env.BASE_URL}plant.svg`;

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
    const { t, formatNumber, language } = useLanguage();
    const navigate = useNavigate();
    // Real weather state — location permission → Open-Meteo fetch → this card.
    // The card stays a pure presentation of `weather`; all fetching lives in
    // the services layer (spec §24).
    const { status: weatherStatus, weather, locationError, retryLocation } = useWeather();
    const weatherReady = weatherStatus === "ready" && !!weather;

    /* Weather-condition → background-gradient group (§ centralized map).
       Driven by the REAL WMO conditionKey from weatherService, never by
       the displayed text. Intensity rises with cloud/rain severity. */
    const WX_BG_GROUP = {
        clear: "clear",
        mainlyClear: "clear",
        partlyCloudy: "partly",
        fog: "cloudy",
        overcast: "rainy",
        drizzle: "rainy",
        freezingDrizzle: "rainy",
        rain: "rainy",
        freezingRain: "rainy",
        snowfall: "rainy",
        snowGrains: "rainy",
        rainShowers: "rainy",
        snowShowers: "rainy",
        thunderstorm: "rainy",
        thunderstormHail: "rainy",
    };
    const wxGroup = weatherReady
        ? WX_BG_GROUP[weather.current.conditionKey] || "partly"
        : null;
    const wxBgClass = wxGroup ? `wx-bg--${wxGroup}` : "";
    /* Partly-cloudy WITH real precipitation → a couple of tiny droplets
       (spec §3: drops only when rain is actually present). */
    const wxShowers =
        wxGroup === "partly" &&
        (weather?.current?.rainProbability ?? 0) >= 40;

    /* Condition text auto-fit: shrinks the condition's font just enough
       that ANY condition (English or Bengali) stays on ONE line, fully
       inside the card. Pure layout measurement — no data/API logic.
       No ellipsis, no clipping: the size converges until it fits. */
    const condRef = useRef(null);
    useEffect(() => {
        const el = condRef.current;
        if (!el) return;
        const fit = () => {
            const avail = el.parentElement.clientWidth;
            if (!avail) return;
            el.style.fontSize = "";
            let size = parseFloat(getComputedStyle(el).fontSize);
            let guard = 0;
            while (el.scrollWidth > avail && size > 9 && guard < 40) {
                size -= 0.5;
                el.style.fontSize = `${size}px`;
                guard += 1;
            }
        };
        fit();
        const ro = new ResizeObserver(fit);
        ro.observe(el.parentElement);
        return () => ro.disconnect();
    }, [weatherReady, weather, language]);
    const locationMsg =
        locationError === "PERMISSION_DENIED"
            ? t("weather.locationDenied")
            : locationError === "TIMEOUT"
              ? t("weather.locationTimeout")
              : locationError === "UNSUPPORTED"
                ? t("weather.locationNeeded")
                : t("weather.locationUnavailable");
    // Mobile breakpoint — switches Voice Mode + Market into the side-by-side
    // pair below Crop Diagnosis without touching the desktop grid pairing.
    const isMobile = useMediaQuery("(max-width: 900px)");
    const shouldReduceMotion = useReducedMotion();

    // Time-of-day greeting, translated (শুভ সকাল / शुभ प्रभात / …)
    const greeting = (() => {
        const hour = new Date().getHours();
        if (hour < 12) return t("dashboard.greeting");
        if (hour < 17) return t("dashboard.greetingAfternoon");
        return t("dashboard.greetingEvening");
    })();

    // Voice-driven dashboard actions: floating weather modal + the crop
    // diagnosis floating workflow. "Take photo" opens the camera stage of
    // the workflow (§28) — never the file picker.
    useEffect(() => {
        const openWeather = () => setWeatherOpen(true);
        const takePhoto = () => setDiagFlow("camera");
        const uploadPhoto = () => uploadInputRef.current?.click();
        window.addEventListener(VOICE_OPEN_WEATHER_EVENT, openWeather);
        window.addEventListener("krisiveda:voice-take-photo", takePhoto);
        window.addEventListener("krisiveda:voice-upload-photo", uploadPhoto);
        // §19/§20: the weather modal registers with the voice overlay bus so
        // "close" closes it and restores the dashboard underneath.
        const unregister = registerOverlay({
            isOpen: () => document.querySelector(".wmodal__overlay") !== null,
            close: () => setWeatherOpen(false),
        });
        const unregisterDiag = registerOverlay({
            isOpen: () => diagFlowRef.current !== "closed",
            close: () => closeDiagFlowRef.current(),
        });
        return () => {
            window.removeEventListener(VOICE_OPEN_WEATHER_EVENT, openWeather);
            window.removeEventListener("krisiveda:voice-take-photo", takePhoto);
            window.removeEventListener("krisiveda:voice-upload-photo", uploadPhoto);
            unregister();
            unregisterDiag();
        };
    }, []);

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

    // Weather card → centered glass modal (not navigation)
    const [weatherOpen, setWeatherOpen] = useState(false);

    /* ---- Crop Diagnosis floating workflow (§22 single state machine) ----
       closed → camera → photo-preview → analysis. One controlled state, no
       boolean soup. The captured/uploaded photo NEVER enters the dashboard
       card — every post-selection stage lives inside the floating window
       (§2/§26). Voice "close" closes it via the overlay bus (latest-ref
       pattern, so the registration never captures stale state). */
    const [diagFlow, setDiagFlow] = useState("closed"); // closed | camera | photo-preview | analysis
    const [diagPhoto, setDiagPhoto] = useState(null); // { file, url, source }
    const uploadInputRef = useRef(null);
    const diagPhotoUrlRef = useRef(null);
    const diagFlowRef = useRef("closed");
    diagFlowRef.current = diagFlow;
    const closeDiagFlowRef = useRef(null);

    /* §25: release the object URL of the current preview photo. */
    const releaseDiagPhoto = useCallback(() => {
        if (diagPhotoUrlRef.current) {
            URL.revokeObjectURL(diagPhotoUrlRef.current);
            diagPhotoUrlRef.current = null;
        }
        setDiagPhoto(null);
    }, []);

    /* §9: the single image entry point — a camera capture (video → canvas →
       Blob → File) and an uploaded File both land here, then open the SAME
       photo-preview floating window. The dashboard card is never touched. */
    const handleSelectedImage = useCallback((file, source) => {
        if (!file) return;
        if (diagPhotoUrlRef.current) URL.revokeObjectURL(diagPhotoUrlRef.current);
        const url = URL.createObjectURL(file);
        diagPhotoUrlRef.current = url;
        setDiagPhoto({ file, url, source });
        setDiagFlow("photo-preview");
    }, []);

    /* §21: analysis close → back to the preview (photo still available);
       preview/camera close → dashboard. Photo release happens when the
       flow actually closes (effect below). */
    const closeDiagFlow = useCallback(() => {
        setDiagFlow((cur) => (cur === "analysis" ? "photo-preview" : "closed"));
    }, []);
    closeDiagFlowRef.current = closeDiagFlow;

    useEffect(() => {
        if (diagFlow === "closed") releaseDiagPhoto();
    }, [diagFlow, releaseDiagPhoto]);
    useEffect(() => releaseDiagPhoto, [releaseDiagPhoto]); // unmount (§25)

    // Simple, high-priority action cards — labels resolve through i18n
    const gapT = formatNumber(
        +(farmData.potentialYield - totalYield).toFixed(1),
        { minimumFractionDigits: 1 }
    );
    const actionItems = [
        {
            id: "med",
            type: "medicine",
            title: t("dashboard.leafBlastTreatment"),
            subtitle: t("dashboard.sprayTricyclazole"),
            badge: t("dashboard.actionNeeded"),
            path: "/disease",
        },
        {
            id: "fert",
            type: "fertilizer",
            title: t("dashboard.ureaTopDressing"),
            subtitle: t("dashboard.ureaRequired"),
            badge: t("dashboard.dueTomorrow"),
            path: "/fertilizer",
        },
        {
            id: "mkt",
            type: "market",
            title: t("dashboard.basmatiPriceUp"),
            subtitle: t("dashboard.basmatiAtMandi"),
            badge: t("dashboard.sellPremium"),
            path: "/market",
        },
        {
            id: "yield",
            type: "production",
            title: t("dashboard.profitOpportunity"),
            subtitle: t("dashboard.closeGap", { n: gapT }),
            badge: "+78% " + t("crops.margin"),
            path: "/improve",
        },
    ];

    return (
        <div className="page-container dashboard-page">
            {/* Desktop: two content-sized rows pair the right cards beside the
                main content ([Production+Weather | Voice], [Diagnosis | Market]).
                Mobile: single column — Voice Mode and Market pair up side-by-side
                after Crop Diagnosis. */}
            {/* ==================== 1. GREETING + WEATHER ==================== */}
            <motion.section className="dashboard-greeting-row" {...reveal(0)}>
                <div className="dashboard-greeting-left">
                    <span className="dashboard-greeting-tag">
                        <Wheat size={14} className="dashboard-greeting-icon" />
                        {farmData.name} · {formatNumber(farmData.totalLand)}{" "}
                        {t("dashboard.acres")}
                    </span>
                    <h1 className="dashboard-greeting-title">
                        {greeting}, {farmData.owner}
                    </h1>
                </div>

            </motion.section>

            {/* Desktop row 1: [Production + Weather | Voice Mode]. On mobile
                this wrapper is a plain pass-through (single child) — Voice Mode
                renders separately below, inside the mobile pair. */}
            <div className="dashboard-desktop-row">
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
                            <img
                                src={PLANT_LOGO}
                                alt=""
                                className="dashboard-ring-artwork-img"
                                draggable={false}
                            />
                        </div>
                    </div>

                    {/* Expected vs Potential — big numbers only */}
                    <div className="dashboard-hero-stats">
                        <div className="dashboard-hero-stat">
                            <span className="dashboard-hero-stat-num">
                                <AnimatedNumber value={currentEst} decimals={1} />
                                <em>T</em>
                            </span>
                            <span className="dashboard-hero-stat-cap">{t("dashboard.expected")}</span>
                        </div>
                        <div className="dashboard-hero-stat-sep" />
                        <div className="dashboard-hero-stat">
                            <span className="dashboard-hero-stat-num dashboard-hero-stat-num--potential">
                                <AnimatedNumber value={totalYield} decimals={1} />
                                <em>T</em>
                            </span>
                            <span className="dashboard-hero-stat-cap">{t("dashboard.potential")}</span>
                        </div>
                    </div>
                </div>

                {/* Weather card — icon top-center, prominent temp, condition,
                    humidity/wind bottom. Values come from the real Open-Meteo
                    response for the user's actual coordinates — never hard-coded
                    (demo numbers appear only as pre-data placeholder states). */}
                <div
                    className={`dashboard-weather-card ${wxBgClass}`}
                    onClick={() => weatherReady && setWeatherOpen(true)}
                    role="button"
                    tabIndex={0}
                    title={t("dashboard.viewWeather")}
                >
                    {weatherReady && wxGroup && (
                        /* Animated weather scene — lives BEHIND the content
                           (z 0 vs z 1), upper-left→middle only, aria-hidden.
                           Same wx-group class as the gradient, so the scene's
                           intensity tracks the real weather condition. */
                        <div
                            className={`wx-scene wx-scene--${wxGroup}${
                                wxShowers ? " wx-scene--showers" : ""
                            }`}
                            aria-hidden="true"
                        >
                            <span className="wx-scene__cloud wx-scene__cloud--1" />
                            <span className="wx-scene__cloud wx-scene__cloud--2" />
                            <span className="wx-scene__cloud wx-scene__cloud--3" />
                            <span className="wx-scene__drop wx-scene__drop--1" />
                            <span className="wx-scene__drop wx-scene__drop--2" />
                            <span className="wx-scene__drop wx-scene__drop--3" />
                            <span className="wx-scene__drop wx-scene__drop--4" />
                            <span className="wx-scene__sun" />
                            <span className="wx-scene__ray wx-scene__ray--1" />
                            <span className="wx-scene__ray wx-scene__ray--2" />
                        </div>
                    )}
                    {weatherReady ? (
                        <>
                            {/* TOP ROW — icon left · temperature right */}
                            <div className="dashboard-weather-card__top">
                                <span className="dashboard-weather-card__icon">
                                    <WeatherConditionIllustration
                                        condition={weather.current.conditionKey}
                                        size={76}
                                    />
                                </span>
                                <div className="dashboard-weather-card__tempblock">
                                    <span className="dashboard-weather-card__temp">
                                        {formatNumber(Math.round(weather.current.temperature))}°C
                                    </span>
                                </div>
                            </div>

                            {/* MIDDLE ROW — the condition is the card's main
                                secondary information and owns the row */}
                            <div className="dashboard-weather-card__mid">
                                <span
                                    className="dashboard-weather-card__cond"
                                    ref={condRef}
                                >
                                    {t(
                                        `weather.cond${weather.current.conditionKey
                                            .charAt(0)
                                            .toUpperCase()}${weather.current.conditionKey.slice(1)}`,
                                    )
                                        .split(/\s+/)
                                        .map((word, i) => (
                                            <span key={i}>{word}</span>
                                        ))}
                                </span>
                            </div>

                            {/* BOTTOM ROW — Wind left · Rain right (real
                                precipitation probability) */}
                            <div className="dashboard-weather-card__meta">
                                <div className="dashboard-weather-card__cell">
                                    <span className="dashboard-weather-card__cell-label">
                                        <Wind size={12} />
                                        {t("weather.wind")}
                                    </span>
                                    <span className="dashboard-weather-card__cell-value">
                                        {formatNumber(Math.round(weather.current.wind))} km/h
                                    </span>
                                </div>
                                <div className="dashboard-weather-card__cell dashboard-weather-card__cell--rain">
                                    <span className="dashboard-weather-card__cell-label">
                                        <Droplets size={12} />
                                        {t("weather.rain")}
                                    </span>
                                    <span className="dashboard-weather-card__cell-value">
                                        {weather.current.rainProbability != null
                                            ? `${formatNumber(Math.round(weather.current.rainProbability))}%`
                                            : "—%"}
                                    </span>
                                </div>
                            </div>
                        </>
                    ) : weatherStatus === "loading" ? (
                        /* Weather fetch in flight — coordinates already known */
                        <div className="dashboard-weather-card__state">
                            <div className="dashboard-weather-card__state-icon dashboard-weather-card__state-icon--loading">
                                <WeatherConditionIllustration
                                    condition="partlyCloudy"
                                    size={56}
                                />
                            </div>
                            <span className="dashboard-weather-card__state-text">
                                {t("weather.weatherLoading")}
                            </span>
                        </div>
                    ) : weatherStatus === "locating" || weatherStatus === "idle" ? (
                        /* Geolocation running (the permission dialog may be
                           open) — ALWAYS a locating state, never an error,
                           until the callback actually returns (§1/§3/§7). */
                        <div className="dashboard-weather-card__state">
                            <div className="dashboard-weather-card__state-icon dashboard-weather-card__state-icon--loading">
                                <WeatherConditionIllustration
                                    condition="partlyCloudy"
                                    size={56}
                                />
                            </div>
                            <span className="dashboard-weather-card__state-text">
                                {t("weather.locating")}
                            </span>
                        </div>
                    ) : (
                        /* Permission denied / unsupported / network or API error */
                        <div className="dashboard-weather-card__state">
                            <div className="dashboard-weather-card__state-icon">
                                {weatherStatus === "locError" ? (
                                    <MapPinOff size={30} />
                                ) : (
                                    <CloudOff size={30} />
                                )}
                            </div>
                            <span className="dashboard-weather-card__state-text">
                                {weatherStatus === "wxError"
                                    ? t("weather.weatherUnavailable")
                                    : locationMsg}
                            </span>
                            <button
                                className="dashboard-weather-card__retry"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    retryLocation();
                                }}
                            >
                                <RotateCcw size={13} />
                                {t("weather.retryLocation")}
                            </button>
                        </div>
                    )}
                </div>
            </motion.section>

            {/* Voice Mode: desktop — beside the Weather card (inside row 1);
                mobile — rendered inside the pair below, after Crop Diagnosis. */}
            {!isMobile && (
                <motion.section className="dashboard-voice-row" {...reveal(2)}>
                    <VoiceModeCard />
                </motion.section>
            )}
            </div>

            {/* Weather detail modal (opens over the dashboard) */}
            <WeatherModal
                open={weatherOpen}
                onClose={() => setWeatherOpen(false)}
            />

            {/* Crop Diagnosis floating workflow — camera → photo preview →
                analysis. One controlled stage machine; the photo stays in
                the floating windows and NEVER enters the dashboard card. */}
            <CameraModal
                open={diagFlow !== "closed"}
                flow={diagFlow}
                photo={diagPhoto}
                onClose={closeDiagFlow}
                onCapture={(file) => handleSelectedImage(file, "camera")}
                onRetake={() => setDiagFlow("camera")}
                onChooseAnother={() => uploadInputRef.current?.click()}
                onAnalyze={() => setDiagFlow("analysis")}
            />

            {/* Desktop row 2: [Crop Diagnosis | Market]. On mobile this wrapper
                is a plain pass-through (single child) — Market renders
                separately below, inside the mobile pair. */}
            <div className="dashboard-desktop-row">
            {/* ==================== 3. CROP DIAGNOSIS (AI PHOTO) ==================== */}
            <motion.section className="dashboard-diagnosis-section" {...reveal(2)}>
                <div className="dashboard-diagnosis-card">
                    <div className="dashboard-diagnosis-info">
                        <span className="dashboard-diagnosis-tag">
                            <ScanLine size={13} />
                            {t("dashboard.aiPlantDoctor")}
                        </span>
                        <h3 className="dashboard-diagnosis-title">{t("dashboard.cropDiagnosis")}</h3>
                        <p className="dashboard-diagnosis-sub">
                            {t("dashboard.diagnosisSub")}
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
                                onClick={() => setDiagFlow("camera")}
                            >
                                <Camera size={18} />
                                {t("dashboard.takePhoto")}
                            </button>
                            <button
                                className="dashboard-diagnosis-btn"
                                onClick={() => uploadInputRef.current?.click()}
                            >
                                <Upload size={16} />
                                {t("dashboard.uploadPhoto")}
                            </button>
                        </div>

                        {/* Hidden input: Upload Photo → the normal browser
                            file picker; the chosen file opens the photo
                            preview floating window (§8/§28). */}
                        <input
                            ref={uploadInputRef}
                            type="file"
                            accept="image/*"
                            hidden
                            onChange={(e) => {
                                handleSelectedImage(e.target.files?.[0], "upload");
                                e.target.value = ""; // allow re-selecting later
                            }}
                        />
                    </div>
                </div>
            </motion.section>

            {/* Market: desktop — beside Crop Diagnosis (inside row 2); mobile —
                rendered inside the pair below. */}
            {!isMobile && (
                <motion.section className="dashboard-market-row" {...reveal(3)}>
                    <MarketCard />
                </motion.section>
            )}
            </div>

            {/* Mobile-only pair: Voice Mode + Market side-by-side after Crop
                Diagnosis, before "What Needs Attention?" */}
            {isMobile && (
                <div className="dashboard-mobile-pair">
                    <motion.section className="dashboard-voice-row" {...reveal(2)}>
                        <VoiceModeCard />
                    </motion.section>
                    <motion.section className="dashboard-market-row" {...reveal(3)}>
                        <MarketCard />
                    </motion.section>
                </div>
            )}

            {/* ==================== 4. IMPORTANT ACTIONS ==================== */}
            <motion.section
                className="dashboard-section dashboard-section--actions"
                {...reveal(3)}
            >
                <div className="dashboard-section-header">
                    <h3 className="dashboard-section-title">
                        {t("dashboard.whatNeedsAttention")}
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
            <motion.section
                className="dashboard-section dashboard-section--insights"
                {...reveal(4)}
            >
                <div className="dashboard-section-header">
                    <h3 className="dashboard-section-title">
                        {t("dashboard.productionTrends")}
                    </h3>
                    <span
                        className="dashboard-section-link"
                        onClick={() => navigate("/insights")}
                    >
                        {t("dashboard.deepAnalytics")}
                    </span>
                </div>

                <div className="dashboard-insights-grid">
                    {/* Visual Mini Chart: Cumulative Production */}
                    <div className="dashboard-insight-card">
                        <div className="dashboard-insight-card__header">
                            <div>
                                <span className="dashboard-insight-card__title">
                                    {t("dashboard.productionForecast")}
                                </span>
                                <span className="dashboard-insight-card__sub">
                                    {t("dashboard.aprilToSeptember")}
                                </span>
                            </div>
                            <span className="dashboard-insight-card__badge">
                                {t("dashboard.target")}
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
                                            fontSize: "min(max(calc(10px * var(--ts-small, 1)), 8px), 17px)",
                                            fill: "var(--text-muted)",
                                        }}
                                        axisLine={false}
                                        tickLine={false}
                                    />
                                    <Tooltip
                                        formatter={(val) => [
                                            `${formatNumber(val)} ${t("common.ton")}`,
                                            t("dashboard.projectedYield"),
                                        ]}
                                        contentStyle={{
                                            background: "var(--bg-surface)",
                                            border: "1px solid var(--border)",
                                            borderRadius: "var(--radius-sm)",
                                            fontSize: "min(max(calc(12px * var(--ts-body, 1)), 9px), 24px)",
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
                                    {t("dashboard.profitForecast")}
                                </span>
                                <span className="dashboard-insight-card__sub">
                                    {t("dashboard.byVariety")}
                                </span>
                            </div>
                            <span className="dashboard-insight-card__badge dashboard-insight-card__badge--profit">
                                {t("dashboard.highest")}
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
                                            {formatNumber(
                                                +(c.expectedProfit / 1000).toFixed(0)
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
