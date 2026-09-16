/**
 * voiceCommandParser.js — pure, deterministic, rule-based intent matching.
 * NO AI, NO API: speech text in → { intent, confidence, entity } out.
 *
 * Pipeline (per the spec):
 *   speech text → normalizeTranscript() → alias normalization →
 *   priority matching → { intent, confidence, originalText, entity }
 *
 * Matching priority:
 *   1. exact phrase match
 *   2. specific multi-word phrases (longest first)
 *   3. entity + action combos (variety names, languages)
 *   4. general commands
 *   5. single-keyword fallback (conservative)
 */

import {
    VOICE_COMMANDS,
    LANGUAGE_ALIASES,
    getVarietyAliases,
} from "./voiceCommands";

/* ------------------------------------------------------------------ *
 * Normalization
 * ------------------------------------------------------------------ */

/**
 * Words the browser's recognizers commonly garble. Mapping them early keeps
 * the phrase tables small and match rates high — still 100% rule-based.
 */
const TOKEN_FIXES = new Map([
    // action verbs (SR variants + Hinglish spelling)
    ["dakhao", "dekhaao"],
    ["dekhao", "dekhaao"],
    ["dekha", "dekhaao"],
    ["dekho", "dekhaao"],
    ["dikha", "dekhaao"],
    ["dikhaao", "dekhaao"],
    ["dekh", "dekhaao"],
    ["khol", "kholo"],
    ["kholo", "kholo"],
    ["kholo", "kholo"],
    ["khol", "kholo"],
    ["kardo", "karo"],
    ["koro", "karo"],
    ["koru", "karo"],
    ["bondho", "band"],
    ["bandh", "band"],
    ["bondh", "band"],
    ["chalu", "chalu"],
    ["chaalu", "chalu"],
    ["suru", "chalu"],
    ["shuru", "chalu"],
    // nouns
    ["vaj", "voice"],
    ["vois", "voice"],
    ["waiz", "voice"],
    ["market", "market"],
    ["bazar", "market"],
    ["bajaar", "market"],
    ["moshom", "weather"],
    ["mausam", "weather"],
    ["abohawa", "weather"],
    ["abohawaa", "weather"],
    ["aabhawa", "weather"],
    ["dhaan", "rice"],
    ["dhan", "rice"],
    ["chaser", "crop"],
    ["fosol", "crop"],
    ["phasal", "crop"],
    ["jomi", "land"],
    ["jameen", "land"],
    ["zameen", "land"],
    ["ghor", "farm"],
    ["khet", "farm"],
    ["kheth", "farm"],
    ["sar", "fertilizer"],
    ["khaad", "fertilizer"],
    ["khad", "fertilizer"],
    ["oshud", "medicine"],
    ["ausadh", "medicine"],
    ["rog", "disease"],
    ["roag", "disease"],
    ["roog", "disease"],
    ["matha", "soil"],
    ["mati", "soil"],
    ["mitti", "soil"],
    ["labh", "profit"],
    ["laabh", "profit"],
    ["khoroch", "cost"],
    ["kharch", "cost"],
    ["kharcha", "cost"],
    ["dam", "price"],
    ["daam", "price"],
    ["koto", "koto"],
    ["kotha", "koto"],
    ["kitna", "koto"],
    ["kitne", "koto"],
    ["jomir", "land"],
    ["ghorer", "farm"],
    ["dhaner", "rice"],
    ["bajarer", "market"],
    ["mathar", "soil"],
    ["arer", "of"],
    ["er", "of"],
    ["r", "of"],
    ["ta", "the"],
    ["ti", "the"],
]);

/** Words with no matching value — dropped entirely during normalization. */
const NOISE_TOKENS = new Set(["the", "a", "an", "of", "to", "please", "amake", "kore"]);

/** Collapse letter→digit spacing so "ir 64" == "ir64". Digit→letter spacing
 * ("64 price") must stay intact — only letters-before-digits collapse. */
function collapseAlnumSpaces(text) {
    return text.replace(/([a-z])\s+(?=\d)/g, "$1");
}

/**
 * normalizeTranscript — lowercase, strip punctuation, collapse spaces,
 * apply token fixes. This is the ONLY entry point for raw speech text.
 */
export function normalizeTranscript(raw) {
    let text = String(raw || "")
        .toLowerCase()
        .trim()
        // remove punctuation (keep letters + COMBINING MARKS + digits + spaces;
        // \p{M} is essential for Bengali/Hindi — vowel signs are marks, not letters)
        .replace(/[^\p{L}\p{M}\p{N}\s]/gu, " ")
        .replace(/\s+/g, " ")
        .trim();

    if (!text) return "";

    // Latin-script token fixes (Bengali script passes through untouched)
    text = text
        .split(" ")
        .map((tok) => TOKEN_FIXES.get(tok) ?? tok)
        .filter((tok) => tok && !NOISE_TOKENS.has(tok))
        .join(" ");

    return collapseAlnumSpaces(text);
}

/** Apply the same normalization to a stored alias/phrase at build time. */
const norm = normalizeTranscript;

/** Whole-word/phrase containment (safe against partial-word hits). */
function containsPhrase(haystack, needle) {
    if (!needle) return false;
    if (haystack === needle) return true;
    return new RegExp(`(^|\\s)${escapeRe(needle)}(\\s|$)`).test(haystack);
}

