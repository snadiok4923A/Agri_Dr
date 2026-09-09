import { useLanguage } from "../hooks/useLanguage";
import { marketData } from "../data/mockData";
import {
    TrendingUp,
    TrendingDown,
    Store,
    Sparkles,
    Coins,
    DollarSign,
} from "lucide-react";
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
} from "recharts";
import "./Market.css";

export default function Market() {
    const { t } = useLanguage();

    return (
        <div className="page-container market-page">
            <section className="market-page__header section">
                <div>
                    <h1 className="market-page__title">{t("nav.market")}</h1>
                    <p className="dashboard__section-subtitle">
                        APMC Mandi spot rates, rice selling value calculation,
                        and net profit projections
                    </p>
                </div>
            </section>

            {/* Mandi Intelligence Advisory */}
            <div className="market-page__advisory section">
                <Sparkles size={18} className="market-page__advisory-icon" />
                <div className="market-page__advisory-text">
                    <strong>Mandi Intelligence:</strong>{" "}
                    {marketData.mandiAdvisory}
                </div>
            </div>

            <div className="market-page__grid">
                {marketData.crops.map((crop, i) => (
                    <div key={i} className="market-page__crop-card">
                        <div className="market-page__crop-header">
                            <div>
                                <span className="market-page__crop-name">
                                    {crop.name}
                                </span>
                                <div className="market-page__crop-price">
                                    <span className="market-page__crop-amount">
                                        {t("common.rupeeSymbol")}
                                        {crop.price}
                                    </span>
                                    <span className="market-page__crop-unit">
                                        / {t("common.quintal")}
                                    </span>
                                </div>
                            </div>
                            <div
                                className={`market-page__crop-change market-page__crop-change--${crop.trend}`}
                            >
                                {crop.trend === "up" ? (
                                    <TrendingUp size={14} />
                                ) : (
                                    <TrendingDown size={14} />
                                )}
                                <span>
                                    {crop.change > 0 ? "+" : ""}
                                    {crop.change}%
                                </span>
                            </div>
                        </div>

                        {/* Farm Production & Profit Calculation Box */}
                        <div className="market-page__calc-box">
                            <div className="market-page__calc-row">
                                <span className="market-page__calc-lbl">
                                    Expected Farm Yield:
                                </span>
                                <span className="market-page__calc-val">
                                    {crop.expectedProductionTons} Ton (
                                    {(crop.expectedProductionTons * 10).toFixed(
                                        0,
                                    )}{" "}
                                    Quintals)
                                </span>
                            </div>
                            <div className="market-page__calc-row">
                                <span className="market-page__calc-lbl">
                                    Estimated Selling Value:
                                </span>
                                <span className="market-page__calc-val">
                                    ₹
                                    {crop.estimatedSellingRevenue.toLocaleString(
                                        "en-IN",
                                    )}
                                </span>
                            </div>
                            <div className="market-page__calc-row">
                                <span className="market-page__calc-lbl">
                                    Total Input Cost:
                                </span>
                                <span className="market-page__calc-val">
                                    ₹
                                    {crop.estimatedCost.toLocaleString("en-IN")}
                                </span>
                            </div>
                            <div className="market-page__calc-row market-page__calc-row--profit">
                                <span className="market-page__calc-lbl">
                                    Expected Net Profit:
                                </span>
                                <span
                                    className="market-page__calc-val"
                                    style={{ color: "var(--success)" }}
                                >
                                    ₹
                                    {crop.expectedProfit.toLocaleString(
                                        "en-IN",
                                    )}{" "}
                                    ({crop.profitMargin}%)
                                </span>
                            </div>
                        </div>

                        <div className="market-page__chart">
                            <ResponsiveContainer width="100%" height={120}>
                                <LineChart data={crop.priceHistory}>
                                    <XAxis
                                        dataKey="month"
                                        tick={{
                                            fontSize: 10,
                                            fill: "var(--chart-text)",
                                        }}
                                        axisLine={false}
                                        tickLine={false}
                                    />
                                    <YAxis
                                        domain={[
                                            "dataMin - 50",
                                            "dataMax + 50",
                                        ]}
                                        tick={{
                                            fontSize: 10,
                                            fill: "var(--chart-text)",
                                        }}
                                        axisLine={false}
                                        tickLine={false}
                                        hide
                                    />
                                    <Tooltip
                                        formatter={(val) => [
                                            `₹${val}/Q`,
                                            "Mandi Rate",
                                        ]}
                                        contentStyle={{
                                            background: "var(--bg-surface)",
                                            border: "1px solid var(--border)",
                                            borderRadius: "var(--radius-md)",
                                            fontSize: 12,
                                        }}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="price"
                                        stroke={
                                            crop.trend === "up"
                                                ? "var(--accent)"
                                                : "var(--danger)"
                                        }
                                        strokeWidth={2}
                                        dot={false}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>

                        <div className="market-page__markets">
                            <h4 className="market-page__markets-title">
                                {t("market.nearbyMarkets")}
                            </h4>
                            {crop.markets.map((market, j) => (
                                <div
                                    key={j}
                                    className="market-page__market-row"
                                >
                                    <Store size={14} />
                                    <span className="market-page__market-name">
                                        {market.name}
                                    </span>
                                    <span className="market-page__market-price">
                                        {t("common.rupeeSymbol")}
                                        {market.price} / Q
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
