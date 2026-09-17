import { useLanguage } from "../hooks/useLanguage";
import { fertilizerData } from "../data/mockData";
import {
    FlaskConical,
    Clock,
    TrendingUp,
    DollarSign,
    CheckCircle2,
} from "lucide-react";
import StatusBadge from "../components/common/StatusBadge";
import "./Fertilizer.css";

export default function Fertilizer() {
    const { t } = useLanguage();

    return (
        <div className="page-container fertilizer-page">
            <section className="fertilizer-page__header section">
                <div>
                    <h1 className="fertilizer-page__title">
                        {t("nav.fertilizer")}
                    </h1>
                    <p className="dashboard__section-subtitle">
                        {t("fertilizer.subtitle")}
                    </p>
                </div>
            </section>

            {/* Upcoming Applications */}
            <section className="fertilizer-page__upcoming section">
                <h2 className="fertilizer-page__section-title">
                    {t("fertilizer.nextApplication")}
                </h2>
                <div className="fertilizer-page__upcoming-list">
                    {fertilizerData.nextApplications.map((app, i) => (
                        <div key={i} className="fertilizer-page__upcoming-card">
                            <div className="fertilizer-page__upcoming-top">
                                <div
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 12,
                                    }}
                                >
                                    <div className="fertilizer-page__upcoming-icon">
                                        <FlaskConical size={18} />
                                    </div>
                                    <div>
                                        <span className="fertilizer-page__upcoming-product">
                                            {app.product}
                                        </span>
                                        <span className="fertilizer-page__upcoming-detail">
                                            {app.field} · {t("fertilizer.stage")}:{" "}
                                            <strong>{app.variety}</strong> (
                                            {app.stage} {t("fertilizer.stageSuffix")})
                                        </span>
                                    </div>
                                </div>
                                <StatusBadge
                                    status={
                                        app.priority === "high"
                                            ? "critical"
                                            : "needs-attention"
                                    }
                                />
                            </div>

                            <div className="fertilizer-page__upcoming-grid">
                                <div>
                                    <span className="fertilizer-page__col-lbl">
                                        {t("fertilizer.quantity")}
                                    </span>
                                    <span className="fertilizer-page__col-val">
                                        {app.amount}
                                    </span>
                                </div>
                                <div>
                                    <span className="fertilizer-page__col-lbl">
                                        {t("fertilizer.inputCost")}
                                    </span>
                                    <span
                                        className="fertilizer-page__col-val"
                                        style={{ color: "var(--accent)" }}
                                    >
                                        {app.cost}
                                    </span>
                                </div>
                                <div>
                                    <span className="fertilizer-page__col-lbl">
                                        {t("fertilizer.dueDate")}
                                    </span>
                                    <span className="fertilizer-page__col-val">
                                        <Clock size={12} /> {app.due}
                                    </span>
                                </div>
                            </div>

                            <div className="fertilizer-page__benefit-banner">
                                <TrendingUp size={14} color="var(--success)" />
                                <span className="fertilizer-page__benefit-text">
                                    <strong>{t("fertilizer.yieldGain")}</strong>{" "}
                                    {app.expectedYieldBenefit}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Application History */}
            <section className="fertilizer-page__history section">
                <h2 className="fertilizer-page__section-title">
                    {t("fertilizer.history")}
                </h2>
                <div className="fertilizer-page__history-list">
                    {fertilizerData.history.map((item, i) => (
                        <div key={i} className="fertilizer-page__history-row">
                            <div className="fertilizer-page__history-date">
                                {item.date}
                            </div>
                            <div className="fertilizer-page__history-info">
                                <span className="fertilizer-page__history-product">
                                    {item.product}
                                </span>
                                <span className="fertilizer-page__history-detail">
                                    {item.field} · {item.variety} ·{" "}
                                    {item.amount} ({t("fertilizer.costOf")}: {item.cost})
                                </span>
                            </div>
                            <div className="fertilizer-page__history-benefit">
                                <CheckCircle2
                                    size={13}
                                    color="var(--success)"
                                />
                                <span>{item.benefit}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
}
