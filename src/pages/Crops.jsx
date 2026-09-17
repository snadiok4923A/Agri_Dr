import { useState, useEffect } from "react";
import { useLanguage } from "../hooks/useLanguage";
import { riceVarieties, cropFilters } from "../data/riceVarieties";
import { useNavigate } from "react-router-dom";
import {
    Droplets,
    FlaskConical,
    Bug,
    X,
    TrendingUp,
    IndianRupee,
    Sparkles,
    MapPin,
    Sprout,
} from "lucide-react";
import "./Crops.css";

/* Custom rice illustration from the public folder (base-path aware) */
const RICE_LOGO = `${import.meta.env.BASE_URL}crop.svg`;

/* Per-variety photo from the public folder (base-path aware, e.g.
 * "/crops/Pusa_1509.jpg" → "/Agri_Dr/crops/Pusa_1509.jpg" on GH Pages).
 * Falls back to the shared rice illustration if a variety has no image. */
function varietyImage(v) {
    return v?.image
        ? `${import.meta.env.BASE_URL}${v.image.replace(/^\//, "")}`
        : RICE_LOGO;
}

/* ---------------- helpers ---------------- */

const LEVEL_ORDER = { Low: 1, Medium: 2, High: 3 };

function matchesFilter(variety, filterId) {
    if (filterId === "all") return true;
    if (filterId === "low-input") {
        const i = variety.inputs;
        const score =
            LEVEL_ORDER[i.water] + LEVEL_ORDER[i.fertilizer] + LEVEL_ORDER[i.pesticide];
        return score <= 4; // only genuinely light-input varieties
    }
    return variety.tags.includes(filterId);
}

/* One Low/Medium/High input meter (dot scale, no fabricated numbers) */
function InputMeter({ icon: Icon, label, level, tone }) {
    return (
        <div className="crops-page__meter" title={`${label}: ${level}`}>
            <span className="crops-page__meter-ico">
                <Icon size={13} strokeWidth={2} />
            </span>
            <span className="crops-page__meter-label">{label}</span>
            <span className="crops-page__meter-dots" data-level={level.toLowerCase()}>
                {[1, 2, 3].map((n) => (
                    <i key={n} />
                ))}
            </span>
            <span className="crops-page__meter-val">{level}</span>
        </div>
    );
}

/* Compact label/value row used in the modal sections */
function FactRow({ icon: Icon, label, value, tone }) {
    return (
        <div className="crops-page__fact">
            <span className="crops-page__fact-label">
                {Icon && <Icon size={13} />}
                {label}
            </span>
            <span
                className={`crops-page__fact-val${tone ? ` crops-page__fact-val--${tone}` : ""}`}
            >
                {value || "—"}
            </span>
        </div>
    );
}

