import { useMemo, useState } from "react";
import { useLanguage } from "../hooks/useLanguage";
import { useOnboarding } from "../hooks/useOnboarding";
import { fertilizerData } from "../data/mockData";
import { medicineCatalog, fertilizerCatalog } from "../data/marketCatalog";
import { CROP_STAGES } from "../data/cropStages";
import { AREA_UNITS } from "../lib/onboardingService";
import { toAcres } from "../lib/financeCalc";
import {
    FlaskConical,
    Clock,
    TrendingUp,
    CheckCircle2,
    Calculator,
    X,
    RotateCcw,
    AlertTriangle,
} from "lucide-react";
import StatusBadge from "../components/common/StatusBadge";
import "./Fertilizer.css";

const LAND_RATE_RE = /(\d+(?:\.\d+)?)\s*(kg|g|ml|l|litres?|quintal|qtl)\s*\/\s*(acre|hectare)s?/i;

function landRateFromRecord(record) {
    const match = LAND_RATE_RE.exec(record.amount || "");
    if (!match || /[+]/.test(record.product || "")) return null;
    return {
        id: `fert-rate-${record.product.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        kind: "fertilizer",
        name: record.product,
        rate: Number(match[1]),
        rateUnit: match[2].toLowerCase() === "l" || match[2].toLowerCase().startsWith("litre")
            ? "L"
            : match[2].toLowerCase(),
        rateAreaUnit: match[3].toLowerCase(),
        source: "Current fertilizer plan",
    };
}

const verifiedFertilizerRates = fertilizerData.nextApplications
    .map(landRateFromRecord)
    .filter(Boolean);

const normalizeProductName = (name) => String(name || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
const fertilizerProducts = fertilizerCatalog.map((product) => {
    const normalized = normalizeProductName(product.name);
    const rate = verifiedFertilizerRates.find((item) => {
        const candidate = normalizeProductName(item.name);
        return candidate === normalized || candidate.includes(normalized) || normalized.includes(candidate);
    });
    return {
        ...product,
        rate: rate?.rate || null,
        rateUnit: rate?.rateUnit || null,
        rateAreaUnit: rate?.rateAreaUnit || null,
        source: rate?.source || "Current fertilizer records",
    };
});

const verifiedMedicineProducts = medicineCatalog.map((product) => ({
    ...product,
    rate: null,
    rateUnit: null,
    rateAreaUnit: null,
}));

const formatQuantity = (value) => {
    if (!Number.isFinite(value)) return "—";
    const precision = value >= 100 ? 0 : value >= 10 ? 1 : 2;
    return value.toLocaleString(undefined, {
        maximumFractionDigits: precision,
    });
};

function CalculatorPanel({ onClose }) {
    const { farm } = useOnboarding();
    const [inputType, setInputType] = useState("fertilizer");
    const [area, setArea] = useState("");
    const [unit, setUnit] = useState("bigha");
    const [stage, setStage] = useState("tillering");
    const [productId, setProductId] = useState(fertilizerProducts[0]?.id || "");

    const products = inputType === "fertilizer"
        ? fertilizerProducts
        : verifiedMedicineProducts;
    const product = products.find((item) => item.id === productId) || products[0];
    const parcels = farm?.parcels || [];
    const sameUnit = parcels.length > 0 && parcels.every((parcel) => parcel.unit === parcels[0].unit);

    const applySavedArea = (parcelIndex = null) => {
        if (!parcels.length) return;
        const selected = parcelIndex === null
            ? { area: parcels.reduce((sum, parcel) => sum + (Number(parcel.area) || 0), 0), unit: parcels[0].unit }
            : parcels[parcelIndex];
        setArea(String(selected.area || ""));
        setUnit(selected.unit || "bigha");
    };

    const result = useMemo(() => {
        const numericArea = Number(area);
        if (!product || !Number.isFinite(numericArea) || numericArea <= 0) return null;
        if (!product.rate || !product.rateAreaUnit) return { warning: "This product has a concentration or dilution instruction, not a verified land-area rate. Confirm the product label or ask a qualified agricultural expert." };
        const acres = toAcres(numericArea, unit);
        if (acres === null) return { warning: `The app does not define a safe conversion from ${unit} to acres. Enter an Acre or Hectare area, or confirm the conversion with a qualified agricultural expert.` };
        const baseArea = product.rateAreaUnit === "hectare" ? acres / 2.4710538 : acres;
        return {
            quantity: baseArea * product.rate,
            unit: product.rateUnit,
        };
    }, [area, product, unit]);

    const reset = () => {
        setInputType("fertilizer");
        setArea("");
        setUnit("bigha");
        setStage("tillering");
        setProductId(fertilizerProducts[0]?.id || "");
    };

    return (
        <div className="fertilizer-calculator__backdrop" onMouseDown={(event) => {
            if (event.target === event.currentTarget) onClose();
        }}>
            <section className="fertilizer-calculator" role="dialog" aria-modal="true" aria-labelledby="fertilizer-calculator-title">
                <header className="fertilizer-calculator__header">
                    <div>
                        <h2 id="fertilizer-calculator-title">Fertilizer &amp; Medicine Calculator</h2>
                        <p>Calculate the quantity needed for your land.</p>
                    </div>
                    <button type="button" className="fertilizer-calculator__close" onClick={onClose} aria-label="Close calculator"><X size={18} /></button>
                </header>
                <div className="fertilizer-calculator__body">
                    <div className="fertilizer-calculator__field fertilizer-calculator__area">
                        <label htmlFor="calculator-area">Land area</label>
                        <div className="fertilizer-calculator__area-row">
                            <input id="calculator-area" type="number" min="0" step="any" inputMode="decimal" value={area} onChange={(event) => setArea(event.target.value)} placeholder="Enter area" />
                            <select value={unit} onChange={(event) => setUnit(event.target.value)} aria-label="Land area unit">
                                {AREA_UNITS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                            </select>
                        </div>
                        {parcels.length > 0 && (
                            <div className="fertilizer-calculator__saved">
                                <span>Use saved area:</span>
                                {sameUnit && <button type="button" onClick={() => applySavedArea()}>Total farm</button>}
                                {parcels.map((parcel, index) => <button type="button" key={`${parcel.order || index}-${parcel.unit}`} onClick={() => applySavedArea(index)}>Parcel {index + 1}</button>)}
                            </div>
                        )}
                    </div>
                    <div className="fertilizer-calculator__field">
                        <span className="fertilizer-calculator__label">Input type</span>
                        <div className="fertilizer-calculator__segmented">
                            {[
                                ["fertilizer", "Fertilizer"],
                                ["medicine", "Medicine / Pesticide"],
                            ].map(([value, label]) => <button type="button" key={value} className={inputType === value ? "is-active" : ""} onClick={() => {
                                setInputType(value);
                                setProductId(value === "fertilizer" ? fertilizerProducts[0]?.id || "" : verifiedMedicineProducts[0]?.id || "");
                            }}>{label}</button>)}
                        </div>
                    </div>
                    <div className="fertilizer-calculator__field">
                        <label htmlFor="calculator-stage">Rice growth stage</label>
                        <select id="calculator-stage" value={stage} onChange={(event) => setStage(event.target.value)}>
                            {CROP_STAGES.filter((item) => !["transplanting", "maturity", "readyForHarvest"].includes(item.key)).map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
                        </select>
                    </div>
                    <div className="fertilizer-calculator__field">
                        <label htmlFor="calculator-product">{inputType === "fertilizer" ? "Fertilizer" : "Medicine / pesticide"}</label>
                        <select id="calculator-product" value={product?.id || ""} onChange={(event) => setProductId(event.target.value)}>
                            {products.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                        </select>
                    </div>
                    <div className="fertilizer-calculator__rate">
                        <span>Recommended application rate</span>
                        <strong>{product?.rate ? `${product.rate} ${product.rateUnit} / ${product.rateAreaUnit}` : product?.dose || "Not available as a land-area rate"}</strong>
                    </div>
                    {result?.warning ? (
                        <div className="fertilizer-calculator__warning"><AlertTriangle size={16} /><span>{result.warning}</span></div>
                    ) : result ? (
                        <div className="fertilizer-calculator__result">
                            <span>Total required</span>
                            <strong>{formatQuantity(result.quantity)} {result.unit}</strong>
                            <small>{product.name} · {area} {unit} · rate verified from the current plan</small>
                        </div>
                    ) : (
                        <div className="fertilizer-calculator__empty">Enter a positive land area to see the estimate.</div>
                    )}
                    <div className="fertilizer-calculator__actions">
                        <button type="button" className="fertilizer-calculator__reset" onClick={reset}><RotateCcw size={14} /> Reset</button>
                    </div>
                </div>
            </section>
        </div>
    );
}

export default function Fertilizer() {
    const { t } = useLanguage();
    const [calculatorOpen, setCalculatorOpen] = useState(false);

    return (
        <div className="page-container fertilizer-page">
            <section className="fertilizer-page__header section">
                <div>
                    <h1 className="fertilizer-page__title">
                        {t("nav.fertilizer")}
                    </h1>
                    <p className="dashboard__section-subtitle">
                        {t("fertilizer.subtitle")}
                    </p>
                </div>
                <button type="button" className="fertilizer-page__calculator-button" onClick={() => setCalculatorOpen(true)} aria-label="Open fertilizer and medicine calculator" title="Open calculator">
                    <Calculator size={18} />
                </button>
            </section>

            {/* Upcoming Applications */}
            <section className="fertilizer-page__upcoming section">
                <h2 className="fertilizer-page__section-title">
                    {t("fertilizer.nextApplication")}
                </h2>
                <div className="fertilizer-page__upcoming-list">
                    {fertilizerData.nextApplications.map((app, i) => (
                        <div key={i} className="fertilizer-page__upcoming-card">
                            <div className="fertilizer-page__upcoming-top">
                                <div
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 12,
                                    }}
                                >
                                    <div className="fertilizer-page__upcoming-icon">
                                        <FlaskConical size={18} />
                                    </div>
                                    <div>
                                        <span className="fertilizer-page__upcoming-product">
                                            {app.product}
                                        </span>
                                        <span className="fertilizer-page__upcoming-detail">
                                            {app.field} · {t("fertilizer.stage")}:{" "}
                                            <strong>{app.variety}</strong> (
                                            {app.stage} {t("fertilizer.stageSuffix")})
                                        </span>
                                    </div>
                                </div>
                                <StatusBadge
                                    status={
                                        app.priority === "high"
                                            ? "critical"
                                            : "needs-attention"
                                    }
                                />
                            </div>

                            <div className="fertilizer-page__upcoming-grid">
                                <div>
                                    <span className="fertilizer-page__col-lbl">
                                        {t("fertilizer.quantity")}
                                    </span>
                                    <span className="fertilizer-page__col-val">
                                        {app.amount}
                                    </span>
                                </div>
                                <div>
                                    <span className="fertilizer-page__col-lbl">
                                        {t("fertilizer.inputCost")}
                                    </span>
                                    <span
                                        className="fertilizer-page__col-val"
                                        style={{ color: "var(--accent)" }}
                                    >
                                        {app.cost}
                                    </span>
                                </div>
                                <div>
                                    <span className="fertilizer-page__col-lbl">
                                        {t("fertilizer.dueDate")}
                                    </span>
                                    <span className="fertilizer-page__col-val">
                                        <Clock size={12} /> {app.due}
                                    </span>
                                </div>
                            </div>

                            <div className="fertilizer-page__benefit-banner">
                                <TrendingUp size={14} color="var(--success)" />
                                <span className="fertilizer-page__benefit-text">
                                    <strong>{t("fertilizer.yieldGain")}</strong>{" "}
                                    {app.expectedYieldBenefit}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Application History */}
            <section className="fertilizer-page__history section">
                <h2 className="fertilizer-page__section-title">
                    {t("fertilizer.history")}
                </h2>
                <div className="fertilizer-page__history-list">
                    {fertilizerData.history.map((item, i) => (
                        <div key={i} className="fertilizer-page__history-row">
                            <div className="fertilizer-page__history-date">
                                {item.date}
                            </div>
                            <div className="fertilizer-page__history-info">
                                <span className="fertilizer-page__history-product">
                                    {item.product}
                                </span>
                                <span className="fertilizer-page__history-detail">
                                    {item.field} · {item.variety} ·{" "}
                                    {item.amount} ({t("fertilizer.costOf")}: {item.cost})
                                </span>
                            </div>
                            <div className="fertilizer-page__history-benefit">
                                <CheckCircle2
                                    size={13}
                                    color="var(--success)"
                                />
                                <span>{item.benefit}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </section>
            {calculatorOpen && <CalculatorPanel onClose={() => setCalculatorOpen(false)} />}
        </div>
    );
}
