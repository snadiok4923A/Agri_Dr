import { useLanguage } from "../hooks/useLanguage";
import { diseaseData } from "../data/mockData";
import {
    Bug,
    Shield,
    Search,
    AlertTriangle,
    Pill,
    DollarSign,
    TrendingDown,
} from "lucide-react";
import StatusBadge from "../components/common/StatusBadge";
import "./Disease.css";

export default function Disease() {
    const { t } = useLanguage();

    return (
        <div className="page-container disease-page">
            <section className="disease-page__header section">
                <div>
                    <h1 className="disease-page__title">{t("nav.disease")}</h1>
                    <p className="dashboard__section-subtitle">
                        Disease detection, curative medicine recommendations,
                        dosage, input costs, and yield safeguard impact
                    </p>
                </div>
            </section>

            <div className="disease-page__grid">
                {diseaseData.map((disease) => (
                    <div
                        key={disease.id}
                        className={`disease-page__card disease-page__card--${disease.severity}`}
                    >
                        <div className="disease-page__card-header">
                            <div className="disease-page__card-title">
                                <Bug size={18} />
                                <span>{disease.name}</span>
                            </div>
                            <StatusBadge
                                status={
                                    disease.severity === "critical"
                                        ? "critical"
                                        : "needs-attention"
                                }
                            />
                        </div>

                        <div className="disease-page__card-meta">
                            <span>
                                {disease.field} · Rice Variety:{" "}
                                <strong>{disease.variety}</strong>
                            </span>
                            <span>Identified: {disease.detected}</span>
                        </div>

                        {/* Medicine Prescription & Production Impact Card */}
                        <div className="disease-page__rx-box">
                            <div className="disease-page__rx-header">
                                <span className="disease-page__rx-title">
                                    Recommended Medicine Prescription
                                </span>
                                <span className="disease-page__rx-cost">
                                    Spend: {disease.treatmentCost}
                                </span>
                            </div>
                            <div className="disease-page__rx-grid">
                                <div>
                                    <span className="disease-page__rx-label">
                                        Active Medicine
                                    </span>
                                    <span className="disease-page__rx-value">
                                        {disease.medicine}
                                    </span>
                                </div>
                                <div>
                                    <span className="disease-page__rx-label">
                                        Exact Dosage
                                    </span>
                                    <span className="disease-page__rx-value">
                                        {disease.dosage}
                                    </span>
                                </div>
                            </div>
                            <div className="disease-page__impact-row">
                                <TrendingDown size={14} color="var(--danger)" />
                                <span className="disease-page__impact-text">
                                    <strong>
                                        Production Impact if Untreated:
                                    </strong>{" "}
                                    {disease.productionImpact}
                                </span>
                            </div>
                        </div>

                        <div className="disease-page__card-section">
                            <h4>{t("disease.symptoms")}</h4>
                            <p>{disease.symptoms}</p>
                        </div>

                        <div className="disease-page__card-section disease-page__card-section--action">
                            <h4>
                                <Shield size={14} />{" "}
                                {t("disease.recommendedAction")}
                            </h4>
                            <p>{disease.recommendedAction}</p>
                        </div>

                        <div className="disease-page__card-section">
                            <h4>
                                <Search size={14} /> {t("disease.prevention")}
                            </h4>
                            <p>{disease.prevention}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
