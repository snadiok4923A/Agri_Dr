import { useLanguage } from "../hooks/useLanguage";
import { farmData, fields } from "../data/mockData";
import { useNavigate } from "react-router-dom";
import {
    MapPin,
    Wheat,
    TrendingUp,
    Coins,
    DollarSign,
    ChevronRight,
    Sprout,
} from "lucide-react";
import StatusBadge from "../components/common/StatusBadge";
import "./MyFarm.css";

export default function MyFarm() {
    const { t } = useLanguage();
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
                            {farmData.totalLand} {t("dashboard.acres")}
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
                            {farmData.expectedYield} {t("common.ton")}
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
                            ₹{(farmData.estimatedRevenue / 1000).toFixed(1)}k
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
                            ₹{(farmData.expectedProfit / 1000).toFixed(1)}k
                        </span>
                        <span className="myfarm__stat-label">
                            {t("farm.expectedProfit")} ({farmData.profitMargin}
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
                            marginBottom: 14,
                        }}
                    >
                        <div>
                            <h2
                                className="myfarm__section-title"
                                style={{ margin: 0 }}
                            >
                                Farm Layout & Variety Production Map
                            </h2>
                            <span
                                style={{
                                    fontSize: 12,
                                    color: "var(--text-muted)",
                                }}
                            >
                                Click any field parcel to view detailed variety
                                production & profit
                            </span>
                        </div>
                        <div className="myfarm__map-legend">
                            <div className="myfarm__legend-item">
                                <div className="myfarm__legend-dot myfarm__legend-dot--healthy" />
                                <span>On Track</span>
                            </div>
                            <div className="myfarm__legend-item">
                                <div className="myfarm__legend-dot myfarm__legend-dot--attention" />
                                <span>Action Required</span>
                            </div>
                        </div>
                    </div>

                    <div className="myfarm__map-grid">
                        {fields.map((field) => (
                            <div
                                key={field.id}
                                className={`myfarm__map-field myfarm__map-field--${field.status === "needs-attention" ? "needs-attention" : "healthy"}`}
                                style={{
                                    gridColumn:
                                        field.coordinates.x > 40 ? "2" : "1",
                                    gridRow:
                                        field.coordinates.y > 40 ? "2" : "1",
                                }}
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
                                            {field.area} Acres
                                        </span>
                                    </div>
                                    <span className="myfarm__map-field-crop">
                                        Variety:{" "}
                                        <strong>{field.variety}</strong>
                                    </span>
                                    <div className="myfarm__map-field-yield-box">
                                        <span className="myfarm__map-field-yield-val">
                                            {field.expectedYield} Ton
                                        </span>
                                        <span className="myfarm__map-field-profit-val">
                                            Profit: ₹
                                            {(
                                                field.expectedProfit / 1000
                                            ).toFixed(1)}
                                            k
                                        </span>
                                    </div>
                                </div>
                                <div className="myfarm__map-field-bottom">
                                    <span>
                                        {field.growthStage} (Day {field.cropAge}
                                        )
                                    </span>
                                    <StatusBadge status={field.status} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Field List: Detailed Financial & Production Breakdown */}
            <section className="myfarm__fields section">
                <h2 className="myfarm__section-title">{t("farm.fieldList")}</h2>
                <div className="myfarm__field-list">
                    {fields.map((field) => (
                        <div
                            key={field.id}
                            className="myfarm__field-row"
                            onClick={() => navigate(`/crops/${field.cropId}`)}
                        >
                            <div className="myfarm__field-row-left">
                                <div
                                    className="myfarm__field-row-color"
                                    style={{
                                        background:
                                            field.status === "needs-attention"
                                                ? "var(--warning)"
                                                : "var(--accent)",
                                    }}
                                />
                                <div>
                                    <span className="myfarm__field-row-name">
                                        {field.name} — {field.variety}
                                    </span>
                                    <span className="myfarm__field-row-crop">
                                        {field.area} {t("dashboard.acres")} ·{" "}
                                        {field.growthStage} (Day {field.cropAge}
                                        )
                                    </span>
                                </div>
                            </div>

                            <div className="myfarm__field-row-center">
                                <StatusBadge status={field.status} />
                            </div>

                            <div className="myfarm__field-row-right">
                                <div className="myfarm__field-row-production">
                                    <div className="myfarm__field-row-stat">
                                        <span className="myfarm__field-row-stat-label">
                                            Expected Yield
                                        </span>
                                        <span className="myfarm__field-row-stat-value">
                                            {field.expectedYield} Ton
                                        </span>
                                    </div>
                                    <div className="myfarm__field-row-stat">
                                        <span className="myfarm__field-row-stat-label">
                                            Est. Cost
                                        </span>
                                        <span className="myfarm__field-row-stat-value">
                                            ₹
                                            {(
                                                field.estimatedCost / 1000
                                            ).toFixed(1)}
                                            k
                                        </span>
                                    </div>
                                    <div className="myfarm__field-row-stat">
                                        <span className="myfarm__field-row-stat-label">
                                            Exp. Revenue
                                        </span>
                                        <span className="myfarm__field-row-stat-value">
                                            ₹
                                            {(
                                                field.expectedRevenue / 1000
                                            ).toFixed(1)}
                                            k
                                        </span>
                                    </div>
                                    <div className="myfarm__field-row-stat">
                                        <span className="myfarm__field-row-stat-label">
                                            Exp. Profit
                                        </span>
                                        <span
                                            className="myfarm__field-row-stat-value"
                                            style={{ color: "var(--success)" }}
                                        >
                                            ₹
                                            {(
                                                field.expectedProfit / 1000
                                            ).toFixed(1)}
                                            k
                                        </span>
                                    </div>
                                </div>

                                <ChevronRight
                                    size={16}
                                    className="myfarm__field-row-arrow"
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
}
