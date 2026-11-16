/**
 * voiceNormalize.js — transcript normalization shared by the parser and the
 * entity registries. Kept in its own module so both can import it without a
 * circular dependency (the registries normalize aliases at module-load time).
 *
 * Pipeline: NFC → lowercase → strip punctuation (keep \p{M} for Bengali/
 * Hindi vowel signs) → collapse spaces → token fixes (Latin + Bengali) →
 * digit-spacing collapse.
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
    ["kitni", "koto"],
    ["batao", "dekhaao"],
    ["bata", "dekhaao"],
    ["bataiye", "dekhaao"],
    ["dikhao", "dekhaao"],
    ["dijiye", "dekhaao"],
    ["kholiye", "kholo"],
    ["bajarer", "market"],
    ["arer", "of"],
    ["er", "of"],
    ["r", "of"],
    ["ta", "the"],
    ["ti", "the"],

    /* ----------------------------------------------------------------
     * Bengali script (bn-IN) — the recogniser writes both native words and
     * English loanwords in Bengali letters. These map to the SAME canonical
     * tokens the phrase table uses, so "ওয়েদার দেখতে চাই", "weather dekhao"
     * and "show weather" all end up comparable. Keys are NFC-normalized
     * before lookup (both precomposed and decomposed য় spellings included).
     * ---------------------------------------------------------------- */
    // feature nouns / loanwords
    ["ওয়েদার", "weather"], ["ওয়েদার", "weather"],
    ["আবহাওয়া", "weather"], ["আবহাওয়া", "weather"],
    ["মার্কেট", "market"], ["বাজার", "market"],
    ["ডাক্তার", "doctor"],
    ["সেটিংস", "settings"],
    ["ড্যাশবোর্ড", "dashboard"],
    ["ফার্ম", "farm"], ["খামার", "farm"],
    ["জমি", "land"],
    ["রোগ", "disease"],
    ["সার", "fertilizer"],
    ["খরচ", "cost"],
    ["লাভ", "profit"],
    ["দাম", "price"],
    // verb forms the recogniser actually produces
    ["দেখতে", "dekhaao"], ["দেখাও", "dekhaao"],
    ["দেখান", "dekhaao"], ["দেখি", "dekhaao"],
    ["খুলতে", "kholo"], ["খোলো", "kholo"], ["খুলুন", "kholo"],
    ["করো", "karo"], ["করতে", "karo"], ["করুন", "karo"],
    ["বন্ধ", "band"], ["চালু", "chalu"],
]);

/** Words with no matching value — dropped entirely during normalization. */
const NOISE_TOKENS = new Set([
    "the", "a", "an", "of", "to", "please", "amake", "kore",
    // Hindi sentence particles ("मेरी जमीन कितनी है") — the phrase table is
    // normalized the same way, so removing them never changes a match.
    "mera", "meri", "mere", "hai", "hain", "ka", "ki", "ke",
    // sentence connectors/fillers (§7: "কি কি disease আছে দেখি")
    "ki", "ache", "achhe", "dekhi",
    // Bengali desire/politeness forms — "দেখতে চাই" / "খুলতে চাইছি" carry no
    // command meaning of their own.
    "চাই", "চাচ্ছি", "চাইছি", "চাইছেন",
]);

/* NFC-normalized lookups: Bengali য়/য় (precomposed vs য+়) must resolve to
 * the same token no matter which form the recogniser emits. The phrase table
 * is normalized with normalizeTranscript() too, so both sides always agree. */
const TOKEN_FIX_LOOKUP = new Map(
    [...TOKEN_FIXES].map(([from, to]) => [
        from.normalize("NFC"),
        to.normalize("NFC"),
    ]),
);
const NOISE_LOOKUP = new Set(
    [...NOISE_TOKENS].map((token) => token.normalize("NFC")),
);

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
        // NFC first: Web Speech emits both precomposed and decomposed Bengali
        // forms (য় vs য+়) for the same word.
        .normalize("NFC")
        .toLowerCase()
        .trim()
        // remove punctuation (keep letters + COMBINING MARKS + digits + spaces;
        // \p{M} is essential for Bengali/Hindi — vowel signs are marks, not letters)
        .replace(/[^\p{L}\p{M}\p{N}\s]/gu, " ")
        .replace(/\s+/g, " ")
        .trim();

    if (!text) return "";

    // Token fixes run on the NFC form for both scripts, so "ওয়েদার দেখতে চাই"
    // and "weather dekhao" reach the same canonical "weather dekhaao".
    text = text
        .split(" ")
        .map((tok) => {
            const normalized = tok.normalize("NFC");
            return TOKEN_FIX_LOOKUP.get(normalized) ?? normalized;
        })
        .filter((tok) => tok && !NOISE_LOOKUP.has(tok))
        .join(" ");

    return collapseAlnumSpaces(text);
}
