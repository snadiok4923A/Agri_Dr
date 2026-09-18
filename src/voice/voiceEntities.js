/**
 * voiceEntities.js — searchable registries for SPECIFIC entities the voice
 * router can target: diseases (Disease & Medicine library) and market rice
 * varieties (Market Intelligence records).
 *
 * Source of truth is the app's REAL data (diseaseLibrary.js /
 * marketPrices.js) — nothing is invented. Aliases only add the speech
 * variations farmers/recognition engines actually produce.
 *
 * Registries:
 *   DISEASE_ENTITIES    → { id, name, aliases[], match(text) }
 *   MARKET_ENTITIES     → { id, name, aliases[], match(text) }
 *   findDiseaseEntity(text)  → best disease match or null
 *   findMarketEntity(text)   → best market-variety match or null
 *
 * Matching is layered (see matchEntity): whole-utterance > phrase
 * containment > fuzzy single-token (edit distance ≤ 1, length ≥ 5).
 */

import { diseaseLibrary } from "../data/diseaseLibrary";
import { marketPrices } from "../data/marketPrices";
import { normalizeTranscript } from "./voiceNormalize";

/* ------------------------------------------------------------------ *
 * Alias tables — recognition variations + Bengali words farmers use.
 * ------------------------------------------------------------------ */

const DISEASE_ALIASES = {
    "leaf-blast": [
        "leaf blast", "leafe blust", "leaf blust", "rice blast",
        "blast disease", "blast", "ধানের ব্লাস্ট", "ব্লাস্ট",
        "পাতার ব্লাস্ট", "blust",
    ],
    "brown-plant-hopper": [
        "brown plant hopper", "plant hopper", "brown hopper", "hopper",
        "পোকা", "বাদামি পোকা", "hopper bug",
    ],
    "sheath-blight": [
        "sheath blight", "sheeth blight", "শিথ ব্লাইট", "শীথ ব্লাইট",
        "sheath",
    ],
    "brown-spot": [
        "brown spot", "brown spott", "bown spot", "ব্রাউন স্পট",
        "বাদামি দাগ", "brown spots",
    ],
    "false-smut": ["false smut", "smut", "ফলস স্মাট", "শীষের দাগ"],
    bakanae: [
        "bakanae", "foot rot", "bakane", "বাকানে", "চারা পচা",
    ],
    "bacterial-leaf-blight": [
        "bacterial leaf blight", "leaf blight", "blb", "ব্যাকটেরিয়াল লিফ ব্লাইট",
        "পাতা পোড়া",
    ],
    "bacterial-leaf-streak": [
        "bacterial leaf streak", "leaf streak", "bls", "লিফ স্ট্রিক",
    ],
    "rice-tungro": ["tungro", "rice tungro", "টাংরো"],
    "rice-yellow-dwarf": ["yellow dwarf", "rice yellow dwarf", "ইয়েলো ডোয়ার্ফ"],
    ufra: ["ufra", "উড়া", "উফরা"],
    "root-knot": ["root knot", "root-knot", "গল নেমাটোড", "মূল গিঁট"],
    khaira: ["khaira", "খৈরা"],
    "iron-toxicity": ["iron toxicity", "bronzing", "আয়রন টক্সিসিটি", "লোহা বেশি"],
};

/** Extra everyday aliases for market records (speech variations only). */
const MARKET_ALIASES = {
    "basmati-1121": [
        "basmati 1121", "pusa 1121", "basmati", "basmoti", "basomoti",
        "বাসমতি", "বাসমোতি", "বাসমতি ১১২১",
        // Bengali case suffixes attach directly (বাসমতি+র) — add suffixed form
        "বাসমতির", "বাসমোতির",
    ],
    "traditional-basmati": [
        "traditional basmati", "traditional basmoti", "traditional basmati rice",
        "ট্র্যাডিশনাল বাসমতি",
    ],
    "pusa-1509": ["pusa 1509", "basmati 1509", "পুসা ১৫০৯"],
    "pusa-1718": ["pusa 1718", "basmati 1718", "পুসা ১৭১৮"],
    ir64: ["ir 64", "ir-64", "ir64", "ir sixty four", "ir sixty-four", "আই আর ৬৪"],
    swarna: ["swarna", "swarna masuri", "mtu 7029", "স্বর্ণা"],
    "samba-mahsuri": ["samba mahsuri", "bpt 5204", "সাম্বা মাহসুরি"],
    "sona-masuri": ["sona masuri", "sona masoori", "সোনা মসুরি"],
    ponni: ["ponni", "পোন্নি"],
    "pr-126": ["pr 126", "pr126", "পি আর ১২৬"],
    "black-rice": ["black rice", "chak hao", "কালো চাল", "কালো ধান"],
    "red-rice": ["red rice", "red rice matta", "matta", "লাল চাল"],
    gobindobhog: ["gobindobhog", "govindobhog", "গোবিন্দভোগ"],
    kalanamak: ["kalanamak", "কালানামক"],
    joha: ["joha", "জোহা"],
    navara: ["navara", "নাভারা"],
    pokkali: ["pokkali", "পোক্কালি"],
    "bpt-5204": ["bpt 5204"],
    "bangaon-common": ["common paddy", "ordinary paddy", "সাধারণ ধান"],
};

