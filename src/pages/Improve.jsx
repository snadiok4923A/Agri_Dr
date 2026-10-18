import { useEffect, useMemo, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { useLanguage } from "../hooks/useLanguage";
import { fields, recommendations } from "../data/mockData";
import {
    Sparkles,
    Wheat,
    IndianRupee,
    ShieldCheck,
    Sprout,
    TrendingUp,
    TrendingDown,
    Bug,
    FlaskConical,
    Activity,
    ArrowRight,
} from "lucide-react";
import EmptyFarmNotice from "../components/onboarding/EmptyFarmNotice";
import { useOnboarding } from "../hooks/useOnboarding";
import { useWeather } from "../hooks/useWeather";
import {
    estimateRegionalBaseline,
    fetchRegionalBaseline,
    fetchModelStatus,
    isRegionalBaselineApiConfigured,
} from "../services/regionalBaselineService";
import "./Improve.css";

// Staggered fade-up reveal (same pattern as the Dashboard)
const sectionVariants = {
    hidden: { opacity: 0, y: 14 },
    show: (i) => ({
        opacity: 1,
        y: 0,
        transition: { duration: 0.45, delay: i * 0.09, ease: "easeOut" },
    }),
};

/*
 * The action cards are general guidance from the existing content library.
 * Their static impact values are intentionally not shown as farmer-specific
 * yield or profit predictions.
 */
const ACTION_META = {
    1: {
        icon: Bug,
        short: "Leaf Blast Treatment",
        tone: "danger",
        urgency: "Action Now",
        tags: ["protection", "yield"],
    },
    2: {
        icon: TrendingDown,
        short: "Production Recovery",
        tone: "danger",
        urgency: "Action Now",
        tags: ["production", "yield"],
    },
    3: {
        icon: FlaskConical,
        short: "Urea Top-Dressing",
        tone: "leaf",
        urgency: "This Week",
        tags: ["growth", "production", "yield"],
    },
    4: {
        icon: TrendingUp,
        short: "Better Price Window",
        tone: "gold",
        urgency: "Good Time",
        tags: ["profit"],
    },
    5: {
        icon: Activity,
        short: "DAP Subsidy",
        tone: "info",
        urgency: "Save Now",
        tags: ["profit"],
    },
};

const URGENCY_TONE = {
    critical: "danger",
    important: "warning",
    recommended: "gold",
    optimization: "info",
};

/* Urgency pill labels resolve through i18n at render time */
const URGENCY_KEY = {
    "Action Now": "improve.actionNow",
    "This Week": "improve.thisWeek",
    "Good Time": "improve.goodTime",
    "Save Now": "improve.saveNow",
};

const formatRegionalNumber = (value, options = {}) => {
    if (value === null || value === undefined || !Number.isFinite(Number(value))) {
        return "—";
    }
    return new Intl.NumberFormat("en-IN", {
        useGrouping: true,
        ...options,
    }).format(Number(value));
};

export default function Improve() {
    const { t, formatNumber } = useLanguage();
    const { farm, isFarmComplete } = useOnboarding();
    const { phase: weatherPhase } = useWeather();
    const shouldReduceMotion = useReducedMotion();
    const [goal, setGoal] = useState("all");
    const [regionalReference, setRegionalReference] = useState(null);
    const [regionalEstimate, setRegionalEstimate] = useState(null);
    const [regionalState, setRegionalState] = useState("loading");
    const [regionalError, setRegionalError] = useState("");
    const [modelState, setModelState] = useState("loading");

    const farmAreaInput = useMemo(() => {
        const parcels = Array.isArray(farm?.parcels) ? farm.parcels : [];
        if (!parcels.length) return { status: "missing" };
        const validParcels = parcels.filter((parcel) => {
            const area = Number(parcel?.area);
            return Number.isFinite(area) && area > 0 && typeof parcel?.unit === "string";
        });
        if (!validParcels.length) return { status: "invalid" };
        const units = new Set(validParcels.map((parcel) => parcel.unit));
        if (units.size !== 1 || !["acre", "hectare"].includes(validParcels[0].unit)) {
            return { status: "invalid", unit: validParcels[0].unit };
        }
        return {
            status: "valid",
            area: validParcels.reduce((sum, parcel) => sum + Number(parcel.area), 0),
            unit: validParcels[0].unit,
        };
    }, [farm]);

    const loadRegionalBaseline = async () => {
        setRegionalState("loading");
        setRegionalError("");
        setRegionalReference(null);
        setRegionalEstimate(null);
        setModelState("loading");
        if (!isRegionalBaselineApiConfigured()) {
            setRegionalState("error");
            setRegionalError("Regional baseline API is not configured.");
            setModelState("unavailable");
            return;
        }
        fetchModelStatus()
            .then((status) => {
                setModelState(status?.mode === "unavailable" ? "unavailable" : "ready");
            })
            .catch(() => {
                setModelState("error");
            });
        try {
            const reference = await fetchRegionalBaseline();
            setRegionalReference(reference);
            if (farmAreaInput.status === "missing") {
                setRegionalState("ready");
                return;
            }
            if (farmAreaInput.status === "invalid") {
                setRegionalState("invalid-area");
                return;
            }
            const estimate = await estimateRegionalBaseline(
                farmAreaInput.area,
                farmAreaInput.unit,
            );
            setRegionalEstimate(estimate);
            setRegionalState("ready");
        } catch (error) {
            setRegionalState("error");
            setRegionalError(error.message || "Regional baseline is unavailable.");
        }
    };

    useEffect(() => {
        if (isFarmComplete) loadRegionalBaseline();
    }, [isFarmComplete, farmAreaInput.status, farmAreaInput.area, farmAreaInput.unit]);

    /* Farm-data-dependent page (spec §13): without the user's own farm
       details there is nothing real to improve — show the empty state
       instead of demo recommendations. */
    if (!isFarmComplete) {
        return (
            <div className="page-container improve-page">
                <section className="improve-page__header section">
                    <h1 className="improve-page__title">{t("nav.improve")}</h1>
                </section>
                <EmptyFarmNotice variant="page" topic="improve" />
            </div>
        );
    }

    const reveal = (i) =>
        shouldReduceMotion
            ? {}
            : {
                  variants: sectionVariants,
                  initial: "hidden",
                  animate: "show",
                  custom: i,
              };

    const criticalCount = recommendations.filter(
        (r) => r.category === "critical",
    ).length;

    // Visual improvement goals — small values derived from real farm data
    const goals = [
        { id: "all", label: t("improve.goalAll"), icon: Sparkles, value: null },
        {
            id: "production",
            label: t("improve.goalProduction"),
            icon: Wheat,
            value: null,
        },
        {
            id: "profit",
            label: t("improve.goalProfit"),
            icon: IndianRupee,
            value: null,
        },
        {
            id: "protection",
            label: t("improve.goalProtection"),
            icon: ShieldCheck,
            value: `${formatNumber(criticalCount)} ${t("improve.alerts")}`,
        },
        {
            id: "growth",
            label: t("improve.goalGrowth"),
            icon: Sprout,
            value: `${formatNumber(fields.length)} ${t("improve.fields")}`,
        },
        { id: "yield", label: t("improve.goalYield"), icon: TrendingUp, value: null },
    ];

    const visibleRecs =
        goal === "all"
            ? recommendations
            : recommendations.filter((rec) =>
                  (ACTION_META[rec.id]?.tags || []).includes(goal),
              );

    const hasRegionalEstimate =
        regionalEstimate?.estimate_available === true &&
        Number.isFinite(Number(regionalEstimate.farm_area)) &&
        Number(regionalEstimate.farm_area) > 0 &&
        typeof regionalEstimate.farm_area_unit === "string" &&
        regionalEstimate.farm_area_unit.trim() !== "" &&
        Number.isFinite(Number(regionalEstimate.illustrative_production_tonnes));

    return (
        <div className="page-container improve-page">
            {/* Header */}
            <section className="improve-page__header section" {...reveal(0)}>
                <h1 className="improve-page__title">{t("nav.improve")}</h1>
                <p className="improve-page__subtitle">
                    Official regional reference and general crop-care guidance.
                </p>
            </section>

            {/* 1. Verified regional reference; not a farm-specific prediction. */}
            <section className="improve-page__hero section" {...reveal(1)}>
                <div className="improve-page__hero-card">
                    <span className="improve-page__ai-pill">
                        <Sparkles size={13} />
                        Verified regional reference
                    </span>
                    {modelState === "loading" && (
                        <p className="improve-page__regional-status">
                            Checking farm-level ML model availability…
                        </p>
                    )}
                    {modelState === "unavailable" && (
                        <p className="improve-page__regional-status">
                            Farm-level ML prediction is unavailable because no trained and validated model is active.
                            No farm-specific yield, profit, or confidence value is shown.
                        </p>
                    )}
                    {modelState === "error" && (
                        <p className="improve-page__regional-status improve-page__regional-status--error">
                            Farm-level ML model status could not be checked. No farm-specific prediction is available.
                        </p>
                    )}
                    {regionalState === "loading" && (
                        <p className="improve-page__regional-status">Loading verified regional reference…</p>
                    )}
                    {regionalState === "error" && (
                        <div className="improve-page__regional-status improve-page__regional-status--error">
                            <p>{regionalError}</p>
                            <button type="button" onClick={loadRegionalBaseline}>Retry</button>
                        </div>
                    )}
                    {regionalReference && (
                        <div className="improve-page__regional-reference">
                            <p className="improve-page__regional-yield">
                                {formatRegionalNumber(regionalReference.yield_kg_per_hectare)} kg/hectare
                            </p>
                            <p className="improve-page__regional-label">
                                Historical West Bengal state-level baseline, not a farm-specific prediction.
                            </p>
                            <p className="improve-page__regional-meta">
                                West Bengal · {regionalReference.reporting_period} · PDF page{" "}
                                {regionalReference.source_page}
                            </p>
                            <p className="improve-page__regional-meta">
                                {regionalReference.table_title}
                            </p>
                        </div>
                    )}
                    {regionalState === "invalid-area" && (
                        <p className="improve-page__regional-status improve-page__regional-status--error">
                            Farmer area is unavailable in a supported unit. The regional reference is shown,
                            but production cannot be estimated.
                        </p>
                    )}
                    {hasRegionalEstimate && (
                        <div className="improve-page__regional-estimate">
                            <strong>
                                {formatRegionalNumber(regionalEstimate.illustrative_production_tonnes, {
                                    minimumFractionDigits: 2,
                                })}{" "}
                                tonnes
                            </strong>
                            <span>
                                Math illustration only: based on the historical West Bengal state-level yield and your{" "}
                                {formatRegionalNumber(regionalEstimate.farm_area, {
                                    maximumFractionDigits: 2,
                                })} {regionalEstimate.farm_area_unit} area. Not a prediction for your farm or Pusa 1121.
                            </span>
                        </div>
                    )}
                    <p className="improve-page__regional-weather">
                        Weather status: {weatherPhase === "ready" ? "available" : "unavailable"}.
                        Weather is not used to adjust this regional statistic.
                    </p>
                </div>
            </section>

            {/* 2. What do you want to improve? */}
            <section className="improve-page__goals section" {...reveal(2)}>
                <h2 className="improve-page__section-title">
                    {t("improve.whatImprove")}
                </h2>
                <div className="improve-page__goal-grid">
                    {goals.map((g) => (
                        <button
                            key={g.id}
                            type="button"
                            className={`improve-page__goal-chip${
                                goal === g.id
                                    ? " improve-page__goal-chip--active"
                                    : ""
                            }`}
                            onClick={() => setGoal(g.id)}
                            aria-pressed={goal === g.id}
                        >
                            <span className={`improve-page__goal-icon improve-page__goal-icon--${g.id}`}>
                                <g.icon size={22} strokeWidth={1.8} />
                            </span>
                            <span className="improve-page__goal-label">
                                {g.label}
                            </span>
                            {g.value && (
                                <span className="improve-page__goal-value">
                                    {g.value}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            </section>

            {/* 3. AI Recommended Actions */}
            <section className="improve-page__actions section" {...reveal(3)}>
                <h2 className="improve-page__section-title">
                    {t("improve.recommendedActions")}
                </h2>
                <div className="improve-page__action-grid">
                    {visibleRecs.map((rec) => {
                        const meta = ACTION_META[rec.id] || {};
                        const Icon = meta.icon || Sparkles;
                        const urgencyTone =
                            URGENCY_TONE[rec.category] || "info";
                        return (
                            <div
                                key={rec.id}
                                className="improve-page__action-card"
                            >
                                <span
                                    className={`improve-page__action-icon improve-page__action-icon--${meta.tone || "info"}`}
                                >
                                    <Icon size={22} strokeWidth={1.8} />
                                </span>

                                <div className="improve-page__action-body">
                                    <h3 className="improve-page__action-title">
                                        {meta.short || rec.title}
                                    </h3>
                                    <span className="improve-page__action-field">
                                        {rec.field?.split("·")[0].trim()}
                                    </span>
                                </div>

                                <div className="improve-page__action-side">
                                    <span className="improve-page__action-value">
                                        General guidance
                                    </span>
                                    <span
                                        className={`improve-page__action-pill improve-page__action-pill--${urgencyTone}`}
                                    >
                                        {URGENCY_KEY[meta.urgency]
                                            ? t(URGENCY_KEY[meta.urgency])
                                            : meta.urgency}
                                    </span>
                                </div>

                                <span
                                    className="improve-page__action-arrow"
                                    aria-hidden="true"
                                >
                                    <ArrowRight size={16} />
                                </span>
                            </div>
                        );
                    })}
                </div>
            </section>
        </div>
    );
}
