import { useEffect, useMemo, useRef, useState } from "react";
import { useLanguage } from "../hooks/useLanguage";
import { marketPrices, marketFilters, buildPriceHistory } from "../data/marketPrices";
import { Search, X } from "lucide-react";
import { registerOverlay } from "../voice/overlayBus";
import {
    VOICE_OPEN_MARKET_EVENT,
    VOICE_FILTER_MARKET_EVENT,
} from "../voice/executeVoiceCommand";
import {
    ResponsiveContainer,
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
} from "recharts";
import "./Market.css";

/*
 * Market Intelligence — minimal price directory.
 *
 * The page is a pure VIEW over src/data/marketPrices.js (data layer is
 * separate, so a live mandi API can replace the module later). Cards show
 * exactly: variety + image, market price, market centre, state/district,
 * modal price. Clicking a card opens the same fields plus min/max prices
 * and a 7-day / 1-month modal-price history chart in a floating glass
 * modal — nothing more.
 */

const BASE = import.meta.env.BASE_URL;

/* Public-folder asset, base-path aware ("/Agri_Dr/" on GitHub Pages). */
function cropAsset(path) {
    return `${BASE}${String(path).replace(/^\//, "")}`;
}
/* Shared rice illustration — the last-resort image so a card can never
 * go blank: a broken/aborted load swaps in this file, never an empty box. */
const RICE_FALLBACK = cropAsset("crops/Swarna.jpg");

function VarietyImage({ src, alt, className }) {
    const [broken, setBroken] = useState(false);
    return (
        <img
            className={className}
            src={broken ? RICE_FALLBACK : cropAsset(src)}
            alt={alt}
            loading="lazy"
            onError={() => setBroken(true)}
        />
    );
}

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

/* Price-or-dash guard (spec §18): no undefined/null/NaN in the UI. */
const fmtOrDash = (v, fmt) =>
    v === null || v === undefined || Number.isNaN(Number(v))
        ? "—"
        : fmt(v);

const localDay = (dateStr, opts, formatLabel) =>
    formatLabel(new Date(dateStr + "T12:00:00").toLocaleDateString("en-GB", opts));

