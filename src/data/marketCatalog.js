/*
 * marketCatalog.js — Medicine & Fertilizer catalog data layer for the
 * Market Intelligence page (primary category selector: Rice | Medicine |
 * Fertilizer).
 *
 * Rice keeps its ORIGINAL module (marketPrices.js) untouched. This file
 * supplies the other two categories and is built ONLY from data the app
 * already ships — nothing is invented (spec §DATA SOURCE):
 *
 *   Medicine   ← crops[].medicine + medicineCost   (product + pack + recorded cost)
 *                fields[].medicineRequirement      (purpose + quantity + cost)
 *                diseaseLibrary                    (brand, dose, coverage,
 *                                                    target disease, category)
 *   Fertilizer ← fertilizerData.nextApplications   (plan records)
 *                fertilizerData.history            (application log)
 *                fields[].fertilizerRequirement    (quantity + recorded cost)
 *
 * Honesty rules enforced here (spec §Do NOT invent):
 *   · price      = the recorded input cost already shown elsewhere in the
 *                  app — never presented as a live market quote. Absent →
 *                  null and the UI renders the "no price data" state.
 *   · brand      = only when a source string carries one (e.g. "(Confidor)").
 *                  No manufacturer name is ever fabricated.
 *   · dose/use   = copied from the connected disease library only. When a
 *                  product has NO recorded dose, `dose` stays null and the
 *                  UI must show the safety line instead (spec §SAFETY).
 *   · NPK        = only when a source product string states it
 *                  ("Urea (46% N)" → "46% N", "NPK 19:19:19" → "19:19:19").
 *
 * The async entry point is services/marketCatalogService.js (loading /
 * error / stale states) — it is ALSO the single place a future verified
 * endpoint gets wired in (a Supabase Edge Function proxying an official
 * data.gov.in dataset). No API key ever lives in this bundle.
 */

import { diseaseLibrary } from "./diseaseLibrary";
import { crops, fields, fertilizerData } from "./mockData";

/** Provenance label shown on every Medicine / Fertilizer card + modal. */
export const CATALOG_SOURCE = "KrisiVeda farm records";

/* ==================== shared parsing helpers ==================== */

const str = (v) => String(v ?? "").trim();

/** "Imidacloprid 17.8 SL (120 ml)" → "Imidacloprid 17.8 SL". */
const stripParens = (s) => str(s).replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();

/** Match key so crops/fields/diseaseLibrary records of one product merge. */
const keyOf = (s) => stripParens(s).toLowerCase();

/** Pack text looks like "120 ml" / "250 g" / "20 kg". */
const PACK_RE = /^\s*\d[\d.,]*\s*(ml|g|kg|l|quintal|qtl)\b/i;

/** First parenthetical, or null: "…(120 ml)" → pack, "…(Confidor)" → brand. */
const firstParen = (s) => {
    const m = /\(([^)]*)\)/.exec(str(s));
    return m ? m[1].trim() : null;
};

/** rupee-ish cost: 320 → 320, "₹1,120" → 1120, junk → null. */
const parseCost = (v) => {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    const n = Number(str(v).replace(/[^\d.]/g, ""));
    return Number.isFinite(n) && n > 0 ? n : null;
};

/**
 * Active ingredient straight from the product name (presentation-only
 * transform of the source string, same approach diseaseLibrary already uses):
 * "Tricyclazole 75% WP" → "Tricyclazole", "Copper Oxychloride" → unchanged.
 */
const activeIngredient = (name) => {
    const stripped = str(name).replace(
        /\s*[-–]?\s*\d+(?:\.\d+)?\s*%?\s*(SL|WP|SC|EC|WG|WDP|SP|WDG|LS|AI|GB|DB)\b.*$/i,
        ""
    );
    return stripped.trim() || str(name);
};

/** Purpose → short target label: "Bacterial Blight protective" → "Bacterial Blight". */
const targetFromPurpose = (p) =>
    str(p)
        .replace(/\s+(protective|preventive|prevention|treatment|curative|control)$/i, "")
        .trim();

/**
 * Medicine product type, DERIVED from source text only:
 * purpose keywords first, then the linked disease's category.
 */
const medTypeFrom = (purpose, category) => {
    const p = str(purpose);
    if (/bacteri/i.test(p)) return "bactericide";
    if (/hopper|pest|insect|mite|borer|worm/i.test(p)) return "insecticide";
    if (category === "pest") return "insecticide";
    if (category === "fungal") return "fungicide";
    return null;
};

const slug = (s) =>
    stripParens(s)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

/** Search haystack over every farmer-facing field (one string, lowercased). */
const haystack = (...parts) =>
    parts
        .flat()
        .filter(Boolean)
        .join(" · ")
        .toLowerCase();

/* ==================== MEDICINE ==================== */

