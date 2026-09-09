import { useLanguage } from "../hooks/useLanguage";
import { farmData, recommendations } from "../data/mockData";
import {
    Droplets,
    FlaskConical,
    Bug,
    Sprout,
    ArrowRight,
    TrendingUp,
    Coins,
    DollarSign,
} from "lucide-react";
import StatusBadge from "../components/common/StatusBadge";
import "./Improve.css";

const improvements = [
    {
        id: 1,
        title: "Targeted Fungicide Treatment",
        field: "Field B · Swarna",
        impact: "critical",
        icon: Bug,
        benefit: "+0.50 Ton yield saved (₹16,700 value)",
        color: "var(--danger)",
    },
    {
        id: 2,
        title: "Split-Dose Urea Top Dressing",
        field: "Field A · IR-64",
        impact: "high",
        icon: FlaskConical,
        benefit: "+0.25 Ton yield boost (₹8,550 profit)",
        color: "var(--accent)",
    },
    {
        id: 3,
        title: "Panicle Potash Nutrition",
        field: "Field C · Basmati",
        impact: "high",
        icon: Sprout,
        benefit: "+0.20 Ton grain filling (₹10,400 profit)",
        color: "var(--success)",
    },
    {
        id: 4,
        title: "Stage-Based Water Depth Regimen",
        field: "Field A & D",
        impact: "medium",
        icon: Droplets,
        benefit: "+0.30 Ton root aeration (₹10,260 profit)",
        color: "var(--info)",
    },
];

export default function Improve() {
    const { t } = useLanguage();
    const yieldGap = (farmData.potentialYield - farmData.expectedYield).toFixed(
        1,
    );
    const potentialProfitGain = Math.round(yieldGap * 38000); // avg price ~₹3,800/Q

    return (
        <div className="page-container improve-page">
            <section className="improve-page__header section">
                <div>
                    <h1 className="improve-page__title">{t("nav.improve")}</h1>
                    <p className="dashboard__section-subtitle">
                        Bridge the yield gap across 8.6 acres to capture up to ₹
                        {potentialProfitGain.toLocaleString("en-IN")} in
                        additional rice profit
                    </p>
                </div>
            </section>

            {/* Yield Gap Hero Card */}
            <section className="improve-page__yield section">
                <div className="improve-page__yield-card">
                    <div className="improve-page__yield-item">
                        <span className="improve-page__yield-label">
                            Current Expected Production
                        </span>
                        <span className="improve-page__yield-value">
                            {farmData.expectedYield} {t("common.ton")}
                        </span>
                        <span
                            style={{ fontSize: 11, color: "var(--text-muted)" }}
                        >
                            ₹{farmData.expectedProfit.toLocaleString("en-IN")}{" "}
                            Profit
                        </span>
                    </div>

                    <div className="improve-page__yield-gap">
                        <div className="improve-page__yield-gap-bar">
                            <div
                                className="improve-page__yield-gap-fill"
                                style={{
                                    width: `${(farmData.expectedYield / farmData.potentialYield) * 100}%`,
                                }}
                            />
                        </div>
                        <span className="improve-page__yield-gap-text">
                            Yield Gap: <strong>{yieldGap} Ton</strong> ·
                            Potential Profit Gain:{" "}
                            <strong>
                                +₹{potentialProfitGain.toLocaleString("en-IN")}
                            </strong>
                        </span>
                    </div>

                    <div className="improve-page__yield-item improve-page__yield-item--potential">
                        <span className="improve-page__yield-label">
                            Maximum Potential Production
                        </span>
                        <span className="improve-page__yield-value">
                            {farmData.potentialYield} {t("common.ton")}
                        </span>
                        <span style={{ fontSize: 11, color: "var(--accent)" }}>
                            Full Agronomic Optimization
                        </span>
                    </div>
                </div>
            </section>

            {/* High-Impact Actions to Close Yield Gap */}
            <section className="improve-page__list section">
                <h2 className="improve-page__section-title">
                    Agronomic Actions to Close the Yield Gap
                </h2>
                <div className="improve-page__improvement-grid">
                    {improvements.map((imp) => (
                        <div
                            key={imp.id}
                            className="improve-page__improvement-card"
                        >
                            <div
                                className="improve-page__improvement-icon"
                                style={{
                                    background: `${imp.color}15`,
                                    color: imp.color,
                                }}
                            >
                                <imp.icon size={20} />
                            </div>
                            <div className="improve-page__improvement-content">
                                <div
                                    style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                    }}
                                >
                                    <h3 className="improve-page__improvement-title">
                                        {imp.title}
                                    </h3>
                                    <StatusBadge status={imp.impact} />
                                </div>
                                <span
                                    style={{
                                        fontSize: 12,
                                        color: "var(--text-muted)",
                                        display: "block",
                                        margin: "2px 0 6px",
                                    }}
                                >
                                    {imp.field}
                                </span>
                                <span className="improve-page__improvement-benefit">
                                    {imp.benefit}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Active System Recommendations */}
            <section className="improve-page__recommendations section">
                <h2 className="improve-page__section-title">
                    Active Field Recommendations
                </h2>
                <div className="improve-page__rec-list">
                    {recommendations.map((rec) => (
                        <div key={rec.id} className="improve-page__rec-card">
                            <div className="improve-page__rec-header">
                                <StatusBadge
                                    status={
                                        rec.category === "critical"
                                            ? "critical"
                                            : rec.category === "important"
                                              ? "needs-attention"
                                              : "optimal"
                                    }
                                />
                                <span className="improve-page__rec-field">
                                    {rec.field}
                                </span>
                            </div>
                            <h3 className="improve-page__rec-title">
                                {rec.title}
                            </h3>
                            <p className="improve-page__rec-desc">
                                {rec.description}
                            </p>
                            <div className="improve-page__rec-footer">
                                <span className="improve-page__rec-benefit">
                                    Benefit: {rec.benefit}
                                </span>
                                <span
                                    style={{
                                        fontSize: 11,
                                        fontWeight: 600,
                                        color: "var(--text-primary)",
                                    }}
                                >
                                    Cost: {rec.estimatedCost}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
}
