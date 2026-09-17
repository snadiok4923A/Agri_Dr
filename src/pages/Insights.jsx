import { useLanguage } from "../hooks/useLanguage";
import { analyticsData, activityData, calendarData } from "../data/mockData";
import { Clock, TrendingUp, Award, Sparkles, Sprout } from "lucide-react";
import {
    AreaChart,
    Area,
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from "recharts";
import "./Insights.css";

export default function Insights() {
    const { t, formatNumber } = useLanguage();

    return (
        <div className="page-container insights-page">
            <section className="insights-page__header section">
                <div>
                    <h1 className="insights-page__title">
                        {t("nav.insights")}
                    </h1>
                    <p className="dashboard__section-subtitle">
                        {t("insights.subtitle")}
                    </p>
                </div>
            </section>

            {/* Top Production & Financial KPIs */}
            <section className="insights-page__metrics section">
                {analyticsData.metrics.map((m, i) => (
                    <div key={i} className="insights-page__metric-card">
                        <span className="insights-page__metric-label">
                            {m.label}
                        </span>
                        <span className="insights-page__metric-value">
                            {m.unit === "₹"
                                ? `₹${formatNumber(m.value)}`
                                : formatNumber(m.value)}
                            {m.unit && m.unit !== "₹" && (
                                <span className="insights-page__metric-unit">
                                    {" "}
                                    {m.unit}
                                </span>
                            )}
                        </span>
                        <span
                            className={`insights-page__metric-change insights-page__metric-change--${m.trend}`}
                        >
                            {m.trend === "up" ? "↗" : "↘"} {formatNumber(Math.abs(m.change))}%
                            {" "}{t("insights.vsTarget")}
                        </span>
                    </div>
                ))}
            </section>

            {/* Variety Profit & Yield Benchmark Highlights */}
            <section className="insights-page__highlights section">
                <div className="insights-page__highlight-card insights-page__highlight-card--profit">
                    <div className="insights-page__highlight-icon">
                        <Award size={20} />
                    </div>
                    <div>
                        <span className="insights-page__highlight-tag">
                            {t("insights.highestProfit")}
                        </span>
                        <span className="insights-page__highlight-val">
                            {analyticsData.bestVariety}
                        </span>
                    </div>
                </div>

                <div className="insights-page__highlight-card insights-page__highlight-card--yield">
                    <div className="insights-page__highlight-icon">
                        <Sprout size={20} />
                    </div>
                    <div>
                        <span className="insights-page__highlight-tag">
                            {t("insights.highestVolume")}
                        </span>
                        <span className="insights-page__highlight-val">
                            {analyticsData.highestYield}
                        </span>
                    </div>
                </div>
            </section>

            {/* Charts: Production Trend + Yield Trend */}
            <div className="insights-page__grid">
                <section className="insights-page__chart-card section">
                    <div
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: 10,
                        }}
                    >
                        <h2 className="insights-page__section-title">
                            {t("insights.productionForecast")} {t("insights.aprToSep")}
                        </h2>
                        <span
                            style={{ fontSize: "min(max(calc(11px * var(--ts-small, 1)), 8px), 17px)", color: "var(--text-muted)" }}
                        >
                            {t("insights.tonUnit")}
                        </span>
                    </div>
                    <ResponsiveContainer width="100%" height={210}>
                        <AreaChart data={analyticsData.productionTrend}>
                            <defs>
                                <linearGradient
                                    id="insightProdGrad"
                                    x1="0"
                                    y1="0"
                                    x2="0"
                                    y2="1"
                                >
                                    <stop
                                        offset="0%"
                                        stopColor="var(--accent)"
                                        stopOpacity={0.2}
                                    />
                                    <stop
                                        offset="100%"
                                        stopColor="var(--accent)"
                                        stopOpacity={0}
                                    />
                                </linearGradient>
                            </defs>
                            <CartesianGrid
                                stroke="var(--chart-grid)"
                                strokeDasharray="3 3"
                            />
                            <XAxis
                                dataKey="month"
                                tick={{
                                    fontSize: "min(max(calc(10px * var(--ts-small, 1)), 8px), 17px)",
                                    fill: "var(--chart-text)",
                                }}
                                axisLine={false}
                                tickLine={false}
                            />
                            <YAxis
                                domain={[0, 20]}
                                tick={{
                                    fontSize: "min(max(calc(10px * var(--ts-small, 1)), 8px), 17px)",
                                    fill: "var(--chart-text)",
                                }}
                                axisLine={false}
                                tickLine={false}
                                width={28}
                            />
                            <Tooltip
                                formatter={(val) => [
                                    `${formatNumber(val)} ${t("insights.tonUnit")}`,
                                    t("insights.projectedProduction"),
                                ]}
                                contentStyle={{
                                    background: "var(--bg-surface)",
                                    border: "1px solid var(--border)",
                                    borderRadius: "var(--radius-md)",
                                    fontSize: "min(max(calc(12px * var(--ts-body, 1)), 9px), 24px)",
                                }}
                            />
                            <Area
                                type="monotone"
                                dataKey="production"
                                stroke="var(--accent)"
                                fill="url(#insightProdGrad)"
                                strokeWidth={2}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </section>

                <section className="insights-page__chart-card section">
                    <div
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: 10,
                        }}
                    >
                        <h2 className="insights-page__section-title">
                            {t("insights.yield")} {t("insights.expectedVsPotential")}
                        </h2>
                        <span
                            style={{ fontSize: "min(max(calc(11px * var(--ts-small, 1)), 8px), 17px)", color: "var(--text-muted)" }}
                        >
                            {t("insights.perAcre")}
                        </span>
                    </div>
                    <ResponsiveContainer width="100%" height={210}>
                        <LineChart data={analyticsData.yieldTrend}>
                            <CartesianGrid
                                stroke="var(--chart-grid)"
                                strokeDasharray="3 3"
                            />
                            <XAxis
                                dataKey="month"
                                tick={{
                                    fontSize: "min(max(calc(10px * var(--ts-small, 1)), 8px), 17px)",
                                    fill: "var(--chart-text)",
                                }}
                                axisLine={false}
                                tickLine={false}
                            />
                            <YAxis
                                domain={[2, 5]}
                                tick={{
                                    fontSize: "min(max(calc(10px * var(--ts-small, 1)), 8px), 17px)",
                                    fill: "var(--chart-text)",
                                }}
                                axisLine={false}
                                tickLine={false}
                                width={28}
                            />
                            <Tooltip
                                formatter={(val, name) => [
                                    `${formatNumber(val)} ${t("insights.perAcre")}`,
                                    name === "actual"
                                        ? t("insights.expected")
                                        : t("insights.potential"),
                                ]}
                                contentStyle={{
                                    background: "var(--bg-surface)",
                                    border: "1px solid var(--border)",
                                    borderRadius: "var(--radius-md)",
                                    fontSize: "min(max(calc(12px * var(--ts-body, 1)), 9px), 24px)",
                                }}
                            />
                            <Line
                                type="monotone"
                                dataKey="actual"
                                stroke="var(--accent)"
                                strokeWidth={2}
                                dot={false}
                                name={t("insights.expected")}
                            />
                            <Line
                                type="monotone"
                                dataKey="potential"
                                stroke="var(--text-muted)"
                                strokeWidth={2}
                                strokeDasharray="5 5"
                                dot={false}
                                name={t("insights.potential")}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </section>
            </div>

            {/* Variety Comparison Benchmarking Table */}
            <section className="insights-page__table-section section">
                <h2 className="insights-page__section-title">
                    {t("insights.benchmarking")}
                </h2>
                <div className="insights-page__table-wrapper">
                    <table className="insights-page__table">
                        <thead>
                            <tr>
                                <th>{t("crops.variety")}</th>
                                <th>{t("crops.expectedYield")}</th>
                                <th>{t("crops.estimatedCost")}</th>
                                <th>{t("insights.expectedNetProfit")}</th>
                                <th>{t("crops.margin")}</th>
                                <th>{t("insights.efficiency")}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {analyticsData.varietyComparison.map((row, i) => (
                                <tr key={i}>
                                    <td>
                                        <strong>{row.variety}</strong>
                                    </td>
                                    <td>{formatNumber(row.expectedYield)} {t("common.ton")}</td>
                                    <td>₹{formatNumber(row.cost)}</td>
                                    <td
                                        style={{
                                            color: "var(--success)",
                                            fontWeight: 700,
                                        }}
                                    >
                                        ₹{formatNumber(row.profit)}
                                    </td>
                                    <td>
                                        <span className="insights-page__badge">
                                            {formatNumber(row.margin)}%
                                        </span>
                                    </td>
                                    <td>
                                        <span className="insights-page__efficiency-tag">
                                            {row.efficiency}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            {/* Calendar & Recent Operations */}
            <div className="insights-page__grid">
                <section className="insights-page__calendar section">
                <h2 className="insights-page__section-title">
                    {t("insights.cropCalendar")}
                </h2>
                    <div className="insights-page__calendar-list">
                        {calendarData.map((c, i) => (
                            <div
                                key={i}
                                className="insights-page__calendar-item"
                            >
                                <div className="insights-page__calendar-date">
                                    {c.date}
                                </div>
                                <div className="insights-page__calendar-info">
                                    <span className="insights-page__calendar-task">
                                        {c.task}
                                    </span>
                                    <span className="insights-page__calendar-field">
                                        {c.field}
                                    </span>
                                </div>
                                <span
                                    className={`insights-page__calendar-badge insights-page__calendar-badge--${c.type}`}
                                >
                                    {c.type}
                                </span>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="insights-page__activity section">
                    <h2 className="insights-page__section-title">
                        {t("insights.recentActivity")}
                    </h2>
                    <div className="insights-page__activity-list">
                        {activityData.map((a) => (
                            <div
                                key={a.id}
                                className="insights-page__activity-item"
                            >
                                <div className="insights-page__activity-dot" />
                                <div className="insights-page__activity-content">
                                    <span className="insights-page__activity-action">
                                        {a.action}
                                    </span>
                                    <span className="insights-page__activity-field">
                                        {a.field}
                                    </span>
                                </div>
                                <span className="insights-page__activity-time">
                                    <Clock size={12} />
                                    {a.time}
                                </span>
                            </div>
                        ))}
                    </div>
                </section>
            </div>
        </div>
    );
}
