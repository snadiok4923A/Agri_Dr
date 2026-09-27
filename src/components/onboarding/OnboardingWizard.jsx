/*
 * OnboardingWizard.jsx — first-run farm setup (PRESENTATION ONLY).
 *
 * Visual language: the auth glass card (AuthLayout + Auth.css tokens).
 * Flow (skipping nothing breaks state — Back/Next preserve every field):
 *
 *   1. language  — pick from the SAME languages array the app uses
 *   2. auth      — guests only: Google / Email (or skip to the app)
 *   3. count     — how many land parcels?
 *   4. area      — one area + unit row per parcel (no conversion; the
 *                  unit is stored alongside the number, per spec)
 *   5. variety   — one rice variety per parcel (fuzzy autocomplete over
 *                  the single riceVarieties dataset — deterministic,
 *                  no AI, no network)
 *   6. stage     — current crop stage per parcel (real vocabulary from
 *                  cropStages.js, translated labels)
 *   7. review    — compact "All set!" summary → Done → dashboard
 *
 * "Skip for now" is offered on every step; skipping never deletes the
 * draft (it stays in localStorage and pre-fills a future visit).
 */

import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import AuthLayout from "../auth/AuthLayout";
import { useLanguage } from "../../hooks/useLanguage";
import { useOnboarding } from "../../hooks/useOnboarding";
import { riceVarieties } from "../../data/riceVarieties";
import { CROP_STAGES } from "../../data/cropStages";
import { AREA_UNITS } from "../../lib/onboardingService";
import { fuzzyRank, normalizeForSearch } from "../../lib/fuzzySearch";
import "./OnboardingWizard.css";

const MIN_PARCELS = 1;
const MAX_PARCELS = 20;

/** Autocomplete entries built ONCE (normalize per variety, not per keystroke). */
const VARIETY_ENTRIES = riceVarieties.map((v) => ({
    item: v.name,
    text: normalizeForSearch(v.name),
}));

const EXACT_NAMES = new Set(riceVarieties.map((v) => v.name.toLowerCase()));

/** Fresh parcel row (draft values prefill from the persisted farm). */
function parcelFromDraft(draft, unitFallback) {
    return {
        area: draft && draft.area != null ? String(draft.area) : "",
        unit: (draft && draft.unit) || unitFallback,
        variety: (draft && draft.riceVariety) || "",
        stage: (draft && draft.stage) || "",
    };
}

