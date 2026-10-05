import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useLanguage } from "../hooks/useLanguage";
import { fetchCatalog } from "../services/marketCatalogService";
import { medicineFilters, fertilizerFilters } from "../data/marketCatalog";
import "./MarketCatalog.css";
import {
    Search,
    Pill,
    Sprout,
    Leaf,
    FlaskConical,
    Bug,
    Dna,
    Database,
    AlertTriangle,
    ChevronLeft,
    ChevronRight,
    Loader2,
} from "lucide-react";

/*
 * MarketCatalog.jsx — Medicine & Fertilizer sections for the Market
 * Intelligence page.
 *
 * Rendered by Market.jsx when the main category selector is not "rice";
 * Market.jsx keeps the entire original Rice UI untouched. This module
 * owns ONLY the new tabs' state (query / filter / selection per kind),
 * so no category's state can leak into another's.
 *
 * Data comes from services/marketCatalogService.fetchCatalog() with the
 * loading → ready → error contract the UI must honor. Prices are only
 * rendered when the connected source carries them (a recorded input
 * cost for the bundled set); price === null renders the "not
 * available" state, never a fabricated number. Dosage strings are shown
 * only from the connected disease library; otherwise the modal shows
 * the safety line instead of invented instructions (spec §5/§7).
 */

/* ==================== per-kind icons ==================== */

/* Type chip → icon (type strings are the filter IDs from marketCatalog.js) */
const TYPE_ICONS = {
    fungicide: FlaskConical,
    bactericide: Dna,
    insecticide: Bug,
    nitrogen: Leaf,
    phosphate: Leaf,
    potash: Leaf,
    complex: FlaskConical,
    micronutrient: Sprout,
};

const KindIcon = ({ item }) => {
    const Icon = TYPE_ICONS[item.type] || Pill;
    return (
        <span className="market-cat-icon">
            <Icon size={24} strokeWidth={1.7} />
        </span>
    );
};

/* ==================== data hook ==================== */

const EMPTY_STATE = {
    status: "loading",
    items: [],
    source: null,
    lastUpdated: null,
    stale: false,
    error: null,
};

/**
 * useCatalog — load one category's catalog.
 * @param {"medicine"|"fertilizer"} kind
 */
function useCatalog(kind) {
    const [state, setState] = useState(EMPTY_STATE);

    useEffect(() => {
        let alive = true;
        setState(EMPTY_STATE);
        fetchCatalog(kind)
            .then((s) => {
                if (alive) setState(s);
            })
            .catch((e) => {
                if (alive) {
                    setState({
                        status: "error",
                        items: [],
                        source: null,
                        lastUpdated: null,
                        stale: false,
                        error: String(e?.message || e),
                    });
                }
            });
        return () => {
            alive = false;
        };
    }, [kind]);

    return state;
}

/* ==================== item details modal ==================== */

/**
 * ItemDetailsModal — the SAME portaled glass modal recipe as the Rice
 * details window (Market.jsx): .market-page__portal → __backdrop →
 * __overlay → __dialog → __dialog-body + __dialog-nav, with the same
 * fade/scale animation classes, Escape key, overlay click, body scroll
 * lock and animated 160ms close. Bottom nav: prev / close / next —
 * no top-right X, exactly like the Rice window.
 */
