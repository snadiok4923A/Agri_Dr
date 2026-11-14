/**
 * voiceCommands.js — the single, centralized command table for Krisiveda's
 * rule-based voice assistant. NO AI, NO external services: intent detection
 * is pure phrase/keyword matching against the lists below.
 *
 * Matching priority (enforced by the parser):
 *   1. exact phrase     2. specific multi-word phrases     3. entity+action
 *   4. general commands 5. single-keyword fallback
 *
 * Phrase conventions — mix of:
 *   · English  ("open market")
 *   · Bengali  ("বাজার দেখাও")
 *   · Hinglish ("market kholo", "farm dekhao", "dam koto")
 */

import { riceVarieties } from "../data/riceVarieties";

/* ------------------------------------------------------------------ *
 * Static navigation / tool commands
 * ------------------------------------------------------------------ */
export const VOICE_COMMANDS = [
    /* ===== CLOSE — absolute priority (§18–§22) =====
     * Closes the ACTIVE temporary UI (modal / weather window / mobile
     * drawer) and restores what was underneath. When nothing temporary is
     * open, the executor does NOTHING (no navigation, no feedback).
     * NOTE: bare "বন্ধ করো"/"close" no longer stops Voice Mode — only
     * voice-specific stop phrases do (see STOP_VOICE_MODE below). */
    {
        intent: "CLOSE_ACTIVE_OVERLAY",
        feedback: "Closed",
        phrases: [
            "close",
            "close it",
            "close this",
            "close this window",
            "close kore dao",
            "band karo",
            "band koro",
            "bondho koro",
            "bondho koro eta",
            "eta bondho koro",
            "sidebar band karo",
            "modal band karo",
            "window band karo",
            "বন্ধ করো",
            "বন্ধ করুন",
            "এটা বন্ধ করো",
        ],
    },
    {
        intent: "OPEN_SIDEBAR",
        feedback: "Opening menu…",
        phrases: [
            "open sidebar",
            "sidebar kholo",
            "sidebar open",
            "sidebar kholo please",
            "সাইডবার খোলো",
            "সাইডবার খুলুন",
        ],
    },

    /* ===== Voice control itself ===== */
    {
        intent: "STOP_VOICE_MODE",
        feedback: "Voice Mode stopped",
        phrases: [
            "stop voice",
            "stop voice mode",
            "stop voice mode karo",
            "voice off",
            "turn off voice",
            "voice band karo",
            "voice bondho",
            "voice mode bondho",
            "voice mode off",
            "stop listening",
            "ভয়েস বন্ধ করো",
            "ভয়েস বন্ধ",
            "ভয়েস মোড বন্ধ করো",
        ],
    },
    {
        intent: "START_VOICE_MODE",
        feedback: "Voice Mode active",
        phrases: [
            "start voice",
            "start voice mode",
            "voice on",
            "voice mode on",
            "voice chalu koro",
            "voice chalu karo",
            "voice suru koro",
            "ভয়েস চালু করো",
            "ভয়েস মোড চালু করো",
        ],
    },

    /* ===== Primary navigation ===== */
    {
        intent: "OPEN_OVERVIEW",
        feedback: "Opening Overview…",
        phrases: [
            "open overview",
            "show overview",
            "go to overview",
            "overview kholo",
            "overview open karo",
            "overview dekhao",
            "open home",
            "go home",
            "home kholo",
            "home dekhao",
            "home open karo",
            "open dashboard",
            "show dashboard",
            "go to dashboard",
            "dashboard kholo",
            "dashboard open karo",
            "dashboard dekhao",
            "main dashboard",
            "open krishiveda",
            "krishiveda kholo",
            "প্রথম পাতায় যাও",
            "প্রথম পাতা খোলো",
            "ড্যাশবোর্ড খোলো",
            "ড্যাশবোর্ড দেখাও",
            "হোম খোলো",
            "হোম দেখাও",
        ],
    },
    {
        intent: "OPEN_MY_FARM",
        feedback: "Opening My Farm…",
        phrases: [
            "open my farm",
            "show my farm",
            "go to my farm",
            "my farm kholo",
            "my farm open karo",
            "my farm dekhao",
            // §15: recognition often returns "my form"/"myfarm" — same intent.
            "my form",
            "my form kholo",
            "my form dekhao",
            "myfarm",
            "myfarm kholo",
            "open my form",
            "farm kholo",
            "farm dekhao",
            "farm open karo",
            "open farm",
            "show farm",
            // §5: one meaningful word is enough
            "farm",
            "জমি দেখাও",
            "আমার জমি দেখাও",
            "আমার জমি খোলো",
            "আমার ফার্ম খোলো",
            "আমার ফার্ম দেখাও",
            "ফার্ম খোলো",
            "খামার দেখাও",
        ],
    },
    {
        intent: "SHOW_FARM_AREA",
        feedback: "Your farm area",
        phrases: [
            "how much land do i have",
            "how much total land do i have",
            "what is my total land",
            "my total land",
            "total land",
            "total farm land",
            "total farm area",
            "farm area",
            "amr jomi koto",
            "amar jomi koto",
            "jomir poriman koto",
            "আমার মোট জমি কত",
            "আমার মোট জমি",
            "মোট কত বিঘা জমি আছে",
            "মোট জমি কত",
            "জমির পরিমাণ কত",
            "আমার কত জমি আছে",
            "meri kul zameen kitni hai",
            "meri zameen kitni hai",
            "mera kul khet kitna hai",
            "मेरी कुल ज़मीन कितनी है",
            "मेरी कुल जमीन कितनी है",
            "मेरी ज़मीन कितनी है",
            "मेरी जमीन कितनी है",
            "मेरा कुल खेत कितना है",
            "कुल जमीन कितनी है",
            "నా మొత్తం భూమి ఎంత",
            "నా భూమి ఎంత",
            "మొత్తం భూమి ఎంత",
            "என் மொத்த நிலம் எவ்வளவு",
            "என்னிடம் எவ்வளவு நிலம் உள்ளது",
            "மொத்த நிலம் எவ்வளவு",
        ],
    },
    {
        intent: "OPEN_RICE_VARIETIES",
        feedback: "Opening Rice Varieties…",
        phrases: [
            "rice varieties",
            "varieties",
            "rice",
            "ধান",
            "open rice varieties",
            "show rice varieties",
            "go to rice varieties",
            "rice varieties kholo",
            "rice varieties dekhao",
            "rice variety kholo",
            "rice variety dekhao",
            "open crops",
            "show crops",
            "crops kholo",
            "crops dekhao",
            "crop list kholo",
            "ধানের জাত দেখাও",
            "ধানের জাত খোলো",
            "ধানের জাতগুলো দেখাও",
            "জাত দেখাও",
        ],
    },
    {
        intent: "OPEN_IMPROVE_YIELD",
        feedback: "Opening Improve Yield…",
        phrases: [
            "open improve yield",
            "show improve yield",
            "go to improve yield",
            "improve yield kholo",
            "improve yield dekhao",
            "yield improve karo",
            "yield dekhao",
            "yield kholo",
            "open yield",
            "yield",
            "ফলন বাড়ানোর অপশন খোলো",
            "ফলন বাড়াও",
            "ফলন দেখাও",
            "ফলন খোলো",
            "ফসলের ফলন দেখাও",
        ],
    },
    {
        intent: "OPEN_INSIGHTS",
        feedback: "Opening Insights…",
        phrases: [
            "open insights",
            "show insights",
            "go to insights",
            "insights kholo",
            "insights dekhao",
            "open analysis",
            "show analysis",
            "analysis dekhao",
            "analysis",
            "data analysis kholo",
            "data dekhao",
            "বিশ্লেষণ দেখাও",
            "বিশ্লেষণ খোলো",
            "ইনসাইটস খোলো",
            "ইনসাইট দেখাও",
        ],
    },
    {
        intent: "OPEN_AI_DOCTOR",
        feedback: "Opening AI Doctor…",
        phrases: [
            "open ai doctor",
            "show ai doctor",
            // §5/§16: a single meaningful word is enough
            "ai",
            "ai doctor",
            "doctor",
            "ডাক্তার",
            "ai doctor kholo",
            "ai doctor dekhao",
            "doctor kholo",
            "plant doctor kholo",
            "crop doctor kholo",
            "open crop diagnosis",
            "crop diagnosis kholo",
            "crop diagnosis dekhao",
            "leaf scan kholo",
            "open diagnosis",
            "diagnosis kholo",
            "ধানের ডাক্তার খোলো",
            "গাছের ডাক্তার খোলো",
            "ডাক্তার খোলো",
            "ফসল পরীক্ষা করো",
        ],
    },

    /* ===== Tools ===== */
    {
        intent: "OPEN_DISEASE_MEDICINE",
        feedback: "Opening Disease & Medicine…",
        feedback: "Opening Disease & Medicine…",
        phrases: [
            "open disease and medicine",
            "open disease medicine",
            "show disease and medicine",
            "disease and medicine kholo",
            "disease kholo",
            "disease dekhao",
            "disease",
            "rice disease",
            "medicine",
            "রোগ",
            "রোগ দেখাও",
            "কি কি disease আছে",
            "কি কি রোগ আছে",
            "medicine dekhao",
            "open medicine",
            "plant disease kholo",
            "crop disease kholo",
            "disease medicine dekhao",
            "রোগের ওষুধ দেখাও",
            "রোগের ওষুধ খোলো",
            "ওষুধের অপশন খোলো",
            "ধানের রোগ দেখাও",
            "পাতার রোগ দেখাও",
            "রোগ ও ওষুধ দেখাও",
        ],
    },
    {
        intent: "OPEN_FERTILIZER_PLAN",
        feedback: "Opening Fertilizer Plan…",
        phrases: [
            "open fertilizer plan",
            "show fertilizer plan",
            "fertilizer plan kholo",
            "fertilizer plan dekhao",
            "fertilizer kholo",
            "fertilizer dekhao",
            "open fertilizer",
            "fertilizer schedule kholo",
            "fertilizer",
            "সারের পরিকল্পনা দেখাও",
            "সারের পরিকল্পনা খোলো",
            "সার দেখাও",
            "সারের হিসাব দেখাও",
            "সারের হিসাব খোলো",
        ],
    },
    {
        intent: "OPEN_COST_PROFIT",
        feedback: "Opening Cost & Profit…",
        phrases: [
            "open cost and profit",
            "open cost profit",
            "show cost profit",
            "cost profit kholo",
            "cost and profit kholo",
            "cost kholo",
            "cost dekhao",
            "profit dekhao",
            "profit kholo",
            "open profit",
            "open finance",
            "finance kholo",
            "cost",
            "profit",
            "লাভ দেখাও",
            "লাভ খোলো",
            "খরচ দেখাও",
            "লাভ ক্ষতি দেখাও",
            "খরচ আর লাভ দেখাও",
            "লাভ কত হচ্ছে দেখাও",
        ],
    },
    {
        intent: "OPEN_MARKET",
        feedback: "Opening Market Intelligence…",
        phrases: [
            "open market",
            "show market",
            "go to market",
            "market kholo",
            "market open karo",
            "market dekhao",
            "open market intelligence",
            "market intelligence kholo",
            "market",
            "market price",
            "rice price",
            "market price dekhao",
            "market price kholo",
            "rice price dekhao",
            "rice price kholo",
            "rice price",
            "rice",
            "show rice market",
            "rice market dekhao",
            "paddy price dekhao",
            "ধানের দাম দেখাও",
            "ধানের দাম খোলো",
            "বাজার দেখাও",
            "বাজার খোলো",
            "বাজারের দাম দেখাও",
            "আজকের বাজার দেখাও",
        ],
    },
    {
        intent: "OPEN_SETTINGS",
        feedback: "Opening Settings…",
        phrases: [
            "open settings",
            "show settings",
            "go to settings",
            "settings kholo",
            "settings open karo",
            "settings dekhao",
            "open setting",
            "setting kholo",
            "settings",
            "setting",
            "সেটিংস খোলো",
            "সেটিংস দেখাও",
        ],
    },

    /* ===== Weather ===== */
    {
        intent: "OPEN_WEATHER",
        feedback: "Opening Weather…",
        phrases: [
            "show weather",
            "open weather",
            "weather",
            "weather today",
            "today weather",
            "weather kholo",
            "weather dekhao",
            "weather dekhi",
            "weather dekho",
            "weather ta dekhao",
            "weather dakhao",
            "weather information",
            "weather info",
            "weather advisory kholo",
            "weather advisory dekhao",
            "weather report dekhao",
            "weather report",
            "আজকের আবহাওয়া দেখাও",
            "আজকের আবহাওয়া",
            "আবহাওয়া দেখাও",
            "আজকের weather দেখাও",
            "আজকের আবহাওয়া কেমন",
            "আবহাওয়া কেমন আছে",
            "বৃষ্টি হবে কি",
            "বৃষ্টি হবে কি না",
            "বৃষ্টির খবর দেখাও",
            "বৃষ্টি হবে",
            "আজ বৃষ্টি হবে",
            "আজকে বৃষ্টি হবে",
            "আজ কি বৃষ্টি হবে",
            "আজ বৃষ্টি হবে কি",
            "aj brishti hobe",
            "aj ki brishti hobe",
            "brishti hobe",
            "aj weather ki",
            "will it rain today",
            "is it going to rain today",
            "is today going to rain",
            "today rain",
        ],
    },
    {
        intent: "SHOW_TEMPERATURE",
        feedback: null, // filled with live value by the executor
        phrases: [
            "temperature dekhao",
            "temperature kholo",
            "temperature koto",
            "temperature koto ache",
            "how hot is it",
            "how hot is today",
            "weather temperature",
            "current temperature",
            "temperature",
            "তাপমাত্রা কত",
            "তাপমাত্রা দেখাও",
            "আজকের তাপমাত্রা কত",
            "কত গরম",
            "গরম কত",
        ],
    },
    {
        intent: "SHOW_HUMIDITY",
        feedback: null,
        phrases: [
            "humidity dekhao",
            "humidity koto",
            "humidity koto ache",
            "humidity",
            "আর্দ্রতা কত",
            "আর্দ্রতা দেখাও",
        ],
    },
    {
        intent: "SHOW_WIND",
        feedback: null,
        phrases: [
            "wind speed koto",
            "wind speed dekhao",
            "wind dekhao",
            "wind koto",
            "wind speed",
            "হাওয়ার গতি কত",
            "হাওয়ার গতি দেখাও",
            "বাতাস কত",
            "বাতাস দেখাও",
        ],
    },
    {
        intent: "SHOW_RAIN_PROBABILITY",
        feedback: null,
        phrases: [
            "rain probability",
            "rain probability koto",
            "rain chance",
            "rain dekhao",
            "বৃষ্টির সম্ভাবনা কত",
            "বৃষ্টির সম্ভাবনা দেখাও",
            "বৃষ্টি কত শতাংশ",
            "বৃষ্টির সম্ভাবনা",
        ],
    },

    /* ===== Crop diagnosis actions (Dashboard card) ===== */
    {
        intent: "TAKE_CROP_PHOTO",
        feedback: "Opening camera…",
        phrases: [
            "take photo",
            "take a photo",
            "photo nao",
            "photo tolo",
            "take crop photo",
            "camera kholo",
            "camera chalu koro",
            "ছবি তোলো",
            "পাতার ছবি তোলো",
            "পাতা পরীক্ষা করো",
            "ধানের পাতা পরীক্ষা করো",
            "পাতার ছবি",
        ],
    },
    {
        intent: "UPLOAD_CROP_PHOTO",
        feedback: "Opening photo upload…",
        phrases: [
            "upload photo",
            "photo upload",
            "upload crop photo",
            "upload leaf photo",
            "ছবি আপলোড করো",
            "পাতার ছবি আপলোড করো",
            "ছবি আপলোড",
        ],
    },

    /* ===== Navigation shortcuts ===== */
    {
        intent: "GO_BACK",
        feedback: "Going back…",
        phrases: [
            "back",
            "go back",
            "previous",
            "previous page",
            "পেছনে যাও",
            "আগের পেজ",
        ],
    },
    {
        intent: "SCROLL_DOWN",
        feedback: null,
        phrases: [
            "scroll down",
            "নিচে যাও",
            "নিচে স্ক্রল করো",
        ],
    },
    {
        intent: "SCROLL_UP",
        feedback: null,
        phrases: [
            "scroll up",
            "উপরে যাও",
            "উপরে স্ক্রল করো",
        ],
    },

    /* ===== Theme ===== */
    {
        intent: "SET_DARK_MODE",
        feedback: "Dark mode on",
        phrases: [
            "dark mode",
            "dark mode on",
            "dark mode chalu koro",
            "dark mode koro",
            "ডার্ক মোড চালু করো",
            "ডার্ক মোড",
        ],
    },
    {
        intent: "SET_LIGHT_MODE",
        feedback: "Light mode on",
        phrases: [
            "light mode",
            "light mode on",
            "light mode chalu koro",
            "light mode koro",
            "লাইট মোড চালু করো",
            "লাইট মোড",
        ],
    },
];

