/*
 * financeCalc.js — the Profit & Cost (খরচ ও লাভ) calculation layer.
 *
 * SINGLE SOURCE OF TRUTH: every acre, ton and rupee the Finance page
 * shows is derived from `useOnboarding().farm.parcels` — the exact same
 * survey rows My Farm renders (Edit Farm → completeOnboarding → shared
 * context). Nothing farm-specific is stored or cached in this module.
 *
 * Per-field math (spec §5):
 *     cost    = per-acre cost × acres        revenue = yield × price
 *     profit  = revenue − cost               farm totals = Σ of field rows
 * Same variety in several fields → each field priced with the same
 * rates, so variety areas combine correctly (spec §4/§6).
 *
 * Rate datasets (project data used as ESTIMATE defaults — never
 * user-specific numbers):
 *   • marketPrices → mandi price ₹/quintal per variety
 *   • riceVarieties    → per-variety agronomy economics + COMMON_ECON default
 *   • mockData.crops   → demo crop records' per-acre yield & cost
 *   • financeData      → cost-category & monthly-season SHAPES only: the
 *     proportions are reused, but every amount is re-scaled to the user's
 *     own calculated production cost, so the category total always equals
 *     the displayed total cost (spec §8) and the monthly chart stays
 *     consistent with it (spec §9).
 *
 * AREA UNITS: acre (×1) and hectare (×2.4710536) are convertible — the
 * hectare factor is exact SI. The regional units bigha/katha/decimal
 * have no conversion anywhere in this app (My Farm deliberately does not
 * invent one either), so such parcels keep their area in the table but
 * contribute "—" economics instead of fabricated numbers.
 */

import { crops, financeData } from "../data/mockData";
import { riceVarieties, COMMON_ECON } from "../data/riceVarieties";
import { marketPrices } from "../data/marketPrices";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/** "Pusa 1509" / "IR-64" / "BPT 5204" → comparable join key. */
const norm = (s) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");

const round1 = (v) => Math.round(v * 10) / 10;
const round2 = (v) => Math.round(v * 100) / 100;

/**
 * Parse a dataset label into one number (ranges → midpoint, "K" → ×1,000):
 *   "≈₹2,300" → 2300        "₹3,500–4,500+" → 4000
 *   "₹17.5–24.5K" → 21000   "20–25" (Q/acre) → 22.5
 * Returns null when the label carries no number.
 */
export function parseRateLabel(label) {
    if (!label) return null;
    const text = String(label);
    const nums = (text.match(/\d[\d,]*(?:\.\d+)?/g) || [])
        .map((n) => parseFloat(n.replace(/,/g, "")))
        .filter((n) => Number.isFinite(n));
    if (!nums.length) return null;
    const value = nums.length > 1 ? (nums[0] + nums[1]) / 2 : nums[0];
    return /[0-9]\s*k\b/i.test(text) ? value * 1000 : value;
}

/** Exact SI conversion; null for regional units with no app-wide factor. */
const ACRES_PER_HECTARE = 10000 / 4046.8564224; // = 2.4710538…

export function toAcres(area, unit) {
    const a = Number(area);
    if (!Number.isFinite(a) || a <= 0) return null;
    if (!unit || unit === "acre") return a;
    if (unit === "hectare") return a * ACRES_PER_HECTARE;
    return null; // bigha / katha / decimal — no invented conversion
}

/* ------------------------------------------------------------------ */
/* Static indexes over the project's existing variety/price datasets    */
/* ------------------------------------------------------------------ */

const marketPriceByName = new Map();
const marketPriceByImage = new Map();
for (const r of marketPrices) {
    const key = norm(r.name);
    if (key && !marketPriceByName.has(key)) marketPriceByName.set(key, r.marketPrice);
    // Same illustration = same variety across datasets (documented in
    // marketPrices.js) — this is what joins "Pusa 1121" ↔ "Basmati 1121".
    if (r.image && !marketPriceByImage.has(r.image)) marketPriceByImage.set(r.image, r.marketPrice);
}

const varietyIndex = new Map(); // norm(name) | norm(aka) → riceVarieties record
for (const v of riceVarieties) {
    if (!varietyIndex.has(norm(v.name))) varietyIndex.set(norm(v.name), v);
    if (v.aka && !varietyIndex.has(norm(v.aka))) varietyIndex.set(norm(v.aka), v);
}

const demoCropIndex = new Map(); // norm(variety) → mockData.crops record
for (const c of crops) demoCropIndex.set(norm(c.variety), c);
const BASMATI_DEMO = demoCropIndex.get(norm("Basmati")) || null;

/* Cost-category and monthly-season SHAPES from the project's existing
   finance dataset — proportions only; amounts are re-derived below. */
const COST_MODEL = (financeData.expenses?.breakdown || []).map((c) => ({
    category: c.category,
    color: c.color,
    source: Number(c.amount) || 0,
}));
const MONTH_MODEL = (financeData.monthlyExpenses || []).map((m) => ({
    month: m.month,
    source: Number(m.amount) || 0,
}));

/* ------------------------------------------------------------------ */
/* Per-variety rates                                                   */
/* ------------------------------------------------------------------ */

/**
 * Rate bundle for one variety, resolved from project datasets only:
 *   1. demo crop record (exact name / aka / basmati group) → its per-acre
 *      yield & cost, plus the mandi price for that variety
 *   2. riceVarieties economics labels (rice.txt) for that variety
 *   3. COMMON_ECON — the project's configured common-paddy default,
 *      flagged as "default" (an ESTIMATE, never a user-specific value)
 */