function ItemDetailsModal({ item, index, count, onIndexChange, onClose, kind }) {
    const { t, formatNumber } = useLanguage();
    const [closing, setClosing] = useState(false);

    /* Animated close (same 160ms as the Rice window) */
    const closeWithAnim = () => {
        if (closing) return;
        setClosing(true);
        window.setTimeout(() => {
            setClosing(false);
            onClose();
        }, 160);
    };

    /* Bottom-nav browsing: prev/next move the selection inside the
     * filtered results — the dialog stays open and re-renders. */
    const go = (dir) => {
        const next = index + dir;
        if (next >= 0 && next < count) onIndexChange(next);
    };

    /* §10: body scroll lock + wheel/touchmove guard, identical to Market.jsx */
    useEffect(() => {
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        const startsInDialog = (e) => e.target?.closest?.(".market-page__dialog");
        const onWheel = (e) => {
            if (!startsInDialog(e)) e.preventDefault();
        };
        const onTouchMove = (e) => {
            if (!startsInDialog(e)) e.preventDefault();
        };
        document.addEventListener("wheel", onWheel, { passive: false });
        document.addEventListener("touchmove", onTouchMove, { passive: false });
        return () => {
            document.body.style.overflow = prevOverflow;
            document.removeEventListener("wheel", onWheel);
            document.removeEventListener("touchmove", onTouchMove);
        };
    }, []);

    /* Escape closes (same §17 behavior as the Rice window) */
    useEffect(() => {
        const onKey = (e) => {
            if (e.key === "Escape") closeWithAnim();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [closing]);

    /* Price-or-dash guard (same as Market.jsx): no undefined/null/NaN. */
    const fmtOrDash = (v, fmt) => (v === null || v === undefined ? "—" : fmt(v));
    const price = (v) => `${t("common.rupeeSymbol")}${formatNumber(v)}`;
    const fmtValue = (v) => (v === null || v === undefined ? "—" : String(v));

    /* Dose line exists ONLY when the source carries a verified dose. */
    const doseLine = item.dose
        ? `${t("market.detailDose")}: ${item.dose}${item.coverage ? ` · ${item.coverage}` : ""}`
        : null;
    const hasApplicationInfo = Boolean(doseLine || item.uses?.length);

    return createPortal(
        <div className={`market-page__portal${closing ? " market-page__portal--closing" : ""}`}>
            <div className="market-page__backdrop" aria-hidden="true" />
            <div
                className={`market-page__overlay market-page__overlay--open${closing ? " market-page__overlay--closing" : ""}`}
                onClick={closeWithAnim}
                role="presentation"
            >
                <div
                    className={`market-page__dialog market-page__dialog--open${closing ? " market-page__dialog--closing" : ""}`}
                    role="dialog"
                    aria-modal="true"
                    aria-label={item.name}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Scrollable content area — the nav row below stays visible */}
                    <div className="market-page__dialog-body">
                        {/* head */}
                        <div className="market-cat-modal-head">
                            <div className="market-page__dialog-imgwrap">
                                <KindIcon item={item} />
                            </div>
                            <div>
                                <h3 className="market-cat-modal-name">{item.name}</h3>
                                {item.type ? (
                                    <span className="market-cat-modal-type">{item.type}</span>
                                ) : null}
                            </div>
                        </div>

                        {/* price block — honest "—" when the source carries no price */}
                        <div className="market-cat-modal-price">
                            <span className="market-page__card-label">
                                {t("market.detailPrice")}
                            </span>
                            <strong>
                                {fmtOrDash(item.price, price)}
                                <em> {t("market.detailUnit")}</em>
                            </strong>
                        </div>

                        {/* two-column info cells, same .market-page__dialog-grid style */}
                        <div className="market-page__dialog-grid">
                            {item.brand ? (
                                <div className="market-page__dialog-cell">
                                    <span className="market-page__card-label">
                                        {t("market.detailBrand")}
                                    </span>
                                    <span className="market-page__dialog-cell-val">
                                        {item.brand}
                                    </span>
                                </div>
                            ) : null}
                            {item.active && kind === "medicine" ? (
                                <div className="market-page__dialog-cell">
                                    <span className="market-page__card-label">
                                        {t("market.detailActive")}
                                    </span>
                                    <span className="market-page__dialog-cell-val">
                                        {item.active}
                                    </span>
                                </div>
                            ) : null}
                            {item.npk ? (
                                <div className="market-page__dialog-cell">
                                    <span className="market-page__card-label">
                                        {t("market.detailNpk")}
                                    </span>
                                    <span className="market-page__dialog-cell-val">{item.npk}</span>
                                </div>
                            ) : null}
                            {item.nutrients ? (
                                <div className="market-page__dialog-cell">
                                    <span className="market-page__card-label">
                                        {t("market.detailNutrients")}
                                    </span>
                                    <span className="market-page__dialog-cell-val">
                                        {item.nutrients}
                                    </span>
                                </div>
                            ) : null}
                            {item.pack ? (
                                <div className="market-page__dialog-cell">
                                    <span className="market-page__card-label">
                                        {t("market.detailPack")}
                                    </span>
                                    <span className="market-page__dialog-cell-val">{item.pack}</span>
                                </div>
                            ) : null}
                            {item.target ? (
                                <div className="market-page__dialog-cell">
                                    <span className="market-page__card-label">
                                        {t("market.detailTarget")}
                                    </span>
                                    <span className="market-page__dialog-cell-val">
                                        {item.target}
                                    </span>
                                </div>
                            ) : null}
                            {item.crops?.length ? (
                                <div className="market-page__dialog-cell">
                                    <span className="market-page__card-label">
                                        {t("market.detailCrops")}
                                    </span>
                                    <span className="market-page__dialog-cell-val">
                                        {item.crops.join(", ")}
                                    </span>
                                </div>
                            ) : null}
                        </div>

                        {/* dose line (only when the source carries a dose) */}
                        {doseLine ? (
                            <div className="market-cat-modal-note">{doseLine}</div>
                        ) : null}

                        {/* uses list (fertilizer): recorded plan / log applications */}
                        {item.uses?.length ? (
                            <div className="market-cat-modal-info">
                                {item.uses.map((u, i) => (
                                    <div key={i} className="market-cat-modal-note">
                                        {[u.where, u.qty, u.note].filter(Boolean).join(" · ")}
                                    </div>
                                ))}
                            </div>
                        ) : null}

                        {/* SAFETY: no verified application info → say so, never invent */}
                        {!hasApplicationInfo ? (
                            <div className="market-cat-modal-safety">
                                <AlertTriangle size={15} />
                                <span>{t("market.safetyNote")}</span>
                            </div>
                        ) : null}

                        {/* provenance */}
                        <div className="market-cat-modal-foot">
                            <span>
                                {t("market.detailSource")}: {item.source || "—"}
                            </span>
                            <span>
                                {t("market.detailUpdated")}: {fmtValue(item.lastUpdated)}
                            </span>
                        </div>
                    </div>

                    {/* Bottom navigation: prev / close / next (same as Rice) */}
                    <div className="market-page__dialog-nav">
                        <button
                            type="button"
                            className="market-page__nav-btn"
                            onClick={() => go(-1)}
                            disabled={index <= 0}
                            aria-label={t("common.previous")}
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <button type="button" className="market-page__nav-close" onClick={closeWithAnim}>
                            {t("common.close")}
                        </button>
                        <button
                            type="button"
                            className="market-page__nav-btn"
                            onClick={() => go(1)}
                            disabled={index < 0 || index >= count - 1}
                            aria-label={t("common.next")}
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}

/* ==================== section (search + filters + grid) ==================== */

/**
 * CatalogSection — one category's search bar, filter chips, cards and
 * details modal. Every instance owns its own state, so Medicine and
 * Fertilizer can never affect each other (or Rice).
 */
function CatalogSection({ kind, icon: KindGlyph, labels, filters, searchPlaceholder, noResultsText }) {
    const { t, formatNumber } = useLanguage();
    const catalog = useCatalog(kind);

    const [query, setQuery] = useState("");
    const [filterId, setFilterId] = useState("all");
    const [openIndex, setOpenIndex] = useState(-1);

    const results = useMemo(() => {
        const q = query.trim().toLowerCase();
        const active = filters.find((f) => f.id === filterId) || filters[0];
        return catalog.items.filter((r) => {
            if (!active.match(r)) return false;
            if (!q) return true;
            return (r.searchText || r.name.toLowerCase()).includes(q);
        });
    }, [catalog.items, filters, filterId, query]);

    const close = () => setOpenIndex(-1);

    const fmtPrice = (v) =>
        v === null || v === undefined ? null : `${t("common.rupeeSymbol")}${formatNumber(v)}`;

    return (
        <section className="market-cat-section">
            {/* provenance meta: source · last updated · stale/error notes */}
            {catalog.source || catalog.status === "error" ? (
                <div className="market-cat-section__meta">
                    {catalog.source ? (
                        <span>
                            <Database size={11} /> {catalog.source}
                        </span>
                    ) : null}
                    {catalog.lastUpdated ? <span>{catalog.lastUpdated}</span> : null}
                    {catalog.stale ? (
                        <span>
                            <AlertTriangle size={11} /> {t("market.staleNote")}
                        </span>
                    ) : null}
                    {catalog.status === "error" ? (
                        <span>
                            <AlertTriangle size={11} /> {t("market.errorNote")}
                        </span>
                    ) : null}
                </div>
            ) : null}

            {/* controls — same DOM order as the Rice page: search then chips */}
            <div className="market-page__controls">
                <div className="market-page__search">
                    <Search size={16} />
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder={searchPlaceholder}
                    />
                </div>
                <div className="market-page__chips">
                    {filters.map((f) => (
                        <button
                            key={f.id}
                            type="button"
                            className={`market-page__chip${
                                filterId === f.id ? " market-page__chip--active" : ""
                            }`}
                            onClick={() => setFilterId(f.id)}
                        >
                            {labels[f.id] || f.id}
                        </button>
                    ))}
                </div>
            </div>

            {/* states */}
            {catalog.status === "loading" ? (
                <div className="market-cat-state">
                    <Loader2 className="spin" size={26} />
                    <p>{t("common.loading")}</p>
                </div>
            ) : catalog.status === "error" ? (
                <div className="market-cat-state">
                    <AlertTriangle size={26} />
                    <p>{t("market.errorNote")}</p>
                </div>
            ) : results.length === 0 ? (
                <div className="market-cat-state">
                    <KindGlyph size={26} />
                    <p>{noResultsText}</p>
                </div>
            ) : (
                <div className="market-cat-grid">
                    {results.map((r, i) => (
                        <button
                            key={r.id}
                            type="button"
                            className="market-cat-card"
                            onClick={() => setOpenIndex(i)}
                        >
                            <div className="market-cat-card-top">
                                <div className="market-page__card-imgwrap">
                                    <KindIcon item={r} />
                                </div>
                                <h3 className="market-cat-card-name">{r.name}</h3>
                                {r.type ? (
                                    <span className="market-cat-card-type">{r.type}</span>
                                ) : null}
                            </div>

                            <div className="market-cat-card-price">
                                <span className="market-page__card-label">
                                    {t("market.detailPrice")}
                                </span>
                                <span className="market-cat-card-value">
                                    {r.price === null || r.price === undefined ? (
                                        <>
                                            — <em>{t("market.priceUnavailable")}</em>
                                        </>
                                    ) : (
                                        <>
                                            {fmtPrice(r.price)}
                                            <em> {t("market.detailUnit")}</em>
                                        </>
                                    )}
                                </span>
                            </div>

                            <div className="market-cat-card-meta">
                                <span className="market-page__card-label">
                                    {t("market.detailPack")}
                                </span>
                                <span className="market-cat-card-meta-val">{r.pack || "—"}</span>
                            </div>

                            {kind === "fertilizer" && r.npk ? (
                                <div className="market-cat-card-meta">
                                    <span className="market-page__card-label">
                                        {t("market.detailNpk")}
                                    </span>
                                    <span className="market-cat-card-meta-val">{r.npk}</span>
                                </div>
                            ) : null}

                            {kind === "medicine" && (r.target || r.purpose) ? (
                                <div className="market-cat-card-meta">
                                    <span className="market-page__card-label">
                                        {t("market.detailTarget")}
                                    </span>
                                    <span className="market-cat-card-meta-val">
                                        {r.target || r.purpose}
                                    </span>
                                </div>
                            ) : null}

                            <span className="market-cat-card-cta">{t("market.viewDetails")} →</span>
                        </button>
                    ))}
                </div>
            )}

            {/* floating details window — same recipe as the Rice one */}
            {openIndex >= 0 && results[openIndex] ? (
                <ItemDetailsModal
                    kind={kind}
                    item={results[openIndex]}
                    index={openIndex}
                    count={results.length}
                    onIndexChange={setOpenIndex}
                    onClose={close}
                />
            ) : null}
        </section>
    );
}

/* ==================== exports ==================== */

/** Medicine section. State (query/filter/selection) is per-instance. */
export function MedicineSection() {
    const { t } = useLanguage();
    const labels = {
        all: t("market.filterAll"),
        fungicide: t("market.filterFungicide"),
        insecticide: t("market.filterInsecticide"),
        bactericide: t("market.filterBactericide"),
    };
    return (
        <CatalogSection
            kind="medicine"
            icon={Pill}
            labels={labels}
            filters={medicineFilters}
            searchPlaceholder={t("market.searchPlaceholderMedicine")}
            noResultsText={t("market.noResultsMedicine")}
        />
    );
}

/** Fertilizer section. Fully independent state from Medicine. */
export function FertilizerSection() {
    const { t } = useLanguage();
    const labels = {
        all: t("market.filterAll"),
        nitrogen: t("market.filterNitrogen"),
        phosphate: t("market.filterPhosphate"),
        potash: t("market.filterPotash"),
        complex: t("market.filterComplex"),
        micronutrient: t("market.filterMicronutrient"),
    };
    return (
        <CatalogSection
            kind="fertilizer"
            icon={Sprout}
            labels={labels}
            filters={fertilizerFilters}
            searchPlaceholder={t("market.searchPlaceholderFertilizer")}
            noResultsText={t("market.noResultsFertilizer")}
        />
    );
}

export default MedicineSection;
