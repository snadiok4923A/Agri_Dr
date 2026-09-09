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
    const { t } = useLanguage();
    const { expenses, revenue, monthlyExpenses, varietyWiseProfit } =
        financeData;

    return (
        <div className="page-container finance-page">
            <section className="finance-page__header section">
                <div>
                    <h1 className="finance-page__title">{t("nav.finance")}</h1>
                    <p className="dashboard__section-subtitle">
                        Rice production cost accounting, variety-wise revenue,
                        net profit estimation, and profit margins
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
                        {expenses.total.toLocaleString("en-IN")}
                    </span>
                    <span className="finance-page__summary-sub">
                        Across 8.6 Acres (₹15,813/ac)
                    </span>
                </div>
                <div className="finance-page__summary-card finance-page__summary-card--revenue">
                    <span className="finance-page__summary-label">
                        {t("finance.expectedRevenue")}
                    </span>
                    <span className="finance-page__summary-value">
                        {t("common.rupeeSymbol")}
                        {revenue.expected.toLocaleString("en-IN")}
                    </span>
                    <span className="finance-page__summary-sub">
                        16.1 Tons total expected yield
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
                            +{financeData.profitMargin}% Margin
                        </span>
                    </div>
                    <span
                        className="finance-page__summary-value"
                        style={{ color: "var(--success)" }}
                    >
                        {t("common.rupeeSymbol")}
                        {revenue.estimatedProfit.toLocaleString("en-IN")}
                    </span>
                    <span className="finance-page__summary-sub">
                        Net after seeds, fert, med & labor
                    </span>
                </div>
            </section>

            {/* Variety-Wise Profit Table */}
            <section className="finance-page__variety-table-section section">
                <h2 className="finance-page__section-title">
                    Variety-wise Rice Production & Profit Breakdown
                </h2>
                <div className="finance-page__table-wrapper">
                    <table className="finance-page__table">
                        <thead>
                            <tr>
                                <th>Rice Variety</th>
                                <th>Field / Area</th>
                                <th>Expected Yield</th>
                                <th>Estimated Cost</th>
                                <th>Expected Revenue</th>
                                <th>Expected Profit</th>
                                <th>Margin</th>
                            </tr>
                        </thead>
                        <tbody>
                            {varietyWiseProfit.map((v, i) => (
                                <tr key={i}>
                                    <td>
                                        <strong>{v.variety}</strong>
                                    </td>
                                    <td>
                                        {v.field} ({v.area} ac)
                                    </td>
                                    <td>{v.expectedYield} Ton</td>
                                    <td>₹{v.cost.toLocaleString("en-IN")}</td>
                                    <td>
                                        ₹{v.revenue.toLocaleString("en-IN")}
                                    </td>
                                    <td
                                        style={{
                                            color: "var(--success)",
                                            fontWeight: 700,
                                        }}
                                    >
                                        ₹{v.profit.toLocaleString("en-IN")}
                                    </td>
                                    <td>
                                        <span className="finance-page__margin-pill">
                                            {v.margin}%
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
                        Production Cost Categories
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
                                            `₹${val.toLocaleString("en-IN")}`,
                                            "Cost",
                                        ]}
                                        contentStyle={{
                                            background: "var(--bg-surface)",
                                            border: "1px solid var(--border)",
                                            borderRadius: "var(--radius-md)",
                                            fontSize: 12,
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
                                        {item.amount.toLocaleString("en-IN")}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Monthly Expense Schedule */}
                <section className="finance-page__trend section">
                    <h2 className="finance-page__section-title">
                        Monthly Season Expenditure
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
                                />
                                <Tooltip
                                    formatter={(val) => [
                                        `₹${val.toLocaleString("en-IN")}`,
                                        "Expenditure",
                                    ]}
                                    contentStyle={{
                                        background: "var(--bg-surface)",
                                        border: "1px solid var(--border)",
                                        borderRadius: "var(--radius-md)",
                                        fontSize: 12,
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
