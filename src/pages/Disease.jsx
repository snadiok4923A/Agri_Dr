import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "../hooks/useLanguage";
import {
    diseaseLibrary,
    diseaseFilters,
    matchesDiseaseFilter,
} from "../data/diseaseLibrary";
import DiseaseIllustration from "../components/common/DiseaseIllustration";
import { X, Sparkles, ArrowRight } from "lucide-react";
import "./Disease.css";

/**
 * Disease & Medicine — "Rice Disease Library".
 *
 * Krisiveda has NO sensor/monitoring system, so nothing here claims a
 * disease was detected in the user's field. The farmer browses common rice
 * diseases (same interaction as the Rice Varieties page), opens a floating
 * glass detail window, and reads treatment info derived from the app's
 * existing data.
 */
export default function Disease() {
    const { t, formatLabel } = useLanguage();
    const navigate = useNavigate();
    const [filter, setFilter] = useState("all");
    const [selected, setSelected] = useState(null);

    // Lock body scroll while the modal is open
    useEffect(() => {
        document.body.style.overflow = selected ? "hidden" : "";
        return () => {
            document.body.style.overflow = "";
        };
    }, [selected]);

    // Esc closes the modal
    useEffect(() => {
        if (!selected) return undefined;
        const onKey = (e) => e.key === "Escape" && setSelected(null);
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [selected]);

    const visible = diseaseLibrary.filter((d) => matchesDiseaseFilter(d, filter));

    return (
        <div className="page-container disease-page">
            {/* Header */}
            <section className="disease-page__header section">
                <h1 className="disease-page__title">{t("nav.disease")}</h1>
                <p className="disease-page__subtitle">
                    {t("disease.subtitle")}
                </p>
            </section>

            {/* Filters */}
            <div className="disease-page__filters" role="tablist" aria-label={t("common.filterDiseases")}>
                {diseaseFilters.map((f) => (
                    <button
                        key={f.id}
                        type="button"
                        role="tab"
                        aria-selected={filter === f.id}
                        className={`disease-page__filter${
                            filter === f.id ? " disease-page__filter--active" : ""
                        }`}
                        onClick={() => setFilter(f.id)}
                    >
                        {t(`filters.disease.${f.id}`)}
                    </button>
                ))}
            </div>

            {/* Cards grid */}
            <div className="disease-page__grid">
                {visible.map((d) => (
                    <button
                        key={d.id}
                        type="button"
                        className="disease-page__card"
                        onClick={() => setSelected(d)}
                        aria-haspopup="dialog"
                    >
                        <div className="disease-page__card-top">
                            <span className={`disease-page__card-icon disease-page__icon--${d.tone}`}>
                                <DiseaseIllustration kind={d.art} />
                            </span>
                            <span className={`disease-page__status disease-page__status--${d.tone}`}>
                                {d.harmLevel}
                            </span>
                        </div>

                        <div className="disease-page__card-names">
                            <h3 className="disease-page__card-name">{d.name}</h3>
                            <span className="disease-page__card-sci">{d.scientificName}</span>
                        </div>

                        {/* TREATMENT row — medicine name, or the agronomist fallback */}
                        <div className="disease-page__card-treat">
                            <span className="disease-page__label">{t("disease.treatment")}</span>
                            <span className="disease-page__treat-val">
                                {d.medicine || t("disease.askAgronomist")}
                            </span>
                        </div>

                        {/* TREATMENT COST row — approximate estimates marked with ≈;
                            the "/ acre" unit is localized, the number stays data-true */}
                        <div className="disease-page__card-cost">
                            <span className="disease-page__label">{t("disease.treatmentCost")}</span>
                            <span className="disease-page__cost-val">
                                {formatLabel(String(d.cost).replace(/\/\s*acre$/, "")).trim()}{" "}
                                / {t("units.acre")}
                            </span>
                        </div>

                        <p className="disease-page__card-symptoms">{d.symptoms[0]}…</p>

                        <span className="disease-page__card-cta">
                            {t("disease.viewDetails")} <ArrowRight size={13} />
                        </span>
                    </button>
                ))}
            </div>

            {visible.length === 0 && (
                <p className="disease-page__empty">{t("disease.empty")}</p>
            )}

            {/* ==================== Floating detail window ==================== */}
            {selected && (
                <div
                    className="disease-page__overlay"
                    onClick={() => setSelected(null)}
                    role="presentation"
                >
                    <div
                        className="disease-page__modal"
                        role="dialog"
                        aria-modal="true"
                        aria-label={selected.name}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            type="button"
                            className="disease-page__modal-close"
                            onClick={() => setSelected(null)}
                        aria-label={t("common.close")}
                    >
                        <X size={18} />
                        </button>

                        {/* Disease image */}
                        <div className="disease-page__modal-art">
                            <DiseaseIllustration kind={selected.art} />
                        </div>

                        {/* Name + scientific name + severity */}
                        <div className="disease-page__modal-head">
                            <div>
                                <h3 className="disease-page__modal-name">{selected.name}</h3>
                                <span className="disease-page__modal-sci">
                                    {selected.scientificName}
                                </span>
                            </div>
                            <span className={`disease-page__status disease-page__status--${selected.tone}`}>
                                {selected.harmLevel}
                            </span>
                        </div>

                        {/* Recommended treatment — identical structure for every
                            disease: Medicine + Dose · Coverage · Treatment Cost. */}
                        <div className="disease-page__msection">
                            <h4 className="disease-page__msection-title">{t("disease.recommendedTreatment")}</h4>
                            <div className="disease-page__fact">
                                <span className="disease-page__fact-label">{t("disease.medicine")}</span>
                                <span className="disease-page__fact-val">
                                    {selected.medicine || t("disease.askAgronomist")}
                                </span>
                            </div>
                            <div className="disease-page__modal-stats">
                                <div className="disease-page__mstat">
                                    <span className="disease-page__mstat-label">{t("disease.dose")}</span>
                                    <span className="disease-page__mstat-val">{formatLabel(selected.dose)}</span>
                                </div>
                                <div className="disease-page__mstat">
                                    <span className="disease-page__mstat-label">{t("disease.coverage")}</span>
                                    <span className="disease-page__mstat-val">
                                        {formatLabel(selected.coverage)}
                                        {selected.coverageNote ? ` (${selected.coverageNote})` : ""}
                                    </span>
                                </div>
                                <div className="disease-page__mstat">
                                    <span className="disease-page__mstat-label">{t("disease.treatmentCost")}</span>
                                    <span className="disease-page__mstat-val disease-page__mstat-val--cost">
                                        {formatLabel(String(selected.cost).replace(/\/\s*acre$/, "")).trim()}{" "}
                                        / {t("units.acre")}
                                    </span>
                                </div>
                            </div>
                            {selected.note && (
                                <p className="disease-page__disease-note">{selected.note}</p>
                            )}
                        </div>

                        {/* Symptoms */}
                        <div className="disease-page__msection">
                            <h4 className="disease-page__msection-title">{t("disease.symptoms")}</h4>
                            <ul className="disease-page__symptom-list">
                                {selected.symptoms.map((s) => (
                                    <li key={s}>{s}</li>
                                ))}
                            </ul>
                        </div>

                        {/* Commonly seen in — relevant varieties for every disease */}
                        <div className="disease-page__msection">
                            <h4 className="disease-page__msection-title">{t("disease.commonIn")}</h4>
                            <p className="disease-page__common-in">
                                {(selected.commonIn || []).join(" · ")}
                            </p>
                        </div>

                        {/* Ask AI footer */}
                        <button
                            type="button"
                            className="disease-page__ask-ai"
                            onClick={() => navigate("/ai-doctor")}
                        >
                            <span>
                                <strong>{t("disease.askAIQuestion")}</strong> {t("disease.askAIFooter")}
                            </span>
                            <Sparkles size={16} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
