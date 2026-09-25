/**
 * voiceCommandParser.js — pure, deterministic, rule-based intent matching.
 * NO AI, NO API: speech text in → { intent, confidence, entity } out.
 *
 * Pipeline (per the spec):
 *   speech text → normalizeTranscript() → layered matching →
 *   { intent, confidence, originalText, entity, matchedPhrase }
 *
 * Matching priority (§22/§23):
 *   1. CLOSE (boosted — "close" must always mean close)
 *   2. exact phrase match
 *   3. specific multi-word phrases (longest first)
 *   4. SPECIFIC entity: disease / market variety (open its floating window)
 *   5. broad variety family ("basmati" → filtered Market page)
 *   6. language change
 *   7. general commands
 *   8. single-keyword fallback (fuzzy, conservative)
 */

import {
    VOICE_COMMANDS,
    LANGUAGE_ALIASES,
} from "./voiceCommands";
import {
    findDiseaseEntity,
    findMarketEntity,
    isBroadMarketAlias,
} from "./voiceEntities";
import { normalizeTranscript } from "./voiceNormalize";

export { normalizeTranscript };

/* ------------------------------------------------------------------ *
 * Normalization lives in voiceNormalize.js (shared with voiceEntities.js).
 * ------------------------------------------------------------------ */



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
 * §5 — bare-word registry: one meaningful word IS the command.
 * A bare word only matches when it is the ENTIRE utterance, so a word
 * inside a longer sentence can never trigger navigation on its own.
 * ------------------------------------------------------------------ */
const BARE_WORDS = [
    ["weather", "OPEN_WEATHER", 95],
    ["market", "OPEN_MARKET", 95],
    ["disease", "OPEN_DISEASE_MEDICINE", 95],
    ["doctor", "OPEN_AI_DOCTOR", 95],
    ["farm", "OPEN_MY_FARM", 92],
    ["fertilizer", "OPEN_FERTILIZER_PLAN", 95],
    ["profit", "OPEN_COST_PROFIT", 95],
    ["cost", "OPEN_COST_PROFIT", 92],
    ["insights", "OPEN_INSIGHTS", 95],
    ["varieties", "OPEN_RICE_VARIETIES", 92],
    ["settings", "OPEN_SETTINGS", 95],
    ["rice", "OPEN_RICE_VARIETIES", 90],
];

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
 * entity: { type: "variety", id, name, broad } |
 *         { type: "disease", id, name } |
 *         { type: "language", code } | null
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

    /* ---- 1+2. Static command table (CLOSE sits first in the table) ---- */
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

    /* ---- 4a. SPECIFIC disease ("leaf blast", "leafe blust ta ki") ---- */
    const diseaseHit = findDiseaseEntity(text);
    if (diseaseHit) {
        const { entity, score, alias } = diseaseHit;
        consider(
            9000 + score,
            "OPEN_DISEASE_DETAIL",
            "high",
            { type: "disease", id: entity.id, name: entity.name },
            alias,
            `Opening ${entity.name}…`,
        );
    }

    /* ---- 4b/5. Market variety ("traditional basmati price") ---- */
    const marketHit = findMarketEntity(text);
    if (marketHit) {
        const { entity, score, alias } = marketHit;
        const hasPrice = PRICE_WORDS.some((w) => containsPhrase(text, w));
        const hasDetail = DETAIL_WORDS.some((w) => containsPhrase(text, w));
        const isWholeUtterance = text === norm(alias);
        const broad = isBroadMarketAlias(alias);

        if (broad) {
            // family name ("basmati", "basmotir dam koto") → filtered market
            consider(
                9000 + score,
                "OPEN_MARKET_FILTERED",
                "high",
                { type: "variety", id: entity.id, name: entity.name, broad: true },
                alias,
                "Opening Market Intelligence…",
            );
        } else if (hasPrice || hasDetail || isWholeUtterance) {
            // specific variety → Market page + its floating price window
            consider(
                9000 + score,
                "OPEN_MARKET_VARIETY",
                "high",
                { type: "variety", id: entity.id, name: entity.name },
                alias,
                `Opening ${entity.name}…`,
            );
        } else if (text.split(" ").length === 1) {
            // bare specific variety name ("swarna") → its price window
            consider(
                8500 + score,
                "OPEN_MARKET_VARIETY",
                "high",
                { type: "variety", id: entity.id, name: entity.name },
                alias,
                `Opening ${entity.name}…`,
            );
        }
        // a variety name buried in an unrelated sentence does NOT match
    }

    /* ---- 6. Language entities ---- */
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

    /* ---- 8. Bare single-word utterances (§5) + conservative fuzzy ---- */
    if (!best) {
        const tokens = text.split(" ");
        if (tokens.length === 1) {
            const tok = tokens[0];
            for (const [w, intent, score] of BARE_WORDS) {
                if (text === w) {
                    consider(score * 100, intent, "high", null, w, null);
                    break;
                }
            }
            if (!best && tok.length >= 4) {
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
                    if (editDistance(tok, kw) <= 1) {
                        consider(100, intent, "medium", null, tok);
                        break;
                    }
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
