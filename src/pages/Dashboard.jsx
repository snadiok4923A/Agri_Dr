import { Suspense, lazy, useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "../hooks/useLanguage";
import useMediaQuery from "../hooks/useMediaQuery";
import { farmData, crops } from "../data/mockData";
import {
    ChevronRight,
    Wheat,
    Camera,
    RotateCcw,
    ScanLine,
    Pill,
    MapPinOff,
    CloudOff,
    Droplets,
    Wind,
} from "lucide-react";
import {
    AgriActionIcon,
    WeatherConditionIllustration,
} from "../components/common/AgriIllustrations";
import AnimatedNumber from "../components/common/AnimatedNumber";
import WeatherModal from "../components/common/WeatherModal";
import CameraModal from "../components/common/CameraModal";
import VoiceModeCard from "../components/dashboard/VoiceModeCard";
import MarketCard from "../components/dashboard/MarketCard";
import { VOICE_OPEN_WEATHER_EVENT } from "../hooks/useVoiceMode";
import { registerOverlay } from "../voice/overlayBus";
import { useWeather } from "../hooks/useWeather";
import "./Dashboard.css";

// Large plant logo for the Expected/Potential hero card — public asset,
// base-path aware so it resolves identically on localhost and GitHub Pages.
const PLANT_LOGO = `${import.meta.env.BASE_URL}plant.svg`;

/* The one recharts surface on this page (the Production Trends mini chart)
   is a below-the-fold decoration, so it is its own lazily-loaded chunk.
   That keeps the whole charting library OUT of the eager dashboard bundle
   — the first paint only pays for the shell, and the chart streams in on
   the same frame budget as the rest of the page (spec §22). Its fallback
   is the chart's own fixed-height wrapper, so nothing ever shifts (§9). */
const ProductionTrendChart = lazy(
    () => import("../components/dashboard/ProductionTrendChart"),
);

/* Staggered mount reveal for the page sections.
   PERF: this replaces the framer-motion `variants` that used to drive these
   nine sections. A CSS animation on transform/opacity runs entirely on the
   compositor and needs no JS driving style writes per frame, so the reveal
   costs nothing during hydration or interaction — and it lets framer-motion
   leave the eagerly-loaded dashboard bundle altogether. The delay is passed
   per section as an inline custom property; the visual result (14px rise,
   0.45s, cubic-bezier(0.16, 1, 0.3, 1), 60ms stagger) is unchanged. */
const reveal = (i) => ({ style: { "--reveal-delay": `${i * 60}ms` } });

export default function Dashboard() {
    const { t, formatNumber, language } = useLanguage();
    const navigate = useNavigate();
    // Real weather state — location permission → Open-Meteo fetch → this card.
    // The card stays a pure presentation of `weather`; all fetching lives in
    // the services layer (spec §24).
    const { status: weatherStatus, weather, locationError, retryLocation } = useWeather();
    const weatherReady = weatherStatus === "ready" && !!weather;

    /* Weather-condition → gradient class (§ granular map). Driven by the
       REAL WMO conditionKey + raw code from weatherService, never by the
       displayed text — Bengali and English labels resolve from the same
       key, so both languages always get the same gradient.
       Intensity ladder: clear < partly < overcast < lightRain < rain <
       heavyRain < thunder. Rain intensity comes from the raw WMO code
       (61 slight · 62 moderate · 63–65 heavy · 80/81/82 showers). */
    const WX_GRADIENT = {
        clear: "clear",
        mainlyClear: "clear",
        partlyCloudy: "partly",
        overcast: "overcast",
        fog: "fog",
        drizzle: "lightRain",
        freezingDrizzle: "lightRain",
        snowfall: "snow",
        snowGrains: "snow",
        snowShowers: "snow",
        thunderstorm: "thunder",
        thunderstormHail: "thunder",
    };
    let wxGroup = weatherReady
        ? WX_GRADIENT[weather.current.conditionKey]
        : null;
    if (weatherReady && !wxGroup) {
        /* Rain-family keys collapse several codes — split by raw code. */
        const k = weather.current.conditionKey;
        const c = weather.current.code;
        if (k === "rain") {
            wxGroup = !c || c <= 61 ? "lightRain" : c === 62 ? "rain" : "heavyRain";
        } else if (k === "freezingRain") {
            wxGroup = c === 66 ? "rain" : "heavyRain";
        } else if (k === "rainShowers") {
            wxGroup = !c || c === 80 ? "lightRain" : c === 81 ? "rain" : "heavyRain";
        } else {
            wxGroup = "partly"; /* unknown → calm fallback */
        }
    }
    const wxBgClass = wxGroup ? `wx-bg--${wxGroup}` : "";
    /* Scene ANIMATION kind (§ static-first spec): rain/thunderstorm ONLY.
       Every other condition is the static weather gradient — no scene at
       all. Thunder = the real thunderstorm WMO codes; rain = the rest of
       the rain family (drizzle, rain, showers, freezing rain). */
    const wxSceneKind =
        weatherReady &&
        (weather.current.conditionKey === "thunderstorm" ||
            weather.current.conditionKey === "thunderstormHail")
            ? "thunder"
            : wxGroup === "lightRain" || wxGroup === "rain" || wxGroup === "heavyRain"
              ? "rain"
              : null;

    /* Condition text auto-fit: shrinks the condition's font just enough
       that ANY condition (English or Bengali) stays on ONE line, fully
       inside the card. Pure layout measurement — no data/API logic.
       No ellipsis, no clipping: the size converges until it fits. */
    const condRef = useRef(null);
    useEffect(() => {
        const el = condRef.current;
        if (!el) return;
        /* PERF: the original fit shrank the type 0.5px at a time and re-read
           `scrollWidth` after every single write — up to 40 forced
           synchronous layouts in one pass, re-run on every weather and
           language change and on every parent resize. Rendered text width
           scales linearly with font-size, so one proportional estimate
           lands within a fraction of a pixel and a single verification
           pass covers the wrap-threshold edge cases: 2 measurements
           instead of 40, for the same visual result (still one line, never
           clipped, never ellipsised). */
        const MIN_SIZE = 9;
        const fit = () => {
            const avail = el.parentElement?.clientWidth;
            if (!avail) return;
            el.style.fontSize = "";
            const base = parseFloat(getComputedStyle(el).fontSize);
            if (!base) return;
            const width = el.scrollWidth;
            if (width <= avail) return; // already fits — no writes at all
            let size = Math.max(MIN_SIZE, base * (avail / width));
            el.style.fontSize = `${size}px`;
            const check = el.scrollWidth;
            if (check > avail && size > MIN_SIZE) {
                size = Math.max(MIN_SIZE, size * (avail / check));
                el.style.fontSize = `${size}px`;
            }
        };
        fit();
        /* ResizeObserver only re-fits when the available width ACTUALLY
           changed — the font-size writes above would otherwise feed the
           observer back into itself on every pass. */
        const parent = el.parentElement;
        if (!parent) return;
        let lastAvail = parent.clientWidth;
        const ro = new ResizeObserver(() => {
            if (parent.clientWidth === lastAvail) return;
            lastAvail = parent.clientWidth;
            fit();
        });
        ro.observe(parent);
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
            <section className="dashboard-reveal dashboard-greeting-row" {...reveal(0)}>
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

            </section>

            {/* Desktop row 1: [Production + Weather | Voice Mode]. On mobile
                this wrapper is a plain pass-through (single child) — Voice Mode
                renders separately below, inside the mobile pair. */}
            <div className="dashboard-desktop-row">
            {/* ==================== 2. PRODUCTION + WEATHER ROW ==================== */}
            <section className="dashboard-reveal dashboard-top-row" {...reveal(1)}>
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
                                decoding="async"
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
                    {weatherReady && wxSceneKind && (
                        /* Rain/thunder scene — lives BEHIND the content
                           (z 0 vs z 1), upper zone only, aria-hidden.
                           Renders ONLY for rain (streaks) and thunderstorm
                           (streaks + occasional flash); every other
                           condition shows the static gradient alone. */
                        <div
                            className={`wx-scene wx-scene--${wxGroup} wx-scene--${wxSceneKind}`}
                            aria-hidden="true"
                        >
                            <span className="wx-scene__drop wx-scene__drop--1" />
                            <span className="wx-scene__drop wx-scene__drop--2" />
                            <span className="wx-scene__drop wx-scene__drop--3" />
                            <span className="wx-scene__drop wx-scene__drop--4" />
                            <span className="wx-scene__bolt" />
                        </div>
                    )}
                    {weatherReady ? (
                        <>
                            {/* TOP ROW — icon left · temperature right */}
                            <div className="dashboard-weather-card__top">
                                <span className="dashboard-weather-card__icon">
                                    {/* The SAME shared weather icon the floating
                                        Current Weather window renders — one
                                        component, one conditionKey source, so
                                        card and window always match. Rendered
                                        static here (animation stripped in CSS). */}
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

                            {/* BOTTOM ROW — Wind left · Humidity right (real
                                current relative humidity from the same
                                Open-Meteo response). Reference layout:
                                large icon beside a two-line text block, the
                                icon centered against the full text height. */}
                            <div className="dashboard-weather-card__meta">
                                <div className="dashboard-weather-card__cell">
                                    <span className="dashboard-weather-card__cell-icon">
                                        <Wind size={24} strokeWidth={1.9} />
                                    </span>
                                    <span className="dashboard-weather-card__cell-text">
                                        <span className="dashboard-weather-card__cell-label">
                                            {t("weather.wind")}
                                        </span>
                                        <span className="dashboard-weather-card__cell-value">
                                            {formatNumber(Math.round(weather.current.wind))} km/h
                                        </span>
                                    </span>
                                </div>
                                <div className="dashboard-weather-card__cell dashboard-weather-card__cell--humidity">
                                    <span className="dashboard-weather-card__cell-icon">
                                        <Droplets size={24} strokeWidth={1.9} />
                                    </span>
                                    <span className="dashboard-weather-card__cell-text">
                                        <span className="dashboard-weather-card__cell-label">
                                            {t("weather.humidity")}
                                        </span>
                                        <span className="dashboard-weather-card__cell-value">
                                            {weather.current.humidity != null
                                                ? `${formatNumber(Math.round(weather.current.humidity))}%`
                                                : "—%"}
                                        </span>
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
            </section>

            {/* Voice Mode: desktop — beside the Weather card (inside row 1);
                mobile — rendered inside the pair below, after Crop Diagnosis. */}
            {!isMobile && (
                <section className="dashboard-reveal dashboard-voice-row" {...reveal(2)}>
                    <VoiceModeCard />
                </section>
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
            <section className="dashboard-reveal dashboard-diagnosis-section" {...reveal(2)}>
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
                                className="dashboard-diagnosis-btn dashboard-diagnosis-btn--upload"
                                onClick={() => uploadInputRef.current?.click()}
                            >
                                {/* The lucide "Upload" glyph as TWO stacked
                                    16px SVGs with identical geometry/stroke:
                                    the tray svg stays in flow (static, and
                                    reserves the icon slot); the arrow svg is
                                    an absolutely positioned layer whose
                                    containing block is the BUTTON itself —
                                    so its animated `top` is computed from
                                    the button's real height and it can
                                    travel the button's full interior until
                                    it passes behind the top inner edge.
                                    Geometry matches <Upload size={16} />. */}
                                <span className="dashboard-diagnosis-upload-icon">
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        width="16"
                                        height="16"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        aria-hidden="true"
                                    >
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                    </svg>
                                    <svg
                                        className="dashboard-diagnosis-upload-arrow"
                                        xmlns="http://www.w3.org/2000/svg"
                                        width="16"
                                        height="16"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        aria-hidden="true"
                                    >
                                        <polyline points="17 8 12 3 7 8" />
                                        <line x1="12" y1="3" x2="12" y2="15" />
                                    </svg>
                                </span>
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
            </section>

            {/* Market: desktop — beside Crop Diagnosis (inside row 2); mobile —
                rendered inside the pair below. */}
            {!isMobile && (
                <section className="dashboard-reveal dashboard-market-row" {...reveal(3)}>
                    <MarketCard />
                </section>
            )}
            </div>

            {/* Mobile-only pair: Voice Mode + Market side-by-side after Crop
                Diagnosis, before "What Needs Attention?" */}
            {isMobile && (
                <div className="dashboard-mobile-pair">
                    <section className="dashboard-reveal dashboard-voice-row" {...reveal(2)}>
                        <VoiceModeCard />
                    </section>
                    <section className="dashboard-reveal dashboard-market-row" {...reveal(3)}>
                        <MarketCard />
                    </section>
                </div>
            )}

            {/* ==================== 4. IMPORTANT ACTIONS ==================== */}
            <section
                className="dashboard-reveal dashboard-section dashboard-section--actions"
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
            </section>

            {/* ==================== 5. SIMPLE PRODUCTION INSIGHTS ==================== */}
            <section
                className="dashboard-reveal dashboard-section dashboard-section--insights"
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

                        {/* The one recharts surface on the page streams in as
                            its own chunk (below the fold); the fallback
                            reserves the chart's exact height, so the card
                            never shifts when the chart lands. */}
                        <Suspense
                            fallback={
                                <div
                                    className="dashboard-insight-card__chart"
                                    style={{ height: 90 }}
                                />
                            }
                        >
                            <ProductionTrendChart />
                        </Suspense>
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
            </section>
        </div>
    );
}