function escapeRe(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Minimal Levenshtein — used ONLY as a tiny, conservative fuzzy fallback. */
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

/* ------------------------------------------------------------------ *
 * Parser
 * ------------------------------------------------------------------ */

/** Language-change action words — a bare language name alone is NOT enough
 * unless it is the ENTIRE utterance (spec: "English" alone is a command). */
const LANG_ACTION_WORDS = [
    "karo", "koro", "chalu", "language", "bhasha", "basa", "set", "change",
    "করো", "ভাষা",
];

/** Words that turn a variety mention into a MARKET (price) intent. */
const PRICE_WORDS = ["price", "koto", "rate", "দাম", "কত"];

/** Words that turn a variety mention into an OPEN-DETAILS intent. */
const DETAIL_WORDS = [
    "dekhaao", "show", "open", "kholo", "details", "detail", "info",
    "দেখাও", "খোলো",
];

/**
 * parseVoiceCommand(transcript) →
 *   { intent, confidence, originalText, entity, matchedPhrase } | null
 *
 * intent: string constant (e.g. "OPEN_MARKET")
 * confidence: "high" (exact/long phrase) | "medium" (short/fuzzy)
 * entity: { type: "variety", id, name } | { type: "language", code } | null
 */
export function parseVoiceCommand(rawTranscript) {
    const originalText = String(rawTranscript || "").trim();
    const text = normalizeTranscript(originalText);
    if (!text) return null;

    let best = null; // { score, intent, confidence, entity, matchedPhrase, feedback }

    const consider = (
        score,
        intent,
        confidence,
        entity,
        matchedPhrase,
        feedback,
    ) => {
        if (!best || score > best.score) {
            best = { score, intent, confidence, entity, matchedPhrase, feedback };
        }
    };

    /* ---- 1+2. Static command table (ordered: voice control → specific → general) ---- */
    for (const cmd of VOICE_COMMANDS) {
        for (const phrase of cmd.phrases) {
            const p = norm(phrase);
            if (!p) continue;
            if (text === p) {
                // exact utterance — unbeatable
                consider(10000, cmd.intent, "high", null, phrase, cmd.feedback);
            } else if (containsPhrase(text, p)) {
                // longer phrases beat shorter ones (specificity priority)
                const words = p.split(" ").length;
                consider(
                    words * 100 + p.length,
                    cmd.intent,
                    words >= 2 ? "high" : "medium",
                    null,
                    phrase,
                    cmd.feedback,
                );
            }
        }
    }

    /* ---- 3a. Variety entities (from the app's REAL data) ---- */
    const varieties = getVarietyAliases();
    for (const v of varieties) {
        for (const alias of v.aliases) {
            const a = norm(alias);
            if (!a || !containsPhrase(text, a)) continue;

            const hasPrice = PRICE_WORDS.some((w) => containsPhrase(text, w));
            const hasDetail = DETAIL_WORDS.some((w) => containsPhrase(text, w));
            const isWholeUtterance = text === a;

            if (hasPrice) {
                // "basmati price", "ir64 er dam koto" → market page
                consider(9000, "OPEN_MARKET", "high", { type: "variety", id: v.id, name: v.name }, alias, "Opening Market Intelligence…");
            } else if (hasDetail || isWholeUtterance) {
                // "show IR64", "swarna dekhaao", "black rice" → variety details
                consider(8500, "OPEN_RICE_VARIETY_DETAILS", "high", { type: "variety", id: v.id, name: v.name }, alias, null);
            }
            // a bare variety name buried inside an unrelated sentence does NOT match
            break;
        }
    }

    /* ---- 3b. Language entities ---- */
    for (const lang of LANGUAGE_ALIASES) {
        for (const alias of lang.aliases) {
            const a = norm(alias);
            if (!a || !containsPhrase(text, a)) continue;
            const isWhole = text === a;
            const hasAction = LANG_ACTION_WORDS.some((w) => containsPhrase(text, w));
            if (isWhole || hasAction) {
                consider(8000, "SET_LANGUAGE", "high", { type: "language", code: lang.code }, alias, null);
            }
            break;
        }
    }

    /* ---- 5. Conservative single-keyword fuzzy fallback ---- */
    // Only fires when nothing matched above, the utterance is a SINGLE token,
    // and the token is within edit distance 1 of a distinctive keyword.
    if (!best) {
        const tokens = text.split(" ");
        if (tokens.length === 1 && tokens[0].length >= 4) {
            const token = tokens[0];
            const fallbacks = [
                ["market", "OPEN_MARKET"],
                ["weather", "OPEN_WEATHER"],
                ["insights", "OPEN_INSIGHTS"],
                ["settings", "OPEN_SETTINGS"],
                ["dashboard", "OPEN_OVERVIEW"],
                ["doctor", "OPEN_AI_DOCTOR"],
                ["fertilizer", "OPEN_FERTILIZER_PLAN"],
                ["humidity", "SHOW_HUMIDITY"],
                ["temperature", "SHOW_TEMPERATURE"],
            ];
            for (const [kw, intent] of fallbacks) {
                if (editDistance(token, kw) <= 1) {
                    consider(100, intent, "medium", null, token);
                    break;
                }
            }
        }
    }

    if (!best) return null;

    return {
        intent: best.intent,
        confidence: best.confidence,
        originalText,
        entity: best.entity,
        matchedPhrase: best.matchedPhrase,
        feedback: best.feedback,
    };
}
