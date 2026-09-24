import {
    ResponsiveContainer,
    AreaChart,
    Area,
    XAxis,
    Tooltip,
} from "recharts";
import { analyticsData } from "../../data/mockData";
import { useLanguage } from "../../hooks/useLanguage";

/**
 * ProductionTrendChart — the "Production Forecast" mini chart on the
 * Dashboard's Production Trends card.
 *
 * PERF: this is the ONLY recharts surface on the dashboard, and it is a
 * below-the-fold decoration, so it lives in its own chunk and is imported
 * lazily by Dashboard.jsx. That keeps the entire charting library out of
 * the eagerly-parsed bundle: the first paint only pays for the shell and
 * the real content, and the chart arrives a frame or two later.
 *
 * The wrapper div is rendered HERE (not by the parent) so the lazy
 * fallback in Dashboard can render the identical wrapper with the same
 * height — the chart then lands in space that was already reserved, so
 * there is never a layout shift (§9). Styling stays in Dashboard.css, the
 * chart's original home, and the markup/geometry is unchanged.
 */
export default function ProductionTrendChart() {
    const { t, formatNumber } = useLanguage();

    return (
        <div className="dashboard-insight-card__chart">
            <ResponsiveContainer width="100%" height={90}>
                <AreaChart
                    data={analyticsData.productionTrend}
                    margin={{
                        top: 4,
                        right: 4,
                        left: 4,
                        bottom: 0,
                    }}
                >
                    <defs>
                        <linearGradient
                            id="agriAreaGrad"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                        >
                            <stop
                                offset="0%"
                                stopColor="var(--accent)"
                                stopOpacity={0.25}
                            />
                            <stop
                                offset="100%"
                                stopColor="var(--accent)"
                                stopOpacity={0}
                            />
                        </linearGradient>
                    </defs>
                    <XAxis
                        dataKey="month"
                        tick={{
                            fontSize: "min(max(calc(10px * var(--ts-small, 1)), 8px), 17px)",
                            fill: "var(--text-muted)",
                        }}
                        axisLine={false}
                        tickLine={false}
                    />
                    <Tooltip
                        formatter={(val) => [
                            `${formatNumber(val)} ${t("common.ton")}`,
                            t("dashboard.projectedYield"),
                        ]}
                        contentStyle={{
                            background: "var(--bg-surface)",
                            border: "1px solid var(--border)",
                            borderRadius: "var(--radius-sm)",
                            fontSize: "min(max(calc(12px * var(--ts-body, 1)), 9px), 24px)",
                            padding: "4px 8px",
                        }}
                    />
                    <Area
                        type="monotone"
                        dataKey="production"
                        stroke="var(--accent)"
                        strokeWidth={2.5}
                        fill="url(#agriAreaGrad)"
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}
