import { useEffect, useMemo } from "react";
import { useLanguage } from "../hooks/useLanguage";
import { computeFarmFinance } from "../lib/financeCalc";
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
import EmptyFarmNotice from "../components/onboarding/EmptyFarmNotice";
import { useOnboarding } from "../hooks/useOnboarding";
import "./Finance.css";

export default function Finance() {
    const { t, formatNumber } = useLanguage();
    const { isFarmComplete, farm, refreshFarm } = useOnboarding();

    /* REAL-TIME SYNC (spec §10): re-fetch the shared farm rows whenever
       this page opens. Edit-Farm saves already flow through the shared
       onboarding context, so no farm value is ever cached locally here. */
    useEffect(() => {
        refreshFarm();
    }, [refreshFarm]);

    /* ONE SOURCE OF TRUTH (spec §1): the exact same survey parcels that
       My Farm renders — no second farm dataset, no demo values. */
    const parcels = farm?.parcels || [];
    const finance = useMemo(() => computeFarmFinance(parcels), [parcels]);

    /* NO FAKE DATA: cost & profit only make sense with real farm details.
       Until onboarding completes, show the empty state instead of demo
       numbers (CTA re-opens the wizard). */
    if (!isFarmComplete || parcels.length === 0) {
        return (
            <div className="page-container finance-page">
                <section className="finance-page__header section">
                    <div>
                        <h1 className="finance-page__title">{t("nav.finance")}</h1>
                    </div>
                </section>
                <EmptyFarmNotice variant="page" finance />
            </div>
        );
    }

    const { rows, totals } = finance;

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

            {/* Financial Summary — all three cards derive from the same
                My Farm parcels (area × variety rates from project data). */}
            <section className="finance-page__summary section">
                <div className="finance-page__summary-card finance-page__summary-card--expense">
                    <span className="finance-page__summary-label">
                        {t("finance.totalExpenses")}
                    </span>
                    <span className="finance-page__summary-value">
                        {t("common.rupeeSymbol")}
                        {formatNumber(totals.cost)}
                    </span>
                    <span className="finance-page__summary-sub">
                        {totals.costPerAcre !== null
                            ? t("finance.acresAt", {
                                  acres: formatNumber(totals.acres),
                                  perAcre: formatNumber(totals.costPerAcre),
                              })
                            : t("common.noData")}
                    </span>
                </div>
                <div className="finance-page__summary-card finance-page__summary-card--revenue">
                    <span className="finance-page__summary-label">
                        {t("finance.expectedRevenue")}
                    </span>
                    <span className="finance-page__summary-value">
                        {t("common.rupeeSymbol")}
                        {formatNumber(totals.revenue)}
                    </span>
                    <span className="finance-page__summary-sub">
                        {totals.yieldTons > 0
                            ? t("finance.tonsTotal", {
                                  tons: formatNumber(totals.yieldTons),
                              })
                            : t("common.noData")}
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
                        {totals.margin !== null && (
                            <span className="finance-page__profit-badge">
                                +{formatNumber(totals.margin)}%{" "}
                                {t("finance.marginBadge")}
                            </span>
                        )}
                    </div>
                    <span
                        className="finance-page__summary-value"
                        style={{ color: "var(--success)" }}
                    >
                        {t("common.rupeeSymbol")}
                        {formatNumber(totals.profit)}
                    </span>
                    <span className="finance-page__summary-sub">
                        {t("finance.netAfter")}
                    </span>
                </div>
            </section>

            {/* Field-level table — ONE ROW PER ACTUAL MY FARM FIELD
                (spec §7): variety, field, area, yield, cost, revenue,
                profit all update the moment Edit Farm saves. */}
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
                            {rows.map((row) => (
                                <tr key={`${row.index}-${row.variety}`}>
                                    <td>
                                        <strong>{row.variety || "—"}</strong>
                                    </td>
                                    <td>
                                        {t("onboarding.area.parcelLabel")}{" "}
                                        {formatNumber(row.index + 1)} (
                                        {formatNumber(row.area)}{" "}
                                        {t(`onboarding.unitNames.${row.unit}`)})
                                    </td>
                                    <td>
                                        {row.yieldTons === null
                                            ? "—"
                                            : `${formatNumber(row.yieldTons)} ${t("common.ton")}`}
                                    </td>
                                    <td>
                                        {row.cost === null
                                            ? "—"
                                            : `₹${formatNumber(row.cost)}`}
                                    </td>
                                    <td>
                                        {row.revenue === null
                                            ? "—"
                                            : `₹${formatNumber(row.revenue)}`}
                                    </td>
                                    <td
                                        style={{
                                            color: "var(--success)",
                                            fontWeight: 700,
                                        }}
                                    >
                                        {row.profit === null
                                            ? "—"
                                            : `₹${formatNumber(row.profit)}`}
                                    </td>
                                    <td>
                                        <span className="finance-page__margin-pill">
                                            {row.margin === null
                                                ? "—"
                                                : `${formatNumber(row.margin)}%`}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            <div className="finance-page__grid">
                {/* Cost Breakdown — categories kept, amounts derived from
                    the farm's calculated total cost (sum === total). */}
                <section className="finance-page__breakdown section">
                <h2 className="finance-page__section-title">
                    {t("finance.costCategories")}
                </h2>
                    <div className="finance-page__chart-row">
                        <div className="finance-page__pie">
                            <ResponsiveContainer width={180} height={180}>
                                <PieChart>
                                    <Pie
                                        data={finance.costCategories}
                                        dataKey="amount"
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={50}
                                        outerRadius={80}
                                        strokeWidth={0}
                                    >
                                        {finance.costCategories.map((entry, i) => (
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
                            {finance.costCategories.map((item, i) => (
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

                {/* Monthly Expense Schedule — estimated seasonal split of
                    the SAME total cost, clearly labelled (spec §9). */}
                <section className="finance-page__trend section">
                <h2 className="finance-page__section-title">
                    {t("finance.monthlyExpenditure")}
                </h2>
                    <p className="finance-page__chart-note">
                        {t("finance.estimateNote")}
                    </p>
                    <div className="finance-page__chart-container">
                        <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={finance.monthly}>
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
