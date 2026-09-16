import { useLanguage } from "../hooks/useLanguage";
import { diseaseData } from "../data/mockData";
import { Leaf, Bug, ShieldCheck } from "lucide-react";
import StatusBadge from "../components/common/StatusBadge";
import "./Disease.css";

/**
 * Disease & Medicine — minimal farmer-first cards.
 *
 * Each card answers exactly seven questions: what disease, how serious,
 * which medicine, how much dose, how much land, how much cost, what symptoms.
 * Everything else (production impact, prevention plans, detection metadata)
 * is intentionally omitted to keep the page readable at a glance.
 */

/** Per-disease icon, matched to the disease type. */
const DISEASE_ICONS = {
    1: Leaf, // Leaf Blast — fungal leaf disease
    2: Bug, // Brown Plant Hopper — insect pest
    3: ShieldCheck, // Sheath Blight Preventive — protective spray
};

/**
 * Split the app's dosage string into its two farmer-facing parts WITHOUT
 * inventing values:
 *   "0.6 g / L (approx. 250 g for 1.8 ac)" →
 *   dose: "0.6 g / L"  ·  coverage: "250 g for 1.8 acres"
 * If the string has no parenthetical total, coverage stays null (rendered
 * as "—") rather than being fabricated.
 */
function parseDosage(dosage = "") {
    const dose = dosage.split("(")[0].trim();
    const paren = dosage.match(/\(([^)]+)\)/)?.[1] || "";
    const m = paren.match(/([\d.]+)\s*(kg|g|ml|l)\b\s*for\s*([\d.]+)\s*(ac|acre)/i);
    if (!m) return { dose, coverage: null };
    const qty = `${m[1]} ${m[2]}`;
    const areaNum = parseFloat(m[3]);
    const area = `${m[3]} ${areaNum === 1 ? "acre" : "acres"}`;
    return { dose, coverage: `${qty} for ${area}` };
}

/** severity → StatusBadge status (existing badge styles only). */
function badgeFor(severity) {
    if (severity === "critical") return "critical";
    if (severity === "moderate") return "needs-attention";
    return "monitor";
}

export default function Disease() {
    const { t } = useLanguage();

    return (
        <div className="page-container disease-page">
            <section className="disease-page__header section">
                <div>
                    <h1 className="disease-page__title">{t("nav.disease")}</h1>
                    <p className="dashboard__section-subtitle">
                        What is affecting your crop — and the right medicine,
                        dose and cost to treat it
                    </p>
                </div>
            </section>

            <div className="disease-page__grid">
                {diseaseData.map((disease) => {
                    const Icon = DISEASE_ICONS[disease.id] || Leaf;
                    const { dose, coverage } = parseDosage(disease.dosage);
                    return (
                        <div
                            key={disease.id}
                            className={`disease-page__card disease-page__card--${disease.severity}`}
                        >
                            {/* ---- Header: icon + name · status badge ---- */}
                            <div className="disease-page__card-header">
                                <div className="disease-page__card-title">
                                    <span
                                        className={`disease-page__icon disease-page__icon--${disease.severity}`}
                                    >
                                        <Icon size={16} />
                                    </span>
                                    <span>{disease.name}</span>
                                </div>
                                <StatusBadge status={badgeFor(disease.severity)} />
                            </div>

                            <p className="disease-page__meta">
                                Rice Variety: <strong>{disease.variety}</strong>
                                <span className="disease-page__meta-dot">·</span>
                                {disease.field}
                            </p>

                            {/* ---- Recommended medicine ---- */}
                            <div className="disease-page__medicine">
                                <span className="disease-page__label">
                                    Recommended Medicine
                                </span>
                                <span className="disease-page__medicine-name">
                                    {disease.medicine}
                                </span>
                            </div>

                            {/* ---- Dose · Coverage · Cost row ---- */}
                            <div className="disease-page__stats">
                                <div className="disease-page__stat">
                                    <span className="disease-page__label">
                                        Dose
                                    </span>
                                    <span className="disease-page__stat-value">
                                        {dose || "—"}
                                    </span>
                                </div>
                                <div className="disease-page__stat">
                                    <span className="disease-page__label">
                                        Coverage
                                    </span>
                                    <span className="disease-page__stat-value">
                                        {coverage || "—"}
                                    </span>
                                </div>
                                <div className="disease-page__stat">
                                    <span className="disease-page__label">
                                        Cost
                                    </span>
                                    <span className="disease-page__stat-value disease-page__stat-value--cost">
                                        {disease.treatmentCost}
                                    </span>
                                </div>
                            </div>

                            {/* ---- Symptoms ---- */}
                            <div className="disease-page__symptoms">
                                <span className="disease-page__label">
                                    {t("disease.symptoms")}
                                </span>
                                <p>{disease.symptoms}</p>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