/* ------------------------------------------------------------------ *
 * Layered entity matching (shared by both registries)
 * ------------------------------------------------------------------ */

/** Minimal Levenshtein distance (small strings only). */
function editDistance(a, b) {
    if (a === b) return 0;
    const m = a.length;
    const n = b.length;
    if (Math.abs(m - n) > 2) return 99;
    let prev = Array.from({ length: n + 1 }, (_, i) => i);
    for (let i = 1; i <= m; i++) {
        const cur = [i];
        for (let j = 1; j <= n; j++) {
            cur[j] = Math.min(
                prev[j] + 1,
                cur[j - 1] + 1,
                prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
            );
        }
        prev = cur;
    }
    return prev[n];
}

function escapeRe(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function containsPhrase(haystack, needle) {
    if (!needle) return false;
    if (haystack === needle) return true;
    return new RegExp(`(^|\\s)${escapeRe(needle)}(\\s|$)`).test(haystack);
}

/**
 * matchEntity(text, entity) → score or 0.
 *   3000 whole-utterance · 2000 phrase hit (longer aliases score higher)
 *   · 600 fuzzy single-token (len ≥ 5, distance ≤ 1)
 */
function matchEntity(text, entity) {
    let best = 0;
    let bestAlias = null;
    for (const alias of entity.aliases) {
        if (text === alias) return { score: 3000, alias };
        if (containsPhrase(text, alias)) {
            const score = 2000 + alias.length;
            if (score > best) {
                best = score;
                bestAlias = alias;
            }
        }
    }
    if (!best && !text.includes(" ")) {
        for (const alias of entity.aliases) {
            if (alias.length >= 5 && editDistance(text, alias) <= 1) {
                return { score: 600, alias };
            }
        }
    }
    return { score: best, alias: bestAlias };
}

function findBestEntity(text, entities) {
    let best = null;
    let bestScore = 0;
    let bestAlias = null;
    for (const e of entities) {
        const { score, alias } = matchEntity(text, e);
        if (score > bestScore) {
            best = e;
            bestScore = score;
            bestAlias = alias;
        }
    }
    return best ? { entity: best, score: bestScore, alias: bestAlias } : null;
}

/* ------------------------------------------------------------------ *
 * Registries (built once from the real data)
 * ------------------------------------------------------------------ */

/*
 * Broad aliases — a variety FAMILY, not one specific record (spec §10):
 * "basmati" → show ALL Basmati varieties instead of opening one modal.
 * Every other alias is specific ("traditional basmati", "basmati 1121",
 * "ir 64" …) and opens that record's floating price window.
 */
export const BROAD_MARKET_ALIASES = new Set([
    "basmati", "basmoti", "basomoti", "বাসমতি", "বাসমোতি", "basmotir",
    "বাসমতির",
]);

/** Market filter-chip id each broad alias should activate on the page. */
export const BROAD_MARKET_FILTER = { basmati: "basmati" };

export const DISEASE_ENTITIES = diseaseLibrary.map((d) => ({
    id: d.id,
    name: d.name,
    aliases: [
        ...new Set(
            [d.name, ...(DISEASE_ALIASES[d.id] || [])]
                .map(normalizeTranscript)
                .filter(Boolean)
        ),
    ],
}));

export const MARKET_ENTITIES = marketPrices
    .filter((r) => r.id !== "bangaon-common") // generic record, not voice-worthy
    .map((r) => ({
        id: r.id,
        name: r.name,
        aliases: [
            ...new Set(
                [r.name, ...(MARKET_ALIASES[r.id] || [])]
                    .map(normalizeTranscript)
                    .filter(Boolean)
            ),
        ],
    }));

/** True when the alias that matched is a family name ("basmati"). */
export function isBroadMarketAlias(alias) {
    return BROAD_MARKET_ALIASES.has(normalizeTranscript(alias));
}

export function findDiseaseEntity(text) {
    return findBestEntity(text, DISEASE_ENTITIES);
}

export function findMarketEntity(text) {
    return findBestEntity(text, MARKET_ENTITIES);
}