/* ------------------------------------------------------------------ *
 * Entity commands — built from the app's REAL data (never invented).
 * ------------------------------------------------------------------ */

/** Extra everyday aliases for varieties whose data name is longer/more
 * formal than what a farmer would actually say (only where the app has a
 * single variety of that kind, so no ambiguity is introduced). */
const EXTRA_VARIETY_ALIASES = {
    "traditional-basmati": ["basmati"], // the app's only basmati variety
};

/**
 * Rice variety names + aliases, straight from `riceVarieties`.
 * Includes `aka` (e.g. Swarna/MTU 7029, Black Rice/Chak Hao) so farmers can
 * say either name. Also Hindi/Bengali renderings of common variety words.
 */
export function getVarietyAliases() {
    const list = [];
    for (const v of riceVarieties) {
        const aliases = new Set([v.name.toLowerCase()]);
        if (v.aka) aliases.add(v.aka.toLowerCase());
        for (const extra of EXTRA_VARIETY_ALIASES[v.id] || []) {
            aliases.add(extra);
        }
        // Canonical spacing forms are handled by normalizeTranscript, but add
        // the raw spaced forms too (e.g. "ir 64", "pusa 1121", "pr 126").
        if (v.id === "ir64") {
            aliases.add("ir 64");
            aliases.add("ir-64");
        }
        if (v.id === "pr-126") {
            aliases.add("pr 126");
            aliases.add("pr126");
        }
        list.push({ id: v.id, name: v.name, aliases: [...aliases] });
    }
    return list;
}