export default function Market() {
    const { t, formatNumber, formatLabel } = useLanguage();
    const [query, setQuery] = useState("");
    const [filter, setFilter] = useState("all");
    const [selected, setSelected] = useState(null);
    const [range, setRange] = useState("7d");

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

    /* Chart series for the selected range with localized x labels; the
     * 1-month view thins its labels automatically via minTickGap. */
    const chart = useMemo(() => {
        if (!selected) return null;
        const days = range === "1m" ? 30 : 7;
        return buildPriceHistory(selected, days).map((p) => ({
            ...p,
            day: localDay(p.date, { day: "numeric", month: "short" }, formatLabel),
        }));
    }, [selected, range, formatLabel]);

    const close = () => setSelected(null);

    /* §17 close behaviors: Escape on desktop; overlay click handled in JSX.
     * Closing plays a subtle fade/scale-out (§16) before unmount. */
    const [closing, setClosing] = useState(false);
    // Latest animated-closer, updated every render — the overlay-bus entry
    // registered on mount must never call a stale stateful closure.
    const closeRef = useRef(null);
    const closeWithAnim = () => {
        if (!selected || closing) return;
        setClosing(true);
        window.setTimeout(() => {
            setSelected(null);
            setClosing(false);
        }, 160);
    };
    closeRef.current = closeWithAnim;

    useEffect(() => {
        if (!selected) return undefined;
        const onKey = (e) => {
            if (e.key === "Escape") closeWithAnim();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selected, closing]);

    // Voice integration (§10/§11): "traditional basmati price" opens the
    // Market page with that variety's floating price window; "basmati dam
    // koto" shows all Basmati cards; "close" closes the price window.
    useEffect(() => {
        const openVariety = (e) => {
            const rec = marketPrices.find((r) => r.id === e.detail?.id);
            if (rec) {
                setRange("7d");
                setSelected(rec);
            }
        };
        const applyFilter = (e) => {
            if (e.detail?.filter) setFilter(e.detail.filter);
        };
        window.addEventListener(VOICE_OPEN_MARKET_EVENT, openVariety);
        window.addEventListener(VOICE_FILTER_MARKET_EVENT, applyFilter);
        const unregister = registerOverlay({
            isOpen: () =>
                document.querySelector(".market-page__dialog") !== null,
            // Always call the LATEST closer — the animated close depends on
            // state (selected/closing) that this mount-time closure can't
            // see, so it's reached through a ref updated every render.
            close: () => closeRef.current?.(),
        });
        return () => {
            window.removeEventListener(VOICE_OPEN_MARKET_EVENT, openVariety);
            window.removeEventListener(VOICE_FILTER_MARKET_EVENT, applyFilter);
            unregister();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

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
                            onClick={() => {
                                setRange("7d");
                                setSelected(r);
                            }}
                        >
                            <div className="market-page__card-top">
                                <div className="market-page__card-imgwrap">
                                    {r.image ? (
                                        <VarietyImage src={r.image} alt={r.name} />
                                    ) : (
                                        <GrainFallback />
                                    )}
                                </div>
                                <h3 className="market-page__card-name">{r.name}</h3>
                            </div>

                            <div className="market-page__card-price">
                                <span className="market-page__card-label">
                                    {t("market.marketPrice")}
                                </span>
                                <span className="market-page__card-value">
                                    {fmtOrDash(r.marketPrice, price)}
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
                                    {fmtOrDash(r.modalPrice, price)} {t("market.perQuintal")}
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
                    className={`market-page__overlay market-page__overlay--open${
                        closing ? " market-page__overlay--closing" : ""
                    }`}
                    onClick={closeWithAnim}
                    role="presentation"
                >
                    <div
                        className={`market-page__dialog market-page__dialog--open${
                            closing ? " market-page__dialog--closing" : ""
                        }`}
                        role="dialog"
                        aria-modal="true"
                        aria-label={selected.name}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            type="button"
                            className="market-page__dialog-close"
                            aria-label={t("common.close")}
                            onClick={closeWithAnim}
                        >
                            <X size={18} />
                        </button>

                        <div className="market-page__dialog-head">
                            <div className="market-page__dialog-imgwrap">
                                {selected.image ? (
                                    <VarietyImage
                                        src={selected.image}
                                        alt={selected.name}
                                        className="market-page__dialog-img"
                                    />
                                ) : (
                                    <GrainFallback />
                                )}
                            </div>
                            <h3 className="market-page__dialog-name">{selected.name}</h3>
                        </div>

                        <div className="market-page__dialog-price">
                            <span className="market-page__card-label">
                                {t("market.marketPrice")}
                            </span>
                            <strong>
                                {fmtOrDash(selected.marketPrice, price)}
                                <em> {t("market.perQuintal")}</em>
                            </strong>
                        </div>

                        <div className="market-page__dialog-grid">
                            <div className="market-page__dialog-cell">
                                <span className="market-page__card-label">
                                    {t("market.marketCentre")}
                                </span>
                                <span className="market-page__dialog-cell-val">
                                    {selected.market}
                                </span>
                            </div>
                            <div className="market-page__dialog-cell">
                                <span className="market-page__card-label">
                                    {t("market.stateDistrict")}
                                </span>
                                <span className="market-page__dialog-cell-val">
                                    {selected.state} / {selected.district}
                                </span>
                            </div>
                        </div>

                        <div className="market-page__dialog-price market-page__dialog-price--modal">
                            <span className="market-page__card-label">
                                {t("market.modalPrice")}
                            </span>
                            <strong>
                                {fmtOrDash(selected.modalPrice, price)}
                                <em> {t("market.perQuintal")}</em>
                            </strong>
                        </div>

                        <div className="market-page__dialog-grid">
                            <div className="market-page__dialog-cell">
                                <span className="market-page__card-label">
                                    {t("market.minPrice")}
                                </span>
                                <span className="market-page__dialog-cell-val">
                                    {fmtOrDash(selected.minPrice ?? selected.modalPrice, price)}{" "}
                                    {t("market.perQuintal")}
                                </span>
                            </div>
                            <div className="market-page__dialog-cell">
                                <span className="market-page__card-label">
                                    {t("market.maxPrice")}
                                </span>
                                <span className="market-page__dialog-cell-val">
                                    {fmtOrDash(selected.maxPrice ?? selected.modalPrice, price)}{" "}
                                    {t("market.perQuintal")}
                                </span>
                            </div>
                        </div>

                        <div className="market-page__history">
                            <div className="market-page__history-head">
                                <span className="market-page__history-title">
                                    {t("market.priceHistory")}
                                </span>
                                <div className="market-page__range">
                                    {["7d", "1m"].map((r) => (
                                        <button
                                            key={r}
                                            type="button"
                                            className={`market-page__range-btn${
                                                range === r ? " market-page__range-btn--active" : ""
                                            }`}
                                            onClick={() => setRange(r)}
                                        >
                                            {t(r === "7d" ? "market.range7d" : "market.range1m")}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="market-page__chart">
                                <ResponsiveContainer width="100%" height={170}>
                                    <AreaChart
                                        data={chart}
                                        margin={{ top: 10, right: 8, bottom: 0, left: 0 }}
                                    >
                                        <defs>
                                            <linearGradient id="mpFill" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.32} />
                                                <stop offset="100%" stopColor="#22d3ee" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid
                                            stroke="#2b332f"
                                            strokeDasharray="3 6"
                                            vertical={false}
                                        />
                                        <XAxis
                                            dataKey="day"
                                            tickLine={false}
                                            axisLine={false}
                                            minTickGap={28}
                                            tick={{ fontSize: 10, fill: "#9aa09b" }}
                                        />
                                        <YAxis
                                            domain={["dataMin - 40", "dataMax + 40"]}
                                            tickLine={false}
                                            axisLine={false}
                                            width={46}
                                            tick={{ fontSize: 10, fill: "#9aa09b" }}
                                            tickFormatter={(v) =>
                                                `${t("common.rupeeSymbol")}${formatNumber(v)}`
                                            }
                                        />
                                        <Tooltip
                                            cursor={{ stroke: "#22d3ee", strokeOpacity: 0.35 }}
                                            content={<MarketChartTooltip />}
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="modalPrice"
                                            stroke="var(--accent)"
                                            strokeWidth={2}
                                            fill="url(#mpFill)"
                                            dot={false}
                                            activeDot={{ r: 4, strokeWidth: 0 }}
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

/* Small clean tooltip: localized date, modal price, min/max reference. */
function MarketChartTooltip({ active, payload }) {
    const { t, formatNumber, formatLabel } = useLanguage();
    if (!active || !payload?.length) return null;
    const p = payload[0].payload;
    return (
        <div className="market-page__tip">
            <span className="market-page__tip-date">
                {localDay(p.date, { day: "numeric", month: "short", year: "numeric" }, formatLabel)}
            </span>
            <span className="market-page__tip-row">
                {t("market.modalPrice")} ₹{formatNumber(p.modalPrice)}
            </span>
            <span className="market-page__tip-row market-page__tip-row--dim">
                {t("market.minPrice")} ₹{formatNumber(p.minPrice)} ·{" "}
                {t("market.maxPrice")} ₹{formatNumber(p.maxPrice)}
            </span>
        </div>
    );
}
