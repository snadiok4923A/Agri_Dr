/**
 * marketCatalogService — the single place the Market page's Medicine and
 * Fertilizer catalogs are LOADED from (mirrors weatherService: fetch →
 * normalize → cache; the UI never touches the transport).
 *
 * Two sources, one normalized contract:
 *
 *   status:    "loading" | "ready" | "error"   (+ stale flag for cached data)
 *   items:     []                    normalized catalog records
 *   source:    string | null         provenance label for the UI
 *   lastUpdated: string | null       data date, null when the source has none
 *   stale:     boolean               true when showing cached data after a
 *                                    failed refresh (UI shows a stale note)
 *   error:     string | null         message safe to display
 *
 * SOURCE A (currently connected) — the bundled records in
 * src/data/marketCatalog.js, which are themselves derived from the app's own
 * datasets. Resolved through Promise.resolve() so the UI exercises the same
 * loading → ready path as a real request (no fake delay, no fake data).
 *
 * SOURCE B (ready to connect, NOT connected) — a remote endpoint declared as
 *   VITE_CATALOG_ENDPOINT  (e.g. a Supabase Edge Function that proxies an
 *                          official data.gov.in agriculture dataset)
 * When set, fetchCatalog() calls `${endpoint}?kind=medicine|fertilizer`,
 * normalizes the response through the same shape as the bundled records, and
 * falls back to the bundled set with stale=true if the request fails. API
 * keys NEVER live in frontend code — they belong to the Edge Function.
 *
 * Prices: a record's `price` is only ever the value the connected source
 * actually carries (a recorded input cost for the bundled set). Nothing is
 * estimated here. price===null → the UI renders the "price unavailable"
 * state, never a number.
 */

import {
    catalogData,
    CATALOG_SOURCE,
} from "../data/marketCatalog";

const ENDPOINT = import.meta.env.VITE_CATALOG_ENDPOINT || null;

/** Reject malformed remote rows so garbage can never reach the UI. */
const isRecord = (r) =>
    r && typeof r === "object" && typeof r.id === "string" && typeof r.name === "string";

/**
 * Normalize one remote row into the shared catalog shape. Missing fields
 * become null (never a guess), matching the bundled records exactly so the
 * card/modal renderers are source-agnostic.
 */
const normalizeItem = (raw, kind) => {
    const num = (v) =>
        typeof v === "number" && Number.isFinite(v) ? v : null;
    const list = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === "string") : []);
    const txt = (v) => (typeof v === "string" && v.trim() ? v.trim() : null);
    return {
        id: String(raw.id),
        kind,
        name: String(raw.name),
        type: txt(raw.type),
        brand: txt(raw.brand),
        active: txt(raw.active),
        pack: txt(raw.pack),
        price: num(raw.price),
        target: txt(raw.target),
        purpose: txt(raw.purpose),
        dose: txt(raw.dose),
        coverage: txt(raw.coverage),
        crops: list(raw.crops),
        npk: txt(raw.npk),
        nutrients: txt(raw.nutrients),
        uses: Array.isArray(raw.uses) ? raw.uses : null,
        source: txt(raw.source) || txt(raw.sourceName) || null,
        lastUpdated: txt(raw.lastUpdated) || txt(raw.updatedAt),
        searchText:
            typeof raw.searchText === "string" && raw.searchText
                ? raw.searchText
                : String(raw.name).toLowerCase(),
    };
};

/** Bundled path — resolves through the same async contract as Source B. */
function loadBundled(kind) {
    const items = catalogData[kind] || [];
    return Promise.resolve({
        status: items.length ? "ready" : "error",
        items,
        source: items.length ? CATALOG_SOURCE : null,
        lastUpdated: items.length ? items[0].lastUpdated || null : null,
        stale: false,
        error: items.length ? null : "empty-catalog",
    });
}

/** Remote path — Source B (see header). */
async function loadRemote(kind, endpoint) {
    const url = `${endpoint}${endpoint.includes("?") ? "&" : "?"}kind=${encodeURIComponent(kind)}`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const rows = Array.isArray(json) ? json : json?.items;
    if (!Array.isArray(rows)) throw new Error("bad-payload");
    const items = rows.filter(isRecord).map((r) => normalizeItem(r, kind));
    if (!items.length) throw new Error("no-records");
    return {
        status: "ready",
        items,
        source: (json && typeof json.source === "string" && json.source) || null,
        lastUpdated:
            (json && typeof json.lastUpdated === "string" && json.lastUpdated) || null,
        stale: false,
        error: null,
    };
}

/**
 * fetchCatalog — load one category's catalog.
 *
 * @param {"medicine"|"fertilizer"} kind
 * @returns {Promise<{status:string,items:Array,source:string|null,
 *                    lastUpdated:string|null,stale:boolean,error:string|null}>}
 */
export async function fetchCatalog(kind) {
    const valid = kind === "medicine" || kind === "fertilizer";
    if (!valid) {
        return {
            status: "error",
            items: [],
            source: null,
            lastUpdated: null,
            stale: false,
            error: "unknown-category",
        };
    }

    if (!ENDPOINT) return loadBundled(kind);

    try {
        return await loadRemote(kind, ENDPOINT);
    } catch (e) {
        // Remote failed → bundled records are still real app data: serve them
        // marked stale so the UI says so instead of pretending it's live.
        const fallback = await loadBundled(kind);
        if (fallback.status === "ready") {
            return { ...fallback, stale: true, error: String(e?.message || e) };
        }
        return { ...fallback, error: String(e?.message || e) };
    }
}

export default fetchCatalog;
