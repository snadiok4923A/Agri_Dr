import { useNavigate } from "react-router-dom";
import { ArrowUpRight, ArrowDownRight, ChevronRight } from "lucide-react";
import { marketData } from "../../data/mockData";
import { useLanguage } from "../../hooks/useLanguage";
import "./DashboardFeatureCards.css";

/**
 * Market card — one crop's price at a glance, sourced from the existing
 * marketData (Pusa Basmati 1121: the top-profit variety). Compact info card:
 * crop name, price, change pill and a "Market Intelligence" link. Green
 * accents when the price is up, red when down. Fully i18n-driven.
 */
export default function MarketCard() {
    const navigate = useNavigate();
    const { t, formatNumber } = useLanguage();

    const crop = marketData.crops.find(
        (c) => c.variety === "Basmati" || c.name.includes("Basmati"),
    ) || marketData.crops[0];

    const up = crop.trend !== "down";

    return (
        <div
            className="feature-card feature-card--market"
            onClick={() => navigate("/market")}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") navigate("/market");
            }}
        >
            <div className="feature-card__head">
                <span className="feature-card__title">{crop.variety}</span>
                <span
                    className={`feature-card__trend ${
                        up
                            ? "feature-card__trend--up"
                            : "feature-card__trend--down"
                    }`}
                >
                    {up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                    {up ? t("dashboard.priceUp") : t("dashboard.priceDown")} ·{" "}
                    {formatNumber(Math.abs(crop.change), {
                        minimumFractionDigits: 1,
                    })}%
                </span>
            </div>

            <div className="feature-card__market-body">
                <div className="feature-card__market-price">
                    <span className="feature-card__price">
                        ₹{formatNumber(crop.price)}
                    </span>
                    <span className="feature-card__price-unit">/Q</span>
                    <span
                        className={`feature-card__change ${
                            up
                                ? "feature-card__change--up"
                                : "feature-card__change--down"
                        }`}
                    >
                        {up ? "▲" : "▼"} {formatNumber(Math.abs(crop.change), { minimumFractionDigits: 1 })}%
                    </span>
                </div>
            </div>

            <span className="feature-card__more">
                {t("dashboard.marketIntelligence")} <ChevronRight size={12} />
            </span>
        </div>
    );
}