/* ------------------------------------------------------------------ *
 * Additional natural phrases in every website language (hi / te / ta were
 * absent, bn only covered a handful of actions) plus the mixed-script
 * forms farmers actually speak ("My Farm খোলো", "আগামীকালের weather কেমন").
 * Appended to the single command table so the parser stays unchanged.
 * ------------------------------------------------------------------ */
const EXTRA_PHRASES = {
    OPEN_OVERVIEW: [
        "डैशबोर्ड खोलो", "डैशबोर्ड दिखाओ", "होम दिखाओ",
        "డాష్‌బోర్డ్ తెరవు", "హోమ్ చూపించు",
        "டாஷ்போர்டு திற", "முகப்பு காட்டு",
    ],
    OPEN_MY_FARM: [
        "my farm খোলো", "my farm চালু করো", "my farm bangla",
        "আমার জমি", "জমির তথ্য দেখাও", "জমির পরিমাণ দেখাও",
        "खेत दिखाओ", "मेरा खेत खोलो", "मेरा खेत दिखाओ", "खेत खोलो",
        "నా పొలం తెరవు", "పొలం చూపించు", "నా పొలం చూపించు",
        "என் நிலம் திற", "வயல் காட்டு", "என் வயலைக் காட்டு",
    ],
    OPEN_MARKET: [
        "बाजार दिखाओ", "बाजार खोलो", "मंडी भाव बताओ", "मंडी भाव",
        "धान का भाव", "धान का भाव बताओ",
        "బజార్ చూపించు", "మార్కెట్ చూపించు", "ధాన్యం ధర చెప్పు", "ధాన్యం ధర",
        "சந்தை காட்டு", "சந்தை விலை சொல்லு", "நெல் விலை", "நெல் விலை சொல்லு",
        "বাজারের দাম বলো", "ধানের দাম বলো",
    ],
    OPEN_AI_DOCTOR: [
        "ai doctor chalu koro", "ai doctor চালু করো", "ডাক্তার চালু করো",
        "doctor chalu koro",
        "डॉक्टर खोलो", "डॉक्टर दिखाओ", "फसल डॉक्टर दिखाओ",
        "డాక్టర్ తెరవు", "డాక్టర్ చూపించు", "పంట డాక్టర్ చూపించు",
        "டாக்டர் திற", "டாக்டர் காட்டு", "பயிர் மருத்துவர் காட்டு",
    ],
    OPEN_DISEASE_MEDICINE: [
        "रोग दिखाओ", "रोग खोलो", "बीमारी बताओ", "रोग और दवा",
        "తెగులు చూపించు", "తెగుళ్లు చూపించు",
        "நோய் காட்டு", "நோய் மருந்து காட்டு",
    ],
    OPEN_FERTILIZER_PLAN: [
        "खाद दिखाओ", "खाद खोलो", "उर्वरक योजना", "उर्वरक योजना खोलो",
        "ఎరువులు చూపించు", "ఎరువుల ప్రణాళిక",
        "உரம் காட்டு", "உரத் திட்டம் காட்டு",
    ],
    OPEN_COST_PROFIT: [
        "लागत मुनाफा", "लागत मुनाफा दिखाओ", "खर्च दिखाओ", "मुनाफा दिखाओ",
        "ఖర్చు లాభం", "ఖర్చు లాభం చూపించు", "లాభం చూపించు",
        "செலவு லாபம்", "செலவு லாபம் காட்டு", "லாபம் காட்டு",
    ],
    OPEN_INSIGHTS: [
        "विश्लेषण दिखाओ", "विश्लेषण", "విశ్లేషణ చూపించు", "பகுப்பாய்வு காட்டு",
    ],
    OPEN_IMPROVE_YIELD: [
        "उत्पादन बढ़ाओ", "उपज बढ़ाओ", "దిగుబడి పెంచు", "மகசூல் அதிகரிக்க",
    ],
    OPEN_SETTINGS: [
        "सेटिंग्स", "सेटिंग्स खोलो", "సెట్టింగ్‌లు", "సెట్టింగ్‌లు తెరవు",
        "அமைப்புகள்", "அமைப்புகள் திற",
    ],
    OPEN_RICE_VARIETIES: [
        "धान की किस्में", "धान की किस्में दिखाओ", "వరి రకాలు",
        "వరి రకాలు చూపించు", "நெல் ரகங்கள்", "நெல் ரகங்கள் காட்டு",
        "ধানের জাত",
    ],
    OPEN_WEATHER: [
        "আবহাওয়া বলো", "আগামীকালের weather কেমন", "আগামীকালের আবহাওয়া কেমন",
        "আগামীকালের আবহাওয়া দেখাও", "কালকের আবহাওয়া কেমন",
        "मौसम बताओ", "मौसम दिखाओ", "आज का मौसम", "आज का मौसम कैसा है",
        "कल का मौसम", "कल का मौसम कैसा है", "बारिश होगी क्या",
        "వాతావరణం చెప్పు", "రేపటి వాతావరణం", "రేపటి వాతావరణం ఎలా ఉంటుంది",
        "వర్షం పడుతుందా",
        "வானிலை சொல்லு", "நாளை வானிலை", "நாளை வானிலை எப்படி", "மழை பெய்யுமா",
    ],
    SHOW_TEMPERATURE: [
        "तापमान कितना है", "तापमान बताओ", "ఉష్ణోగ్రత ఎంత", "వెచ్చదనం ఎంత",
        "வெப்பநிலை என்ன",
    ],
    SHOW_HUMIDITY: [
        "नमी कितनी है", "उमस कितनी है", "తేమ ఎంత", "ஈரப்பதம் என்ன",
    ],
    SET_DARK_MODE: [
        "डार्क मोड चालू करो", "डार्क मोड करो", "డార్క్ మోడ్ ఆన్ చేయి",
        "டார்க் மோட் இயக்கு",
    ],
    SET_LIGHT_MODE: [
        "लाइट मोड चालू करो", "లైట్ మోడ్ ఆన్ చేయి", "லைட் மோட் இயக்கு",
    ],
    CLOSE_ACTIVE_OVERLAY: [
        "बंद करो", "इसे बंद करो", "మూసివేయి", "மூடு", "இதை மூடு",
    ],
    STOP_VOICE_MODE: [
        "वॉइस बंद करो", "वॉइस मोड बंद करो", "వాయిస్ ఆపు", "వాయిస్ మోడ్ ఆపు",
        "குரல் நிறுத்து", "குரல் முறையை நிறுத்து",
    ],
    START_VOICE_MODE: [
        "वॉइस चालू करो", "वॉइस मोड चालू करो", "వాయిస్ ఆన్ చేయి",
        "குரலை இயக்கு",
    ],
    GO_BACK: ["पीछे जाओ", "వెనుకకు వెళ్లు", "பின்னால் செல்"],
};

for (const command of VOICE_COMMANDS) {
    const extra = EXTRA_PHRASES[command.intent];
    if (extra) command.phrases.push(...extra);
}

/** Languages actually supported by the app's existing language selector. */
export const LANGUAGE_ALIASES = [
    {
        code: "en",
        label: "English",
        aliases: ["english", "ingreji", "ইংরেজি", "english language", "english koro"],
    },
    {
        code: "bn",
        label: "বাংলা (Bangla)",
        aliases: ["bangla", "bengali", "বাংলা", "বাংলা করো", "bangla koro", "bangla language"],
    },
    {
        code: "hi",
        label: "हिन्दी (Hindi)",
        aliases: ["hindi", "हिन्दी", "হিন্দি", "হিন্দি করো", "hindi koro", "hindi language"],
    },
    {
        code: "te",
        label: "తెలుగు (Telugu)",
        aliases: ["telugu", "তেলেগু", "తెలుగు", "telugu koro", "telugu language"],
    },
    {
        code: "ta",
        label: "தமிழ் (Tamil)",
        aliases: ["tamil", "তামিল", "தமிழ்", "tamil koro", "tamil language"],
    },
];
