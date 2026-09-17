import { useLanguage } from "../hooks/useLanguage";
import { farmData, fields } from "../data/mockData";
import { useNavigate } from "react-router-dom";
import { MapPin, Wheat, TrendingUp, Coins } from "lucide-react";
import StatusBadge from "../components/common/StatusBadge";
import "./MyFarm.css";

export default function MyFarm() {
    const { t, formatNumber } = useLanguage();
    const navigate = useNavigate();

    return (
        <div className="page-container myfarm">
            <section className="myfarm__header section">
                <h1 className="myfarm__title">{t("nav.myFarm")}</h1>
                <p className="myfarm__subtitle">{t("farm.selectField")}</p>
            </section>

            {/* Stats: Farm Overview */}
            <section className="myfarm__stats section">
                <div className="myfarm__stat">
                    <div
                        className="myfarm__stat-icon"
                        style={{
                            background: "var(--accent-soft)",
                            color: "var(--accent)",
                        }}
                    >
                        <MapPin size={20} />
                    </div>
                    <div className="myfarm__stat-content">
                        <span className="myfarm__stat-value">
                            {formatNumber(farmData.totalLand)} {t("dashboard.acres")}
                        </span>
                        <span className="myfarm__stat-label">
                            {t("farm.totalLand")}
                        </span>
                    </div>
                </div>

                <div className="myfarm__stat">
                    <div
                        className="myfarm__stat-icon"
                        style={{
                            background: "var(--success-soft)",
                            color: "var(--success)",
                        }}
                    >
                        <Wheat size={20} />
                    </div>
                    <div className="myfarm__stat-content">
                        <span className="myfarm__stat-value">
                            {formatNumber(farmData.expectedYield, { minimumFractionDigits: 1 })} {t("common.ton")}
                        </span>
                        <span className="myfarm__stat-label">
                            {t("farm.expectedProduction")}
                        </span>
                    </div>
                </div>

                <div className="myfarm__stat">
                    <div
                        className="myfarm__stat-icon"
                        style={{
                            background: "var(--info-soft)",
                            color: "var(--info)",
                        }}
                    >
                        <Coins size={20} />
                    </div>
                    <div className="myfarm__stat-content">
                        <span className="myfarm__stat-value">
                            ₹{formatNumber(+(farmData.estimatedRevenue / 1000).toFixed(1), { minimumFractionDigits: 1 })}k
                        </span>
                        <span className="myfarm__stat-label">
                            {t("farm.estimatedRevenue")}
                        </span>
                    </div>
                </div>

                <div className="myfarm__stat">
                    <div
                        className="myfarm__stat-icon"
                        style={{
                            background: "var(--warning-soft)",
                            color: "var(--warning)",
                        }}
                    >
                        <TrendingUp size={20} />
                    </div>
                    <div className="myfarm__stat-content">
                        <span
                            className="myfarm__stat-value"
                            style={{ color: "var(--success)" }}
                        >
                            ₹{formatNumber(+(farmData.expectedProfit / 1000).toFixed(1), { minimumFractionDigits: 1 })}k
                        </span>
                        <span className="myfarm__stat-label">
                            {t("farm.expectedProfit")} ({formatNumber(farmData.profitMargin)}
                            %)
                        </span>
                    </div>
                </div>
            </section>

            {/* Farm Map with Variety Production & Revenue */}
            <section className="myfarm__map section">
                <div className="myfarm__map-container">
                    <div
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            flexWrap: "wrap",
                            gap: 8,
                            marginBottom: 14,
                        }}
                    >
                        <div>
                            <h2
                                className="myfarm__section-title"
                                style={{ margin: 0 }}
                            >
                                {t("farm.farmLayout")}
                            </h2>
                            <span
                                style={{
                                    fontSize: 12,
                                    color: "var(--text-muted)",
                                }}
                            >
                                {t("farm.mapHint")}
                            </span>
                        </div>
                        <div className="myfarm__map-legend">
                            <div className="myfarm__legend-item">
                                <div className="myfarm__legend-dot myfarm__legend-dot--healthy" />
                                <span>{t("farm.onTrack")}</span>
                            </div>
                            <div className="myfarm__legend-item">
                                <div className="myfarm__legend-dot myfarm__legend-dot--attention" />
                                <span>{t("farm.actionRequired")}</span>
                            </div>
                        </div>
                    </div>

                    <div className="myfarm__map-grid">
                        {fields.map((field) => (
                            <div
                                key={field.id}
                                className={`myfarm__map-field myfarm__map-field--${field.status === "needs-attention" ? "needs-attention" : "healthy"}`}
                                onClick={() =>
                                    navigate(`/crops/${field.cropId}`)
                                }
                            >
                                <div className="myfarm__map-field-inner">
                                    <div
                                        style={{
                                            display: "flex",
                                            justifyContent: "space-between",
                                            alignItems: "center",
                                        }}
                                    >
                                        <span className="myfarm__map-field-name">
                                            {field.name}
                                        </span>
                                        <span className="myfarm__map-field-area">
                                            {formatNumber(field.area)} {t("dashboard.acres")}
                                        </span>
                                    </div>
                                    <span className="myfarm__map-field-crop">
                                        {t("farm.variety")}{" "}
                                        <strong>{field.variety}</strong>
                                    </span>
                                    <div className="myfarm__map-field-yield-box">
                                        <span className="myfarm__map-field-yield-val">
                                            {formatNumber(field.expectedYield, { minimumFractionDigits: 1 })} {t("common.ton")}
                                        </span>
                                        <span className="myfarm__map-field-profit-val">
                                            {t("farm.profit")} ₹
                                            {formatNumber(+(field.expectedProfit / 1000).toFixed(1), { minimumFractionDigits: 1 })}
                                            k
                                        </span>
                                    </div>
                                </div>
                                <div className="myfarm__map-field-bottom">
                                    <span>
                                        {field.growthStage} ({t("crops.dayOf")} {formatNumber(field.cropAge)})
                                    </span>
                                    <StatusBadge status={field.status} t={t} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>
        </div>
    );
}