export default function OnboardingWizard() {
    const { t, formatNumber } = useLanguage();
    const { farm, completeOnboarding, skipOnboarding, saveDraft } = useOnboarding();
    const navigate = useNavigate();

    /* SURVEY-ONLY wizard (spec flow): language is chosen BEFORE auth
       (AuthLanguageGate) and this component only renders for SUCCESSFULLY
       AUTHENTICATED users (OnboardingGate) — so the flow here is exactly
       count → area → variety → stage → review (Done). */
    const steps = useMemo(
        () => ["count", "area", "variety", "stage", "review"],
        [],
    );
    const [stepIndex, setStepIndex] = useState(0);
    const step = steps[stepIndex];

    /* ---- form state (all steps live here so Back never loses data) ---- */
    const [count, setCount] = useState(() =>
        Math.min(MAX_PARCELS, Math.max(MIN_PARCELS, farm.parcels.length || 1)),
    );
    const [parcels, setParcels] = useState(() =>
        Array.from({ length: count }, (_, i) =>
            parcelFromDraft(farm.parcels[i], "acre"),
        ),
    );
    const [errors, setErrors] = useState({});
    const [saving, setSaving] = useState(false);

    /* Count change grows/shrinks the parcel rows, preserving entered data. */
    const applyCount = (next) => {
        const clamped = Math.min(MAX_PARCELS, Math.max(MIN_PARCELS, next));
        setCount(clamped);
        setParcels((prev) => {
            const merged = Array.from({ length: clamped }, (_, i) =>
                prev[i] ? { ...prev[i] } : parcelFromDraft(farm.parcels[i], "acre"),
            );
            return merged;
        });
        setErrors({});
    };

    const setParcel = (index, patch) => {
        setParcels((prev) =>
            prev.map((p, i) => (i === index ? { ...p, ...patch } : p)),
        );
        setErrors((prev) => ({ ...prev, [`p${index}`]: undefined }));
    };

    /* ---- navigation with per-step validation (inline, never alert()) ---- */
    const validateStep = () => {
        const next = {};
        if (step === "count" && !(count >= MIN_PARCELS && count <= MAX_PARCELS)) {
            next.count = true;
        }
        if (step === "area") {
            parcels.forEach((p, i) => {
                const area = parseFloat(p.area);
                if (!p.area || Number.isNaN(area) || area <= 0) {
                    next[`p${i}`] = t("onboarding.area.invalidArea");
                }
            });
        }
        if (step === "variety") {
            parcels.forEach((p, i) => {
                if (!EXACT_NAMES.has(p.variety.trim().toLowerCase())) {
                    next[`p${i}`] = t("onboarding.variety.invalid");
                }
            });
        }
        if (step === "stage") {
            parcels.forEach((p, i) => {
                if (!p.stage) next[`p${i}`] = t("onboarding.stage.invalid");
            });
        }
        return next;
    };

    const persistDraft = () =>
        saveDraft({
            farmName: "",
            parcels: parcels.map((p, i) => ({
                order: i,
                area: parseFloat(p.area) || null,
                unit: p.unit,
                riceVariety: p.variety.trim(),
                stage: p.stage,
            })),
        });

    const goNext = () => {
        const next = validateStep();
        setErrors(next);
        if (Object.keys(next).length) return;
        persistDraft();
        setStepIndex((i) => Math.min(steps.length - 1, i + 1));
    };

    const goBack = () => {
        persistDraft();
        setErrors({});
        setStepIndex((i) => Math.max(0, i - 1));
    };

    /* The user's language was chosen in the mandatory FIRST step (before
       auth) via the existing changeLanguage system — read it from its
       localStorage home so the profile write stays in sync. */
    const chosenLanguage = () => localStorage.getItem("krisiveda-lang") || undefined;

    const handleSkip = async () => {
        persistDraft();
        setSaving(true);
        await skipOnboarding({ selectedLanguage: chosenLanguage() });
        setSaving(false);
        navigate("/", { replace: true });
    };

    const handleDone = async () => {
        setSaving(true);
        await completeOnboarding({
            farmName: "",
            parcels: parcels.map((p, i) => ({
                order: i,
                area: parseFloat(p.area),
                unit: p.unit,
                riceVariety: p.variety.trim(),
                stage: p.stage,
            })),
            selectedLanguage: chosenLanguage(),
        });
        setSaving(false);
        navigate("/", { replace: true });
    };

    /* ---- per-step copy ---- */
    const copy = {
        count: {
            title: t("onboarding.count.title"),
            subtitle: t("onboarding.count.subtitle"),
        },
        area: {
            title: t("onboarding.area.title"),
            subtitle: t("onboarding.area.subtitle"),
        },
        variety: {
            title: t("onboarding.variety.title"),
            subtitle: t("onboarding.variety.subtitle"),
        },
        stage: {
            title: t("onboarding.stage.title"),
            subtitle: t("onboarding.stage.subtitle"),
        },
        review: {
            title: t("onboarding.review.title"),
            subtitle: t("onboarding.review.subtitle"),
        },
    }[step];

    /* Most advanced stage for the review summary. */
    const furthestStage = useMemo(() => {
        const keys = CROP_STAGES.map((s) => s.key);
        let best = -1;
        parcels.forEach((p) => {
            const idx = keys.indexOf(p.stage);
            if (idx > best) best = idx;
        });
        return best >= 0 ? CROP_STAGES[best] : null;
    }, [parcels]);

    const distinctVarieties = useMemo(
        () =>
            new Set(
                parcels.map((p) => p.variety.trim().toLowerCase()).filter(Boolean),
            ).size,
        [parcels],
    );

    return (
        <AuthLayout
            title={copy.title}
            subtitle={copy.subtitle}
            belowCard={
                /* "Skip for now" — OUTSIDE the survey card (belowCard slot
                   of AuthLayout): visually separate, never inside the form
                   or the Back/Next navigation. Draft values are preserved,
                   so a later visit resumes where the user left off. */
                <button
                    type="button"
                    className="auth-skip-external"
                    onClick={handleSkip}
                    disabled={saving}
                >
                    {t("onboarding.skip")}
                </button>
            }
        >
            {/* Progress: "Step X of N" + bar — first thing inside the card */}
            <div className="obw-progress" aria-live="polite">
                <span className="obw-progress__label">
                    {t("onboarding.progress", { x: stepIndex + 1, n: steps.length })}
                </span>
                <div className="obw-progress__bar">
                    <div
                        className="obw-progress__fill"
                        style={{ width: `${((stepIndex + 1) / steps.length) * 100}%` }}
                    />
                </div>
            </div>

            {/* ==================== STEP: PARCEL COUNT ==================== */}
            {step === "count" && (
                <div className="obw-count">
                    <div className="obw-stepper">
                        <button
                            type="button"
                            className="obw-stepper__btn"
                            onClick={() => applyCount(count - 1)}
                            disabled={count <= MIN_PARCELS}
                            aria-label="−"
                        >
                            <ChevronLeft size={18} />
                        </button>
                        <input
                            className={`obw-stepper__value ${errors.count ? "auth-field__input--error" : ""}`}
                            type="number"
                            min={MIN_PARCELS}
                            max={MAX_PARCELS}
                            value={count}
                            onChange={(e) => applyCount(parseInt(e.target.value, 10) || 0)}
                            aria-label={t("onboarding.count.label")}
                        />
                        <button
                            type="button"
                            className="obw-stepper__btn"
                            onClick={() => applyCount(count + 1)}
                            disabled={count >= MAX_PARCELS}
                            aria-label="+"
                        >
                            <ChevronRight size={18} />
                        </button>
                    </div>
                    <p className="obw-hint">{t("onboarding.count.hint")}</p>
                </div>
            )}

            {/* ==================== STEP: AREAS + UNITS ==================== */}
            {step === "area" && (
                <div className="obw-rows">
                    {parcels.map((p, i) => (
                        <div key={i} className="obw-row">
                            <span className="obw-row__label">
                                {t("onboarding.area.parcelLabel")}{" "}
                                {formatNumber(i + 1)}
                            </span>
                            <div className="obw-row__fields">
                                <input
                                    className={`obw-area-input ${errors[`p${i}`] ? "auth-field__input--error" : ""}`}
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    inputMode="decimal"
                                    placeholder="0.00"
                                    value={p.area}
                                    onChange={(e) =>
                                        setParcel(i, { area: e.target.value })
                                    }
                                    aria-label={`${t("onboarding.area.areaLabel")} ${formatNumber(i + 1)}`}
                                />
                                <select
                                    className="obw-unit-select"
                                    value={p.unit}
                                    onChange={(e) => setParcel(i, { unit: e.target.value })}
                                    aria-label={t("onboarding.area.unitLabel")}
                                >
                                    {AREA_UNITS.map((u) => (
                                        <option key={u.value} value={u.value}>
                                            {t(`onboarding.unitNames.${u.value}`)}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            {errors[`p${i}`] && (
                                <span className="obw-row__error">{errors[`p${i}`]}</span>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* ==================== STEP: RICE VARIETIES ==================== */}
            {step === "variety" && (
                <div className="obw-rows">
                    {parcels.map((p, i) => (
                        <div key={i} className="obw-row">
                            <span className="obw-row__label">
                                {t("onboarding.area.parcelLabel")}{" "}
                                {formatNumber(i + 1)}
                                {p.area && (
                                    <span className="obw-row__meta">
                                        {" "}
                                        · {formatNumber(parseFloat(p.area))}{" "}
                                        {t(`onboarding.unitNames.${p.unit}`)}
                                    </span>
                                )}
                            </span>
                            <VarietyInput
                                id={`obw-variety-${i}`}
                                value={p.variety}
                                error={errors[`p${i}`]}
                                onChange={(name) => setParcel(i, { variety: name })}
                                placeholder={t("onboarding.variety.searchPlaceholder")}
                                noMatchText={t("onboarding.variety.noMatch")}
                            />
                        </div>
                    ))}
                </div>
            )}

            {/* ==================== STEP: CROP STAGES ==================== */}
            {step === "stage" && (
                <div className="obw-rows">
                    {parcels.map((p, i) => (
                        <div key={i} className="obw-row">
                            <span className="obw-row__label">
                                {t("onboarding.area.parcelLabel")}{" "}
                                {formatNumber(i + 1)}
                                {p.variety && (
                                    <span className="obw-row__meta"> · {p.variety}</span>
                                )}
                            </span>
                            <div
                                className={`obw-stages ${errors[`p${i}`] ? "obw-stages--error" : ""}`}
                                role="radiogroup"
                                aria-label={`${t("onboarding.stage.title")} ${formatNumber(i + 1)}`}
                            >
                                {CROP_STAGES.map((s) => (
                                    <button
                                        key={s.key}
                                        type="button"
                                        role="radio"
                                        aria-checked={p.stage === s.key}
                                        className={`obw-stage-chip ${p.stage === s.key ? "obw-stage-chip--active" : ""}`}
                                        onClick={() => setParcel(i, { stage: s.key })}
                                    >
                                        {t(`onboarding.stages.${s.key}`)}
                                    </button>
                                ))}
                            </div>
                            {errors[`p${i}`] && (
                                <span className="obw-row__error">{errors[`p${i}`]}</span>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* ==================== STEP: REVIEW ==================== */}
            {step === "review" && (
                <div className="obw-review">
                    <div className="obw-review__stats">
                        <div className="obw-review__stat">
                            <span className="obw-review__num">
                                {formatNumber(count)}
                            </span>
                            <span className="obw-review__cap">
                                {t("onboarding.review.summaryParcels")}
                            </span>
                        </div>
                        <div className="obw-review__stat">
                            <span className="obw-review__num">
                                {formatNumber(distinctVarieties)}
                            </span>
                            <span className="obw-review__cap">
                                {t("onboarding.review.summaryVarieties")}
                            </span>
                        </div>
                        <div className="obw-review__stat">
                            <span className="obw-review__num obw-review__num--text">
                                {furthestStage
                                    ? t(`onboarding.stages.${furthestStage.key}`)
                                    : "—"}
                            </span>
                            <span className="obw-review__cap">
                                {t("onboarding.review.summaryStage")}
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* ==================== NAVIGATION ==================== */}
            <div className="obw-nav">
                {stepIndex > 0 ? (
                    <button type="button" className="obw-nav__ghost" onClick={goBack}>
                        <ChevronLeft size={15} />
                        {t("onboarding.back")}
                    </button>
                ) : (
                    <span />
                )}
                <div className="obw-nav__right">
                    {step === "review" ? (
                        <button
                            type="button"
                            className="auth-btn auth-btn--primary obw-nav__next"
                            onClick={handleDone}
                            disabled={saving}
                        >
                            {saving ? (
                                <Loader2 size={16} className="obw-spin" aria-hidden="true" />
                            ) : null}
                            {t("onboarding.done")}
                        </button>
                    ) : (
                        step !== "auth" && (
                            <button
                                type="button"
                                className="auth-btn auth-btn--primary obw-nav__next"
                                onClick={goNext}
                                disabled={saving}
                            >
                                {t("onboarding.next")}
                            </button>
                        )
                    )}
                </div>
            </div>
        </AuthLayout>
    );
}

/* ==================== variety autocomplete (per row) ==================== */

function VarietyInput({ id, value, error, onChange, placeholder, noMatchText }) {
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState(-1);

    const results = useMemo(
        () => (open ? fuzzyRank(VARIETY_ENTRIES, value, 8) : []),
        [open, value],
    );

    const select = (name) => {
        onChange(name);
        setOpen(false);
        setActive(-1);
    };

    return (
        <div className="obw-variety">
            <input
                id={id}
                className={`auth-field__input obw-variety__input ${error ? "auth-field__input--error" : ""}`}
                type="text"
                autoComplete="off"
                role="combobox"
                aria-expanded={open}
                aria-controls={`${id}-list`}
                aria-autocomplete="list"
                placeholder={placeholder}
                value={value}
                onChange={(e) => {
                    onChange(e.target.value);
                    setOpen(true);
                    setActive(-1);
                }}
                onFocus={() => setOpen(true)}
                onBlur={() => setOpen(false)}
                onKeyDown={(e) => {
                    if (e.key === "Escape") setOpen(false);
                    if (e.key === "ArrowDown") {
                        e.preventDefault();
                        setActive((a) => Math.min(results.length - 1, a + 1));
                    }
                    if (e.key === "ArrowUp") {
                        e.preventDefault();
                        setActive((a) => Math.max(-1, a - 1));
                    }
                    if (e.key === "Enter" && active >= 0 && results[active]) {
                        e.preventDefault();
                        select(results[active]);
                    }
                }}
            />
            {open && (
                <ul className="obw-variety__list" id={`${id}-list`} role="listbox">
                    {results.map((name, idx) => (
                        // onMouseDown beats the input's blur so the click lands
                        <li key={name}>
                            <button
                                type="button"
                                role="option"
                                aria-selected={active === idx}
                                className={`obw-variety__option ${idx === active ? "obw-variety__option--active" : ""}`}
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    select(name);
                                }}
                            >
                                {name}
                            </button>
                        </li>
                    ))}
                    {!results.length && (
                        <li className="obw-variety__empty">{noMatchText}</li>
                    )}
                </ul>
            )}
            {error && <span className="obw-row__error">{error}</span>}
        </div>
    );
}
