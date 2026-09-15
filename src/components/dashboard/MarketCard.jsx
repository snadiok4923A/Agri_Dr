import { useNavigate } from "react-router-dom";
import { ArrowUpRight, ArrowDownRight, ChevronRight } from "lucide-react";
import { marketData } from "../../data/mockData";
import "./DashboardFeatureCards.css";

/**
 * Market card — one crop's price movement at a glance, sourced from the
 * existing marketData (Pusa Basmati 1121: the top-profit variety). Green +
 * rising vector when the price is up, red when down. Compact sparkline built
 * from the existing monthly priceHistory — no chart library, just a polyline.
 */
export default function MarketCard() {
    const navigate = useNavigate();

    const crop = marketData.crops.find(
        (c) => c.variety === "Basmati" || c.name.includes("Basmati"),
    ) || marketData.crops[0];

    const up = crop.trend !== "down";
    const points = crop.priceHistory
        .map((p, i) => `${(i / (crop.priceHistory.length - 1)) * 100},${30 - ((p.price - Math.min(...crop.priceHistory.map((x) => x.price))) / Math.max(1, Math.max(...crop.priceHistory.map((x) => x.price)) - Math.min(...crop.priceHistory.map((x) => x.price)))) * 26}`)
        .join(" ");

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
                    {up ? "Price Up" : "Price Down"} · {Math.abs(crop.change).toFixed(1)}%
                </span>
            </div>

            <div className="feature-card__market-body">
                <div className="feature-card__market-price">
                    <span className="feature-card__price">
                        ₹{crop.price.toLocaleString("en-IN")}
                    </span>
                    <span className="feature-card__price-unit">/Q</span>
                    <span
                        className={`feature-card__change ${
                            up
                                ? "feature-card__change--up"
                                : "feature-card__change--down"
                        }`}
                    >
                        {up ? "▲" : "▼"} {Math.abs(crop.change).toFixed(1)}%
                    </span>
                </div>

                {/* Minimal vector trend line over the last 6 months */}
                <svg
                    className="feature-card__spark"
                    viewBox="0 0 100 32"
                    preserveAspectRatio="none"
                    aria-hidden="true"
                >
                    <polyline
                        points={points}
                        fill="none"
                        stroke={up ? "var(--leaf)" : "var(--danger)"}
                        strokeWidth="2.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        vectorEffect="non-scaling-stroke"
                    />
                </svg>
            </div>

            <span className="feature-card__more">
                Market Intelligence <ChevronRight size={12} />
            </span>
        </div>
    );
}
