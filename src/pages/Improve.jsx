import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useLanguage } from "../hooks/useLanguage";
import { farmData, fields, recommendations } from "../data/mockData";
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
import AnimatedNumber from "../components/common/AnimatedNumber";
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
 * Compact display forms derived from the REAL recommendation data in
 * mockData.js. When a future AI/API replaces `recommendations`, extend
 * this map (or read these fields from the API response) — nothing else
 * in the page needs to change.
 */
const ACTION_META = {
    1: {
        icon: Bug,
        short: "Leaf Blast Treatment",
        value: "+0.50T",
        tone: "danger",
        urgency: "Action Now",
        tags: ["protection", "yield"],
    },
    2: {
        icon: TrendingDown,
        short: "Production Recovery",
        value: "+0.50T",
        tone: "danger",
        urgency: "Action Now",
        tags: ["production", "yield"],
    },
    3: {
        icon: FlaskConical,
        short: "Urea Top-Dressing",
        value: "+0.25T",
        tone: "leaf",
        urgency: "This Week",
        tags: ["growth", "production", "yield"],
    },
    4: {
        icon: TrendingUp,
        short: "Better Price Window",
        value: "+₹18K",
        tone: "gold",
        urgency: "Good Time",
        tags: ["profit"],
    },
    5: {
        icon: Activity,
        short: "DAP Subsidy",
        value: "+₹1.2K",
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

export default function Improve() {
    const { t, formatNumber } = useLanguage();
    const shouldReduceMotion = useReducedMotion();
    const [goal, setGoal] = useState("all");

    const reveal = (i) =>
        shouldReduceMotion
            ? {}
            : {
                  variants: sectionVariants,
                  initial: "hidden",
                  animate: "show",
                  custom: i,
              };

    const expected = farmData.expectedYield; // 16.1T
    const potential = farmData.potentialYield; // 18.4T
    const yieldGap = +(potential - expected).toFixed(1);
    const pct = Math.round((expected / potential) * 100);
    const potentialProfitGain = Math.round(yieldGap * 38000); // avg ~₹3,800/Q
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
            value: `${formatNumber(expected, { minimumFractionDigits: 1 })}T`,
        },
        {
            id: "profit",
            label: t("improve.goalProfit"),
            icon: IndianRupee,
            value: `₹${formatNumber(+(farmData.expectedProfit / 100000).toFixed(1), { minimumFractionDigits: 1 })}L`,
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
        { id: "yield", label: t("improve.goalYield"), icon: TrendingUp, value: `${formatNumber(pct)}%` },
    ];

    const visibleRecs =
        goal === "all"
            ? recommendations
            : recommendations.filter((rec) =>
                  (ACTION_META[rec.id]?.tags || []).includes(goal),
              );

    return (
        <div className="page-container improve-page">
            {/* Header */}
            <section className="improve-page__header section" {...reveal(0)}>
                <h1 className="improve-page__title">{t("nav.improve")}</h1>
                <p className="improve-page__subtitle">
                    {t("improve.aiFinds", {
                        from: formatNumber(expected, { minimumFractionDigits: 1 }),
                        to: formatNumber(potential, { minimumFractionDigits: 1 }),
                    })}
                </p>
            </section>

            {/* 1. AI Yield Summary Hero */}
            <section className="improve-page__hero section" {...reveal(1)}>
                <div className="improve-page__hero-card">
                    <span className="improve-page__ai-pill">
                        <Sparkles size={13} />
                        {t("improve.aiInsight")}
                    </span>

                    <p className="improve-page__hero-line">
                        {t("improve.heroLine1")}{" "}
                        <strong>
                            <AnimatedNumber
                                value={expected}
                                decimals={1}
                            />
                            T
                        </strong>{" "}
                        {t("improve.heroLine2")}{" "}
                        <strong className="improve-page__hero-line--gold">
                            <AnimatedNumber value={potential} decimals={1} />T
                        </strong>
                    </p>

                    <div className="improve-page__track">
                        <span className="improve-page__track-end">
                            <span className="improve-page__track-num">
                                {expected}T
                            </span>
                            <span className="improve-page__track-cap">
                                {t("improve.trackCurrent")}
                            </span>
                        </span>

                        <div
                            className="improve-page__track-bar"
                            role="img"
                            aria-label={t("improve.ariaTrack", { cur: formatNumber(expected, { minimumFractionDigits: 1 }), pot: formatNumber(potential, { minimumFractionDigits: 1 }) })}
                        >
                            <div
                                className="improve-page__track-fill"
                                style={{ "--fill": `${pct}%` }}
                            />
                            <div
                                className="improve-page__track-knob"
                                style={{ left: `${pct}%` }}
                            />
                        </div>

                        <span className="improve-page__track-end improve-page__track-end--potential">
                            <span className="improve-page__track-num">
                                {potential}T
                            </span>
                            <span className="improve-page__track-cap">
                                {t("improve.trackPotential")}
                            </span>
                        </span>
                    </div>

                    <div className="improve-page__gains">
                        <span className="improve-page__gain improve-page__gain--leaf">
                            +{formatNumber(yieldGap, { minimumFractionDigits: 1 })}T {t("improve.possible")}
                        </span>
                        <span className="improve-page__gain improve-page__gain--gold">
                            +₹{formatNumber(potentialProfitGain)}{" "}
                            {t("improve.possible")}
                        </span>
                    </div>
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
                                        {meta.value}
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
