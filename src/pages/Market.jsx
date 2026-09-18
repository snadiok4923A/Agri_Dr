import { useMemo, useState } from "react";
import { useLanguage } from "../hooks/useLanguage";
import { marketPrices, marketFilters } from "../data/marketPrices";
import { Search, X } from "lucide-react";
import "./Market.css";

/*
 * Market Intelligence — minimal price directory.
 *
 * The page is a pure VIEW over src/data/marketPrices.js (data layer is
 * separate, so a live mandi API can replace the module later). Each card
 * shows exactly: variety + image, market price, market centre,
 * state/district, modal price. Clicking a card opens the same fields in a
 * floating glass modal — nothing more.
 */

function GrainFallback() {
    return (
        <svg viewBox="0 0 48 48" aria-hidden="true" className="market-page__card-fallback">
            <path
                d="M24 42c0-9 3-14 9-19-8 1-12 4-15 9 1-8-1-13-6-18 8 2 12 6 14 12 1-9 5-14 12-17-4 7-6 12-6 18-2-4-5-7-9-8 4 4 5 9 5 15"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
            />
        </svg>
    );
}

export default function Market() {
    const { t, formatNumber } = useLanguage();
    const [query, setQuery] = useState("");
    const [filter, setFilter] = useState("all");
    const [selected, setSelected] = useState(null);

    const filterLabels = {
        all: t("market.filterAll"),
        basmati: t("market.filterBasmati"),
        traditional: t("market.filterTraditional"),
        premium: t("market.filterPremium"),
        other: t("market.filterOther"),
    };

    const activeFilter = useMemo(
        () => marketFilters.find((f) => f.id === filter) || marketFilters[0],
        [filter]
    );

    const results = useMemo(() => {
        const q = query.trim().toLowerCase();
        return marketPrices.filter((r) => {
            if (!activeFilter.match(r)) return false;
            if (!q) return true;
            return (
                r.name.toLowerCase().includes(q) ||
                r.market.toLowerCase().includes(q) ||
                r.district.toLowerCase().includes(q) ||
                r.state.toLowerCase().includes(q)
            );
        });
    }, [query, activeFilter]);

    const price = (v) => `${t("common.rupeeSymbol")}${formatNumber(v)}`;

    return (
        <div className="page-container market-page">
            <section className="market-page__header section">
                <div>
                    <h1 className="market-page__title">{t("nav.market")}</h1>
                    <p className="dashboard__section-subtitle">
                        {t("market.subtitle")}
                    </p>
                </div>
            </section>

            <div className="market-page__controls">
                <div className="market-page__search">
                    <Search size={16} />
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder={t("market.searchPlaceholder")}
                    />
                </div>
                <div className="market-page__chips">
                    {marketFilters.map((f) => (
                        <button
                            key={f.id}
                            type="button"
                            className={`market-page__chip${
                                filter === f.id ? " market-page__chip--active" : ""
                            }`}
                            onClick={() => setFilter(f.id)}
                        >
                            {filterLabels[f.id]}
                        </button>
                    ))}
                </div>
            </div>

            {results.length === 0 ? (
                <p className="market-page__empty">{t("market.noResults")}</p>
            ) : (
                <div className="market-page__grid">
                    {results.map((r) => (
                        <button
                            key={r.id}
                            type="button"
                            className="market-page__card"
                            onClick={() => setSelected(r)}
                        >
                            <div className="market-page__card-top">
                                <div className="market-page__card-imgwrap">
                                    {r.image ? (
                                        <img
                                            src={r.image}
                                            alt={r.name}
                                            loading="lazy"
                                            onError={(e) => {
                                                e.currentTarget.style.display = "none";
                                            }}
                                        />
                                    ) : null}
                                    {!r.image && <GrainFallback />}
                                </div>
                                <h3 className="market-page__card-name">{r.name}</h3>
                            </div>

                            <div className="market-page__card-price">
                                <span className="market-page__card-label">
                                    {t("market.marketPrice")}
                                </span>
                                <span className="market-page__card-value">
                                    {price(r.marketPrice)}
                                    <em> {t("market.perQuintal")}</em>
                                </span>
                            </div>

                            <div className="market-page__card-meta">
                                <span className="market-page__card-label">
                                    {t("market.marketCentre")}
                                </span>
                                <span className="market-page__card-meta-val">
                                    {r.market}
                                </span>
                            </div>

                            <div className="market-page__card-meta">
                                <span className="market-page__card-label">
                                    {t("market.stateDistrict")}
                                </span>
                                <span className="market-page__card-meta-val">
                                    {r.state} / {r.district}
                                </span>
                            </div>

                            <div className="market-page__card-modalprice">
                                <span className="market-page__card-label">
                                    {t("market.modalPrice")}
                                </span>
                                <span className="market-page__card-meta-val">
                                    {price(r.modalPrice)} {t("market.perQuintal")}
                                </span>
                            </div>

                            <span className="market-page__card-cta">
                                {t("market.viewDetails")} →
                            </span>
                        </button>
                    ))}
                </div>
            )}

            {selected && (
                <div
                    className="market-page__overlay"
                    onClick={() => setSelected(null)}
                >
                    <div
                        className="market-page__dialog"
                        role="dialog"
                        aria-modal="true"
                        aria-label={selected.name}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            type="button"
                            className="market-page__dialog-close"
                            aria-label={t("common.close")}
                            onClick={() => setSelected(null)}
                        >
                            <X size={18} />
                        </button>

                        <div className="market-page__dialog-imgwrap">
                            {selected.image ? (
                                <img src={selected.image} alt={selected.name} />
                            ) : (
                                <GrainFallback />
                            )}
                        </div>

                        <h3 className="market-page__dialog-name">{selected.name}</h3>

                        <div className="market-page__dialog-price">
                            <span className="market-page__card-label">
                                {t("market.marketPrice")}
                            </span>
                            <strong>
                                {price(selected.marketPrice)}
                                <em> {t("market.perQuintal")}</em>
                            </strong>
                        </div>

                        <div className="market-page__dialog-row">
                            <span className="market-page__card-label">
                                {t("market.marketCentre")}
                            </span>
                            <span>{selected.market}</span>
                        </div>
                        <div className="market-page__dialog-row">
                            <span className="market-page__card-label">
                                {t("market.stateDistrict")}
                            </span>
                            <span>
                                {selected.state} / {selected.district}
                            </span>
                        </div>
                        <div className="market-page__dialog-row">
                            <span className="market-page__card-label">
                                {t("market.modalPrice")}
                            </span>
                            <span>
                                {price(selected.modalPrice)} {t("market.perQuintal")}
                            </span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