function resolveRates(varietyName) {
    const key = norm(varietyName);
    const rv = varietyIndex.get(key) || null;

    const demo =
        (demoCropIndex.get(key) && demoCropIndex.get(key).area > 0
            ? demoCropIndex.get(key)
            : null) ||
        (rv?.aka && demoCropIndex.get(norm(rv.aka))?.area > 0
            ? demoCropIndex.get(norm(rv.aka))
            : null) ||
        (rv?.group === "basmati" && BASMATI_DEMO ? BASMATI_DEMO : null) ||
        null;

    const price =
        marketPriceByName.get(key) ??
        (rv?.aka ? marketPriceByName.get(norm(rv.aka)) : undefined) ??
        (rv?.image ? marketPriceByImage.get(rv.image) : undefined) ??
        parseRateLabel(rv?.price?.label) ??
        parseRateLabel(COMMON_ECON.price.label);

    /* Normalized to TONS/acre: demo crops store tons, the riceVarieties
       labels are in Q/acre ("20–25 Q/acre") → ÷10. */
    let yieldPerAcreTons = null;
    if (demo) {
        yieldPerAcreTons = demo.expectedYield / demo.area;
    } else {
        const perAcreQ =
            parseRateLabel(rv?.yieldQ?.label) ??
            parseRateLabel(COMMON_ECON.yieldQ.label);
        if (perAcreQ !== null) yieldPerAcreTons = perAcreQ / 10;
    }

    const costPerAcre = demo
        ? demo.estimatedCost / demo.area
        : parseRateLabel(rv?.cost?.label) ?? parseRateLabel(COMMON_ECON.cost.label);

    return {
        pricePerQ: price ?? null,
        yieldPerAcreTons: yieldPerAcreTons ?? null,
        costPerAcre: costPerAcre ?? null,
        source: demo ? "demo" : rv ? "variety" : "default",
    };
}

/* ------------------------------------------------------------------ */
/* Proportional split — guarantees the parts sum back to the total      */
/* ------------------------------------------------------------------ */

function splitProportional(total, items) {
    const sourceSum = items.reduce((s, it) => s + it.source, 0);
    if (!items.length || !sourceSum || !total) {
        return items.map((it) => ({ ...it, amount: 0 }));
    }
    const amounts = items.map((it) => Math.round((total * it.source) / sourceSum));
    // Absorb rounding drift into the largest part so Σ parts === total.
    let largest = 0;
    amounts.forEach((v, i) => {
        if (v > amounts[largest]) largest = i;
    });
    amounts[largest] += total - amounts.reduce((s, v) => s + v, 0);
    return items.map((it, i) => ({ ...it, amount: amounts[i] }));
}

/* ------------------------------------------------------------------ */
/* Main calculation                                                    */
/* ------------------------------------------------------------------ */

/**
 * Derive the whole Finance page from the My Farm survey parcels.
 *
 * @param {Array} parcels useOnboarding().farm.parcels
 *   ({ area, unit, riceVariety, stage, order })
 * @returns {{
 *   rows: Array,          // one row per actual My Farm field
 *   totals: object,       // farm-wide acres / yield / cost / revenue / profit
 *   costCategories: Array,// pie data ({ category, color, amount })
 *   monthly: Array,       // bar data ({ month, amount })
 *   hasEconomics: boolean // at least one field could be priced
 * }}
 */
export function computeFarmFinance(parcels) {
    const list = Array.isArray(parcels) ? parcels : [];

    const rows = list.map((parcel, index) => {
        const area = Number(parcel?.area) || 0;
        const unit = parcel?.unit || "acre";
        const acres = toAcres(area, unit);
        const row = {
            index,
            variety: parcel?.riceVariety || "",
            area,
            unit,
            stage: parcel?.stage || "",
            acres,
            yieldTons: null,
            cost: null,
            revenue: null,
            profit: null,
            margin: null,
            rateSource: null,
        };
        if (acres === null) return row; // unconvertible unit → area only

        const rates = resolveRates(row.variety);
        row.rateSource = rates.source;

        if (rates.yieldPerAcreTons !== null) {
            row.yieldTons = round2(rates.yieldPerAcreTons * acres);
        }
        if (rates.costPerAcre !== null) {
            row.cost = Math.round(rates.costPerAcre * acres);
        }
        if (row.yieldTons !== null && rates.pricePerQ !== null) {
            row.revenue = Math.round(row.yieldTons * 10 * rates.pricePerQ);
        }
        if (row.revenue !== null && row.cost !== null) {
            row.profit = row.revenue - row.cost;
            row.margin =
                row.revenue > 0 ? round1((row.profit / row.revenue) * 100) : null;
        }
        return row;
    });

    const totals = rows.reduce(
        (acc, r) => {
            acc.acres += r.acres || 0;
            acc.yieldTons += r.yieldTons || 0;
            acc.cost += r.cost || 0;
            acc.revenue += r.revenue || 0;
            return acc;
        },
        { acres: 0, yieldTons: 0, cost: 0, revenue: 0 },
    );
    totals.acres = round2(totals.acres);
    totals.yieldTons = round2(totals.yieldTons);
    // Spec §5: netProfit = expectedRevenue − totalCost (always consistent
    // with the two summary cards above it).
    totals.profit = totals.revenue - totals.cost;
    totals.margin =
        totals.revenue > 0 ? round1((totals.profit / totals.revenue) * 100) : null;
    totals.costPerAcre =
        totals.acres > 0 ? Math.round(totals.cost / totals.acres) : null;

    return {
        rows,
        totals,
        costCategories: splitProportional(totals.cost, COST_MODEL),
        monthly: splitProportional(totals.cost, MONTH_MODEL),
        hasEconomics: rows.some((r) => r.acres !== null),
    };
}