const medicineMap = new Map();

const ensureMed = (rawName) => {
    const key = keyOf(rawName);
    if (!medicineMap.has(key)) {
        medicineMap.set(key, {
            name: stripParens(rawName),
            brand: null,
            pack: null,
            price: null,
            purpose: null,
            target: null,
            category: null,
            dose: null,
            coverage: null,
            crops: new Set(),
        });
    }
    return medicineMap.get(key);
};

/* 1) crops[] — product string (with pack) + recorded medicine cost + variety. */
for (const c of crops) {
    if (!c.medicine) continue;
    const item = ensureMed(c.medicine);
    const paren = firstParen(c.medicine);
    if (paren && PACK_RE.test(paren)) item.pack = paren;
    const cost = parseCost(c.medicineCost);
    if (item.price == null && cost != null) item.price = cost;
    if (c.variety) item.crops.add(c.variety);
}

/* 2) fields[] — purpose (target use) + quantity + cost + variety. */
for (const f of fields) {
    const r = f.medicineRequirement;
    if (!r || !r.medicine) continue;
    const item = ensureMed(r.medicine);
    if (!item.purpose) item.purpose = str(r.purpose);
    if (!item.pack) item.pack = str(r.quantity) || null;
    const cost = parseCost(r.cost);
    if (item.price == null && cost != null) item.price = cost;
    if (f.variety) item.crops.add(f.variety);
}

/* 3) diseaseLibrary — brand, dose, coverage, target disease, category.
      Dose/coverage are the library's own recorded treatment values: they are
      the ONLY dosage strings this page is allowed to display (spec §SAFETY). */
for (const d of diseaseLibrary) {
    if (!d.medicine) continue;
    const item = ensureMed(d.medicine);
    const paren = firstParen(d.medicine);
    if (paren && !PACK_RE.test(paren) && !item.brand) item.brand = paren;
    if (!item.target) item.target = str(d.name);
    if (!item.category) item.category = str(d.category);
    if (!item.dose && d.dose && !/≈/.test(d.dose)) item.dose = str(d.dose);
    if (!item.coverage && d.coverage && !/≈/.test(d.coverage)) item.coverage = str(d.coverage);
    for (const v of d.commonIn || []) item.crops.add(v);
}

export const medicineCatalog = [...medicineMap.values()].map((it) => {
    const purpose = it.purpose || "";
    const target = it.target || targetFromPurpose(purpose);
    const type = medTypeFrom(purpose, it.category);
    return {
        id: `med-${slug(it.name)}`,
        kind: "medicine",
        name: it.name,
        type,
        brand: it.brand || null,
        active: activeIngredient(it.name),
        pack: it.pack || null,
        price: it.price ?? null,
        target: target || null,
        purpose: purpose || null,
        dose: it.dose || null,
        coverage: it.coverage || null,
        crops: [...it.crops],
        npk: null,
        nutrients: null,
        uses: null,
        source: CATALOG_SOURCE,
        lastUpdated: null,
        searchText: haystack(
            it.name,
            it.brand,
            type,
            activeIngredient(it.name),
            target,
            purpose,
            it.pack,
            [...it.crops]
        ),
    };
});

/* ==================== FERTILIZER ==================== */

/*
 * Group rules run in order — the FIRST match wins, which is why
 * "Zinc Sulfate + Urea" lands on zinc (not urea) and "DAP … + MOP" on dap
 * (not potash). Group labels are presentation names for records that all
 * exist in mockData; no product, price or manufacturer is invented.
 */
const FERT_GROUPS = [
    { test: /npk\s*\d+:\d+/i, id: "npk", name: "NPK 19:19:19", type: "complex" },
    { test: /zinc/i, id: "zinc", name: "Zinc Sulfate + Urea", type: "micronutrient" },
    { test: /potash\s*boost/i, id: "potash-boost", name: "Potash Boost", type: "potash" },
    { test: /^urea/i, id: "urea", name: "Urea", type: "nitrogen" },
    { test: /^dap/i, id: "dap", name: "DAP (Diammonium Phosphate)", type: "phosphate" },
    { test: /mop|potash/i, id: "mop", name: "MOP / Potash", type: "potash" },
];

const groupOf = (product) => FERT_GROUPS.find((g) => g.test.test(str(product))) || null;

/* NPK only when the SOURCE string states it. */
const npkOf = (product) => {
    const s = str(product);
    const ratio = /(\d+:\d+:\d+)/.exec(s);
    if (ratio) return ratio[1];
    const pct = /\(([^)]*\d+\s*%[^)]*)\)/i.exec(s);
    return pct ? pct[1].trim() : null;
};