export default function Crops() {
    const { t } = useLanguage();
    const navigate = useNavigate();
    const [filter, setFilter] = useState("all");
    const [selected, setSelected] = useState(null);

    // Lock body scroll while the modal is open
    useEffect(() => {
        document.body.style.overflow = selected ? "hidden" : "";
        return () => {
            document.body.style.overflow = "";
        };
    }, [selected]);

    // Esc closes the modal
    useEffect(() => {
        if (!selected) return undefined;
        const onKey = (e) => e.key === "Escape" && setSelected(null);
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [selected]);

    const visible = riceVarieties.filter((v) => matchesFilter(v, filter));

    return (
        <div className="page-container crops-page">
            {/* Header */}
            <section className="crops-page__header section">
                <h1 className="crops-page__title">{t("nav.crops")}</h1>
                <p className="crops-page__subtitle">
                    Compare rice varieties by price, cost &amp; profit.
                </p>
            </section>

            {/* Filters */}
            <div className="crops-page__filters" role="tablist" aria-label="Filter varieties">
                {cropFilters.map((f) => (
                    <button
                        key={f.id}
                        type="button"
                        role="tab"
                        aria-selected={filter === f.id}
                        className={`crops-page__filter${filter === f.id ? " crops-page__filter--active" : ""}`}
                        onClick={() => setFilter(f.id)}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            {/* Cards grid */}
            <div className="crops-page__grid">
                {visible.map((v) => (
                    <button
                        key={v.id}
                        type="button"
                        className="crops-page__card"
                        onClick={() => setSelected(v)}
                        aria-haspopup="dialog"
                    >
                        <div className="crops-page__card-top">
                            <span className={`crops-page__card-icon crops-page__card-icon--${v.tone}`}>
                                <img className="crops-page__card-logo" src={varietyImage(v)} alt={v.name} loading="lazy" />
                            </span>
                            <span className={`crops-page__status crops-page__status--${v.statusTone}`}>
                                {v.status}
                            </span>
                        </div>

                        <div className="crops-page__card-names">
                            <h3 className="crops-page__card-name">{v.name}</h3>
                            {v.aka && <span className="crops-page__card-aka">{v.aka}</span>}
                        </div>

                        {/* Price — dominant number */}
                        <div className="crops-page__card-price">
                            <span className="crops-page__price-kicker">PRICE</span>
                            <span className="crops-page__price-val">
                                {v.price ? v.price.label : "—"}
                            </span>
                            <span className="crops-page__price-per">{v.price?.per || "/Q"}</span>
                            {v.price?.note && (
                                <span className="crops-page__price-note">{v.price.note}</span>
                            )}
                        </div>

                        {/* Money rows */}
                        <div className="crops-page__card-money">
                            <div className="crops-page__money-row">
                                <span>Revenue</span>
                                <strong>{v.revenue ? v.revenue.label : "—"}</strong>
                            </div>
                            <div className="crops-page__money-row">
                                <span>Cost</span>
                                <strong>{v.cost ? v.cost.label : "—"}</strong>
                            </div>
                            <div className="crops-page__money-row crops-page__money-row--profit">
                                <span>Profit</span>
                                <strong>
                                    {v.profit ? v.profit.label : "—"}
                                    {v.profit?.per && (
                                        <em className="crops-page__money-per">{v.profit.per}</em>
                                    )}
                                </strong>
                            </div>
                        </div>

                    </button>
                ))}
            </div>

            {visible.length === 0 && (
                <p className="crops-page__empty">No varieties match this filter yet.</p>
            )}

            {/* ==================== Detail Modal ==================== */}
            {selected && (
                <div
                    className="crops-page__overlay"
                    onClick={() => setSelected(null)}
                    role="presentation"
                >
                    <div
                        className="crops-page__modal"
                        role="dialog"
                        aria-modal="true"
                        aria-label={selected.name}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            type="button"
                            className="crops-page__modal-close"
                            onClick={() => setSelected(null)}
                            aria-label="Close"
                        >
                            <X size={18} />
                        </button>

                        {/* Modal header */}
                        <div className="crops-page__modal-head">
                            <span className={`crops-page__card-icon crops-page__card-icon--${selected.tone} crops-page__card-icon--lg`}>
                                <img className="crops-page__card-logo" src={varietyImage(selected)} alt={selected.name} />
                            </span>
                            <div>
                                <h3 className="crops-page__modal-name">
                                    {selected.name}
                                    {selected.aka && (
                                        <span className="crops-page__modal-aka"> · {selected.aka}</span>
                                    )}
                                </h3>
                                <span className={`crops-page__status crops-page__status--${selected.statusTone}`}>
                                    {selected.status}
                                </span>
                            </div>
                        </div>

                        {/* Key numbers strip */}
                        <div className="crops-page__modal-stats">
                            <div className="crops-page__mstat">
                                <span className="crops-page__mstat-label">Price / Q</span>
                                <span className="crops-page__mstat-val">{selected.price?.label || "—"}</span>
                                {selected.price?.note && (
                                    <span className="crops-page__mstat-note">{selected.price.note}</span>
                                )}
                            </div>
                            <div className="crops-page__mstat">
                                <span className="crops-page__mstat-label">Yield</span>
                                <span className="crops-page__mstat-val">{selected.yieldQ?.label || "—"}</span>
                                <span className="crops-page__mstat-note">{selected.yieldQ?.per || ""}</span>
                            </div>
                            <div className="crops-page__mstat">
                                <span className="crops-page__mstat-label">Cost</span>
                                <span className="crops-page__mstat-val">{selected.cost?.label || "—"}</span>
                                <span className="crops-page__mstat-note">{selected.cost?.per || ""}</span>
                            </div>
                            <div className="crops-page__mstat">
                                <span className="crops-page__mstat-label">Revenue</span>
                                <span className="crops-page__mstat-val">{selected.revenue?.label || "—"}</span>
                                <span className="crops-page__mstat-note">{selected.revenue?.per || ""}</span>
                            </div>
                            <div className="crops-page__mstat crops-page__mstat--profit">
                                <span className="crops-page__mstat-label">Profit</span>
                                <span className="crops-page__mstat-val">{selected.profit?.label || "—"}</span>
                                <span className="crops-page__mstat-note">{selected.profit?.per || ""}</span>
                            </div>
                        </div>

                        {/* Growing */}
                        <div className="crops-page__msection">
                            <h4 className="crops-page__msection-title">
                                <Sprout size={15} /> Growing
                            </h4>
                            <FactRow icon={MapPin} label="Region" value={selected.region} />
                            <FactRow label="Soil" value={selected.soil || "—"} />
                            <FactRow label="Duration" value={selected.duration ? `${selected.duration.label}${selected.duration.note ? ` · ${selected.duration.note}` : ""}` : "—"} />
                            <FactRow label="Method" value={selected.method} />
                        </div>

                        {/* Inputs */}
                        <div className="crops-page__msection">
                            <h4 className="crops-page__msection-title">
                                <Droplets size={15} /> Inputs
                            </h4>
                            <div className="crops-page__modal-inputs">
                                <InputMeter icon={Droplets} label="Water" level={selected.inputs.water} />
                                <InputMeter icon={FlaskConical} label="Fertilizer" level={selected.inputs.fertilizer} />
                                <InputMeter icon={Bug} label="Pesticide" level={selected.inputs.pesticide} />
                            </div>
                        </div>

                        {/* Market */}
                        <div className="crops-page__msection">
                            <h4 className="crops-page__msection-title">
                                <TrendingUp size={15} /> Market
                            </h4>
                            <FactRow icon={IndianRupee} label="Demand" value={selected.market.demand} />
                            <FactRow label="Price position" value={selected.market.pricePos} />
                            <FactRow
                                label="Profit potential"
                                value={selected.market.profit}
                                tone="gold"
                            />
                        </div>

                        {/* Ask AI footer */}
                        <button
                            type="button"
                            className="crops-page__ask-ai"
                            onClick={() => navigate("/ai-doctor")}
                        >
                            <span>
                                <strong>Have a question?</strong> Ask AI
                            </span>
                            <Sparkles size={16} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
