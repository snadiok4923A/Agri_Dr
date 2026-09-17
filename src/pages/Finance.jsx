import { useLanguage } from "../hooks/useLanguage";
import { financeData } from "../data/mockData";
import {
    PieChart,
    Pie,
    Cell,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from "recharts";
import { TrendingUp, Coins, DollarSign, Wheat } from "lucide-react";
import "./Finance.css";

export default function Finance() {
    const { t, formatNumber } = useLanguage();
    const { expenses, revenue, monthlyExpenses, varietyWiseProfit } =
        financeData;

    return (
        <div className="page-container finance-page">
            <section className="finance-page__header section">
                <div>
                    <h1 className="finance-page__title">{t("nav.finance")}</h1>
                    <p className="dashboard__section-subtitle">
                        {t("finance.subtitle")}
                    </p>
                </div>
            </section>

            {/* Financial Summary */}
            <section className="finance-page__summary section">
                <div className="finance-page__summary-card finance-page__summary-card--expense">
                    <span className="finance-page__summary-label">
                        {t("finance.totalExpenses")}
                    </span>
                    <span className="finance-page__summary-value">
                        {t("common.rupeeSymbol")}
                        {formatNumber(expenses.total)}
                    </span>
                    <span className="finance-page__summary-sub">
                        {t("finance.acresAt")}
                    </span>
                </div>
                <div className="finance-page__summary-card finance-page__summary-card--revenue">
                    <span className="finance-page__summary-label">
                        {t("finance.expectedRevenue")}
                    </span>
                    <span className="finance-page__summary-value">
                        {t("common.rupeeSymbol")}
                        {formatNumber(revenue.expected)}
                    </span>
                    <span className="finance-page__summary-sub">
                        {t("finance.tonsTotal")}
                    </span>
                </div>
                <div className="finance-page__summary-card finance-page__summary-card--profit">
                    <div
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: 8,
                        }}
                    >
                        <span
                            className="finance-page__summary-label"
                            style={{ margin: 0 }}
                        >
                            {t("finance.estimatedProfit")}
                        </span>
                        <span className="finance-page__profit-badge">
                            +{formatNumber(financeData.profitMargin)}% {t("finance.marginBadge")}
                        </span>
                    </div>
                    <span
                        className="finance-page__summary-value"
                        style={{ color: "var(--success)" }}
                    >
                        {t("common.rupeeSymbol")}
                        {formatNumber(revenue.estimatedProfit)}
                    </span>
                    <span className="finance-page__summary-sub">
                        {t("finance.netAfter")}
                    </span>
                </div>
            </section>

            {/* Variety-Wise Profit Table */}
            <section className="finance-page__variety-table-section section">
                <h2 className="finance-page__section-title">
                    {t("finance.varietyBreakdown")}
                </h2>
                <div className="finance-page__table-wrapper">
                    <table className="finance-page__table">
                        <thead>
                            <tr>
                                <th>{t("crops.variety")}</th>
                                <th>{t("crops.fieldArea")}</th>
                                <th>{t("crops.expectedYield")}</th>
                                <th>{t("crops.estimatedCost")}</th>
                                <th>{t("crops.expectedRevenue")}</th>
                                <th>{t("crops.expectedProfit")}</th>
                                <th>{t("crops.margin")}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {varietyWiseProfit.map((v, i) => (
                                <tr key={i}>
                                    <td>
                                        <strong>{v.variety}</strong>
                                    </td>
                                    <td>
                                        {v.field} ({formatNumber(v.area)} ac)
                                    </td>
                                    <td>{formatNumber(v.expectedYield)} {t("common.ton")}</td>
                                    <td>₹{formatNumber(v.cost)}</td>
                                    <td>
                                        ₹{formatNumber(v.revenue)}
                                    </td>
                                    <td
                                        style={{
                                            color: "var(--success)",
                                            fontWeight: 700,
                                        }}
                                    >
                                        ₹{formatNumber(v.profit)}
                                    </td>
                                    <td>
                                        <span className="finance-page__margin-pill">
                                            {formatNumber(v.margin)}%
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            <div className="finance-page__grid">
                {/* Cost Breakdown */}
                <section className="finance-page__breakdown section">
                <h2 className="finance-page__section-title">
                    {t("finance.costCategories")}
                </h2>
                    <div className="finance-page__chart-row">
                        <div className="finance-page__pie">
                            <ResponsiveContainer width={180} height={180}>
                                <PieChart>
                                    <Pie
                                        data={expenses.breakdown}
                                        dataKey="amount"
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={50}
                                        outerRadius={80}
                                        strokeWidth={0}
                                    >
                                        {expenses.breakdown.map((entry, i) => (
                                            <Cell key={i} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        formatter={(val) => [
                                            `₹${formatNumber(val)}`,
                                            t("finance.cost"),
                                        ]}
                                        contentStyle={{
                                            background: "var(--bg-surface)",
                                            border: "1px solid var(--border)",
                                            borderRadius: "var(--radius-md)",
                                            fontSize: "min(max(calc(12px * var(--ts-body, 1)), 9px), 24px)",
                                        }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="finance-page__legend">
                            {expenses.breakdown.map((item, i) => (
                                <div
                                    key={i}
                                    className="finance-page__legend-item"
                                >
                                    <span
                                        className="finance-page__legend-dot"
                                        style={{ background: item.color }}
                                    />
                                    <span className="finance-page__legend-label">
                                        {item.category}
                                    </span>
                                    <span className="finance-page__legend-value">
                                        {t("common.rupeeSymbol")}
                                        {formatNumber(item.amount)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Monthly Expense Schedule */}
                <section className="finance-page__trend section">
                <h2 className="finance-page__section-title">
                    {t("finance.monthlyExpenditure")}
                </h2>
                    <div className="finance-page__chart-container">
                        <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={monthlyExpenses}>
                                <CartesianGrid
                                    stroke="var(--chart-grid)"
                                    strokeDasharray="3 3"
                                />
                                <XAxis
                                    dataKey="month"
                                    tick={{
                                        fontSize: "min(max(calc(11px * var(--ts-small, 1)), 8px), 17px)",
                                        fill: "var(--chart-text)",
                                    }}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <YAxis
                                    tick={{
                                        fontSize: "min(max(calc(11px * var(--ts-small, 1)), 8px), 17px)",
                                        fill: "var(--chart-text)",
                                    }}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <Tooltip
                                    formatter={(val) => [
                                        `₹${formatNumber(val)}`,
                                        t("finance.expenditure"),
                                    ]}
                                    contentStyle={{
                                        background: "var(--bg-surface)",
                                        border: "1px solid var(--border)",
                                        borderRadius: "var(--radius-md)",
                                        fontSize: "min(max(calc(12px * var(--ts-body, 1)), 9px), 24px)",
                                    }}
                                />
                                <Bar
                                    dataKey="amount"
                                    fill="var(--accent)"
                                    radius={[4, 4, 0, 0]}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </section>
            </div>
        </div>
    );
}