/* Nutrient wording derived from the stated NPK only ("46% N" → "Nitrogen (N): 46%"). */
const ELEMENTS = { N: "Nitrogen", P: "Phosphorus", K: "Potassium" };
const nutrientsOf = (npk) => {
    if (!npk) return null;
    const ratio = /^(\d+):(\d+):(\d+)$/.exec(npk);
    if (ratio) return `N ${ratio[1]}% · P ${ratio[2]}% · K ${ratio[3]}%`;
    const pct = /^(\d+(?:\.\d+)?)\s*%\s*([A-Za-z]+)$/.exec(npk);
    if (pct) return `${ELEMENTS[pct[2].toUpperCase()] || pct[2]} (${pct[2].toUpperCase()}): ${pct[1]}%`;
    return npk;
};

/* Every fertilizer record the app ships, normalized. `tier` decides which
   record becomes the card's headline price: field plan (0) → schedule (1)
   → application log (2). */
const fertRecords = [];
const pushRecord = (tier, rec) => {
    const g = groupOf(rec.product);
    if (!g) return;
    fertRecords.push({ ...rec, tier, group: g });
};

for (const f of fields) {
    const r = f.fertilizerRequirement;
    if (!r || !r.fertilizer) continue;
    pushRecord(0, {
        product: r.fertilizer,
        qty: str(r.quantity),
        cost: parseCost(r.cost),
        variety: str(f.variety),
        where: str(f.name),
        when: str(r.due),
        note: str(r.expectedBenefit),
    });
}

for (const a of fertilizerData.nextApplications) {
    pushRecord(1, {
        product: str(a.product),
        qty: str(a.amount),
        cost: parseCost(a.cost),
        variety: str(a.variety),
        where: str(a.field),
        when: str(a.stage),
        note: str(a.expectedYieldBenefit),
    });
}

for (const h of fertilizerData.history) {
    pushRecord(2, {
        product: str(h.product),
        qty: str(h.amount),
        cost: parseCost(h.cost),
        variety: str(h.variety),
        where: str(h.field),
        when: str(h.date),
        note: str(h.benefit),
        logged: true,
    });
}

const fertGroups = new Map();
for (const r of fertRecords) {
    if (!fertGroups.has(r.group.id)) fertGroups.set(r.group.id, []);
    fertGroups.get(r.group.id).push(r);
}

export const fertilizerCatalog = [...fertGroups.entries()].map(([id, recs]) => {
    // Primary record = lowest tier; Array.sort is stable, so ties keep source order.
    const ordered = [...recs].sort((a, b) => a.tier - b.tier);
    const primary = ordered[0];
    const npk = ordered.map((r) => npkOf(r.product)).find(Boolean) || null;
    const cropSet = new Set(["Rice"]);
    for (const r of ordered) if (r.variety) cropSet.add(r.variety);
    const uses = ordered.map((r) => ({
        qty: r.qty,
        cost: r.cost,
        where: [r.where, r.when].filter(Boolean).join(" · "),
        note: r.note || null,
    }));

    return {
        id: `fert-${id}`,
        kind: "fertilizer",
        name: primary.group.name,
        type: primary.group.type,
        brand: null, // no brand exists in the source data → never fabricated
        active: null,
        pack: primary.qty || null,
        price: primary.cost ?? null,
        target: null,
        purpose: primary.note || null,
        dose: null,
        coverage: null,
        crops: [...cropSet],
        npk,
        nutrients: nutrientsOf(npk),
        uses,
        source: CATALOG_SOURCE,
        /* Date only exists for application-log records — otherwise null so the
           UI can show the honest "—" instead of a fabricated date. */
        lastUpdated: ordered.filter((r) => r.logged).at(-1)?.when || null,
        searchText: haystack(
            primary.group.name,
            primary.group.type,
            npk,
            nutrientsOf(npk),
            [...cropSet],
            ordered.map((r) => [r.note, r.when, r.where, r.product])
        ),
    };
});

/* ==================== filter chips ====================
 * Same shape as marketFilters ({ id, match }); labels come from the
 * translations (market.filter*). IDs double as the card/modal type label,
 * so `fungicide` renders "Fungicide" everywhere.
 */
export const medicineFilters = [
    { id: "all", match: () => true },
    { id: "fungicide", match: (r) => r.type === "fungicide" },
    { id: "insecticide", match: (r) => r.type === "insecticide" },
    { id: "bactericide", match: (r) => r.type === "bactericide" },
];

export const fertilizerFilters = [
    { id: "all", match: () => true },
    { id: "nitrogen", match: (r) => r.type === "nitrogen" },
    { id: "phosphate", match: (r) => r.type === "phosphate" },
    { id: "potash", match: (r) => r.type === "potash" },
    { id: "complex", match: (r) => r.type === "complex" },
    { id: "micronutrient", match: (r) => r.type === "micronutrient" },
];

export const catalogData = {
    medicine: medicineCatalog,
    fertilizer: fertilizerCatalog,
};
