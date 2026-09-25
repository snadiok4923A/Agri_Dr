/**
 * voiceNormalize.js — transcript normalization shared by the parser and the
 * entity registries. Kept in its own module so both can import it without a
 * circular dependency (the registries normalize aliases at module-load time).
 *
 * Pipeline: lowercase → strip punctuation (keep \p{M} for Bengali/Hindi
 * vowel signs) → collapse spaces → token fixes → digit-spacing collapse.
 */

/**
 * Words the browser's recognizers commonly garble. Mapping them early keeps
 * the phrase tables small and match rates high — still 100% rule-based.
 */
export const TOKEN_FIXES = new Map([
    // action verbs (SR variants + Hinglish spelling)
    ["dakhao", "dekhaao"],
    ["dekhao", "dekhaao"],
    ["dekha", "dekhaao"],
    ["dekho", "dekhaao"],
    ["dikha", "dekhaao"],
    ["dikhaao", "dekhaao"],
    ["dekh", "dekhaao"],
    ["khol", "kholo"],
    ["kardo", "karo"],
    ["koro", "karo"],
    ["koru", "karo"],
    ["bondho", "band"],
    ["bandh", "band"],
    ["bondh", "band"],
    ["chaalu", "chalu"],
    ["suru", "chalu"],
    ["shuru", "chalu"],
    // nouns
    ["vaj", "voice"],
    ["vois", "voice"],
    ["waiz", "voice"],
    // spelling variations (§4/§7: weatther / wether / whether → weather)
    ["weatther", "weather"],
    ["wether", "weather"],
    ["whether", "weather"],
    ["wedder", "weather"],
    ["wheather", "weather"],
    // Bengali-style possessives of variety names (§37: "basmotir dam koto")
    ["basmotir", "basmati"],
    ["basmatir", "basmati"],
    ["basomotir", "basmati"],
    ["basmotike", "basmati"],
    ["swarnar", "swarna"],
    ["swarnar dam", "swarna"],
    // common feature-name garbles (§4/§13/§41)
    ["sideber", "sidebar"],
    ["siderber", "sidebar"],
    ["sightbar", "sidebar"],
    ["menue", "menu"],
    ["menu", "sidebar"],
    ["bazar", "market"],
    ["bajaar", "market"],
    ["mandi", "market"],
    ["mondi", "market"],
    ["moshom", "weather"],
    ["mausam", "weather"],
    ["abohawa", "weather"],
    ["abohawaa", "weather"],
    ["aabhawa", "weather"],
    ["dhaan", "rice"],
    ["dhan", "rice"],
    ["dhaner", "rice"],
    ["chaser", "crop"],
    ["fosol", "crop"],
    ["phasal", "crop"],
    ["jomi", "land"],
    ["jomir", "land"],
    ["jameen", "land"],
    ["zameen", "land"],
    ["ghor", "farm"],
    ["ghorer", "farm"],
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
    ["labh", "profit"],
    ["laabh", "profit"],
    ["khoroch", "cost"],
    ["kharch", "cost"],
    ["kharcha", "cost"],
    ["dam", "price"],
    ["daam", "price"],
    ["kotha", "koto"],
    ["kitna", "koto"],
    ["kitne", "koto"],
    ["bajarer", "market"],
    ["arer", "of"],
    ["er", "of"],
    ["r", "of"],
    ["ta", "the"],
    ["ti", "the"],
]);

/** Words with no matching value — dropped entirely during normalization. */
const NOISE_TOKENS = new Set([
    "the", "a", "an", "of", "to", "please", "amake", "kore",
    // sentence connectors/fillers (§7: "কি কি disease আছে দেখি")
    "ki", "ache", "achhe", "dekhi",
]);

/** Collapse letter→digit spacing so "ir 64" == "ir64". Digit→letter spacing
 * ("64 price") must stay intact — only letters-before-digits collapse. */
function collapseAlnumSpaces(text) {
    return text.replace(/([a-z])\s+(?=\d)/g, "$1");
}

/**
 * normalizeTranscript — the ONLY entry point for raw speech text.
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
