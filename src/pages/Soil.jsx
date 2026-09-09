import { useLanguage } from "../hooks/useLanguage";
import { soilData } from "../data/mockData";
import {
    FlaskConical,
    CheckCircle2,
    AlertCircle,
    FileText,
    Sprout,
} from "lucide-react";
import ProgressBar from "../components/common/ProgressBar";
import "./Soil.css";

export default function Soil() {
    const { t } = useLanguage();
    const s = soilData.overall;

    return (
        <div className="page-container soil-page">
            <section className="soil-page__header section">
                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        flexWrap: "wrap",
                        gap: 12,
                    }}
                >
                    <div>
                        <h1 className="soil-page__title">{t("nav.soil")}</h1>
                        <p className="dashboard__section-subtitle">
                            Agronomic laboratory test profile, nutrient
                            availability, and fertilizer guidance for rice yield
                        </p>
                    </div>
                    <div className="soil-page__lab-tag">
                        <FileText size={14} />
                        <span>
                            Lab Test: {soilData.lastLabTestDate} ·{" "}
                            {soilData.testingAgency}
                        </span>
                    </div>
                </div>
            </section>

            {/* Overview */}
            <section className="soil-page__overview section">
                <div className="soil-page__ph">
                    <span className="soil-page__ph-label">{t("soil.ph")}</span>
                    <span className="soil-page__ph-value">{s.ph}</span>
                    <span className="soil-page__ph-status">{s.status}</span>
                </div>
                <div className="soil-page__issue">
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                        }}
                    >
                        <Sprout size={18} color="var(--accent)" />
                        <span className="soil-page__issue-label">
                            Yield & Fertility Impact
                        </span>
                    </div>
                    <span className="soil-page__impact-text">
                        {s.yieldImpact}
                    </span>
                    <div className="soil-page__issue-alert">
                        <AlertCircle
                            size={15}
                            color="var(--warning)"
                            style={{ flexShrink: 0 }}
                        />
                        <span>{s.issue}</span>
                    </div>
                </div>
            </section>

            {/* Available Nutrients with Fertilizer Recommendations */}
            <section className="soil-page__nutrients section">
                <h2 className="soil-page__section-title">
                    NPK Nutrients & Fertilizer Requirements
                </h2>
                <div className="soil-page__nutrient-grid">
                    {soilData.nutrients.map((item, idx) => (
                        <div key={idx} className="soil-page__nutrient-card">
                            <div className="soil-page__nutrient-header">
                                <span className="soil-page__nutrient-name">
                                    {item.name}
                                </span>
                                <span className="soil-page__nutrient-status">
                                    {item.status}
                                </span>
                            </div>
                            <span className="soil-page__nutrient-value">
                                {item.value}
                            </span>
                            <div style={{ margin: "8px 0" }}>
                                <ProgressBar
                                    value={item.rating}
                                    height={6}
                                    showValue={false}
                                />
                            </div>
                            <div className="soil-page__nutrient-rec">
                                <strong>Agronomic Guidance:</strong>{" "}
                                {item.recommendation}
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Field-by-Field Soil & Yield Profile */}
            <section className="soil-page__details section">
                <h2 className="soil-page__section-title">
                    Field-wise Agronomic Profile & Target Yield
                </h2>
                <div className="soil-page__field-grid">
                    {Object.entries(soilData.fields).map(([id, soil]) => (
                        <div key={id} className="soil-page__field-card">
                            <div
                                style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    marginBottom: 12,
                                }}
                            >
                                <h3 className="soil-page__field-name">
                                    {id
                                        .replace("field-", "Field ")
                                        .toUpperCase()}{" "}
                                    — {soil.variety}
                                </h3>
                                <span className="soil-page__field-target">
                                    Target: {soil.yieldPotential}
                                </span>
                            </div>
                            <div className="soil-page__field-data">
                                <div className="soil-page__data-pill">
                                    <span>pH</span>
                                    <strong>{soil.ph}</strong>
                                </div>
                                <div className="soil-page__data-pill">
                                    <span>Nitrogen</span>
                                    <strong>{soil.nitrogen}</strong>
                                </div>
                                <div className="soil-page__data-pill">
                                    <span>Phosphorus</span>
                                    <strong>{soil.phosphorus}</strong>
                                </div>
                                <div className="soil-page__data-pill">
                                    <span>Potassium</span>
                                    <strong>{soil.potassium}</strong>
                                </div>
                                <div className="soil-page__data-pill">
                                    <span>Organic C</span>
                                    <strong>{soil.organicMatter}</strong>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
}
