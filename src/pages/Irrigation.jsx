import { useLanguage } from "../hooks/useLanguage";
import { irrigationData } from "../data/mockData";
import {
    Droplets,
    CloudRain,
    Zap,
    TrendingDown,
    Clock,
    AlertCircle,
} from "lucide-react";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from "recharts";
import StatusBadge from "../components/common/StatusBadge";
import "./Irrigation.css";

export default function Irrigation() {
    const { t } = useLanguage();

    return (
        <div className="page-container irrigation-page">
            <section className="irrigation-page__header section">
                <div>
                    <h1 className="irrigation-page__title">
                        {t("nav.irrigation")}
                    </h1>
                    <p className="dashboard__section-subtitle">
                        Agronomic stage-based water schedule, weather
                        advisories, and pumping energy cost optimization
                    </p>
                </div>
            </section>

            {/* Weather Rain Advisory Banner */}
            <div className="irrigation-page__advisory section">
                <CloudRain
                    size={20}
                    className="irrigation-page__advisory-icon"
                />
                <div className="irrigation-page__advisory-text">
                    <strong>Weather Advisory:</strong>{" "}
                    {irrigationData.weatherAdvisory}
                </div>
            </div>

            {/* Summary Cards */}
            <section className="irrigation-page__summary section">
                <div className="irrigation-page__usage-card">
                    <div className="irrigation-page__usage-icon">
                        <Clock size={20} />
                    </div>
                    <div>
                        <span className="irrigation-page__usage-value">
                            {irrigationData.thisWeekHours} Hours
                        </span>
                        <span className="irrigation-page__usage-label">
                            Pumping Runtime This Week
                        </span>
                    </div>
                </div>

                <div className="irrigation-page__usage-card">
                    <div
                        className="irrigation-page__usage-icon"
                        style={{
                            background: "rgba(232, 169, 78, 0.15)",
                            color: "var(--warning)",
                        }}
                    >
                        <Zap size={20} />
                    </div>
                    <div>
                        <span className="irrigation-page__usage-value">
                            ₹
                            {irrigationData.pumpingCostThisWeek.toLocaleString(
                                "en-IN",
                            )}
                        </span>
                        <span className="irrigation-page__usage-label">
                            Pumping Electricity Cost
                        </span>
                    </div>
                </div>

                <div className="irrigation-page__change-card">
                    <TrendingDown size={18} />
                    <div>
                        <span className="irrigation-page__save-val">
                            ₹{irrigationData.costSavings} Saved
                        </span>
                        <span className="irrigation-page__save-label">
                            Saved via rain forecast
                        </span>
                    </div>
                </div>
            </section>

            {/* Field-wise Stage Requirements & Action */}
            <section className="irrigation-page__fields section">
                <h2 className="irrigation-page__section-title">
                    Field-wise Water Schedules
                </h2>
                <div className="irrigation-page__field-list">
                    {irrigationData.fields.map((field) => (
                        <div
                            key={field.fieldId}
                            className="irrigation-page__field-card"
                        >
                            <div className="irrigation-page__field-header">
                                <div>
                                    <h3 className="irrigation-page__field-name">
                                        {field.name} — {field.variety}
                                    </h3>
                                    <span className="irrigation-page__field-stage">
                                        Growth Stage:{" "}
                                        <strong>{field.stage}</strong>
                                    </span>
                                </div>
                                <StatusBadge status={field.status} />
                            </div>

                            <div className="irrigation-page__field-details">
                                <div className="irrigation-page__field-col">
                                    <span className="irrigation-page__col-lbl">
                                        Required Water Depth
                                    </span>
                                    <span className="irrigation-page__col-val">
                                        {field.waterCondition}
                                    </span>
                                </div>
                                <div className="irrigation-page__field-col">
                                    <span className="irrigation-page__col-lbl">
                                        Agronomic Recommendation
                                    </span>
                                    <span
                                        className="irrigation-page__col-val"
                                        style={{ color: "var(--accent)" }}
                                    >
                                        {field.recommendation}
                                    </span>
                                </div>
                                <div
                                    className="irrigation-page__field-col"
                                    style={{ maxWidth: 160 }}
                                >
                                    <span className="irrigation-page__col-lbl">
                                        Pumping & Cost
                                    </span>
                                    <span className="irrigation-page__col-val">
                                        {field.pumpingHoursRequired} hrs · ₹
                                        {field.estimatedPumpingCost}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Rice Stage Water Guide */}
            <section className="irrigation-page__guide section">
                <h2 className="irrigation-page__section-title">
                    Rice Growth Stage Water Depth Standard
                </h2>
                <div className="irrigation-page__guide-grid">
                    {irrigationData.stageRequirements.map((req, idx) => (
                        <div key={idx} className="irrigation-page__guide-card">
                            <span className="irrigation-page__guide-stage">
                                {req.stage}
                            </span>
                            <span className="irrigation-page__guide-depth">
                                {req.depth}
                            </span>
                            <span className="irrigation-page__guide-note">
                                {req.note}
                            </span>
                        </div>
                    ))}
                </div>
            </section>

            {/* Weekly Pumping Hours Chart */}
            <section className="irrigation-page__chart section">
                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 14,
                    }}
                >
                    <h2
                        className="irrigation-page__section-title"
                        style={{ margin: 0 }}
                    >
                        Weekly Pumping & Energy Expenditure
                    </h2>
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                        Daily hours operated
                    </span>
                </div>
                <div className="irrigation-page__chart-container">
                    <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={irrigationData.weeklyPumpingHours}>
                            <CartesianGrid
                                stroke="var(--chart-grid)"
                                strokeDasharray="3 3"
                            />
                            <XAxis
                                dataKey="day"
                                tick={{
                                    fontSize: 11,
                                    fill: "var(--chart-text)",
                                }}
                                axisLine={false}
                                tickLine={false}
                            />
                            <YAxis
                                tick={{
                                    fontSize: 11,
                                    fill: "var(--chart-text)",
                                }}
                                axisLine={false}
                                tickLine={false}
                                unit="h"
                            />
                            <Tooltip
                                formatter={(val, name, props) => [
                                    `${val} Hours (₹${props.payload.cost})`,
                                    "Pumping Runtime",
                                ]}
                                contentStyle={{
                                    background: "var(--bg-surface)",
                                    border: "1px solid var(--border)",
                                    borderRadius: "var(--radius-md)",
                                    fontSize: 12,
                                }}
                            />
                            <Bar
                                dataKey="hours"
                                fill="var(--accent)"
                                radius={[4, 4, 0, 0]}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </section>
        </div>
    );
}
