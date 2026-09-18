/**
 * diseaseLibrary.js — the Rice Disease Library dataset.
 *
 * Original 3 entries derive from the app's existing `diseaseData`
 * (mockData.js) — their costs/doses/coverage are the app's real recorded
 * treatment values. The newer entries carry approximate ESTIMATES
 * ("≈ ₹X / acre"), internally consistent with the app's existing
 * ₹650–₹1,200 treatment-cost range and per-liter dose formats. Specific
 * medicines are NOT invented where the app has none — the treatment field
 * points to an agronomist instead.
 *
 * Every entry follows the same complete schema so the floating detail
 * window renders an identical structure for all diseases:
 *   image (art) · name · scientificName · severity · medicine · dose ·
 *   coverage · cost · symptoms · commonIn
 *
 * Presentation-only transforms of the original data:
 *   · "Leaf Blast (Magnaporthe oryzae)" → common name + scientific name
 *   · severity  → friendly harm level (Low / Moderate / High / Critical)
 *   · symptoms sentence → 2–4 short symptom bullets (same wording)
 *   · dosage parenthetical "250 g for 1.8 ac" → coverage value
 */

export const diseaseLibrary = [
    /* ==================== Existing (from app diseaseData) ==================== */
    {
        id: "leaf-blast",
        name: "Leaf Blast",
        scientificName: "Magnaporthe oryzae",
        category: "fungal",
        harmLevel: "Critical",
        tone: "danger",
        art: "blast",
        medicine: "Tricyclazole 75% WP (Baan / Beam)",
        dose: "0.6 g / L",
        coverage: "250 g for 1.8 acres",
        cost: "₹1,200 / acre",
        symptoms: [
            "Diamond-shaped spindle lesions on leaves",
            "Grayish-white centers",
            "Dark brown margins",
        ],
        commonIn: ["Swarna"],
    },
    {
        id: "brown-plant-hopper",
        name: "Brown Plant Hopper",
        scientificName: "Nilaparvata lugens",
        category: "pest",
        harmLevel: "Moderate",
        tone: "warning",
        art: "hopper",
        medicine: "Imidacloprid 17.8 SL (Confidor)",
        dose: "0.3 ml / L",
        coverage: "120 ml for 2.4 acres",
        cost: "₹850 / acre",
        symptoms: [
            "Yellowing tillers at the base",
            "Early signs of hopperburn at dense spots",
        ],
        commonIn: ["IR64"],
    },
    {
        id: "sheath-blight",
        name: "Sheath Blight",
        scientificName: "Rhizoctonia solani",
        category: "fungal",
        harmLevel: "Low",
        tone: "info",
        art: "sheath",
        medicine: "Hexaconazole 5% SC (Contaf Plus)",
        dose: "2.0 ml / L",
        coverage: "500 ml for 2.2 acres",
        cost: "₹650 / acre",
        symptoms: [
            "Snake-skin like spots on leaf sheaths",
            "Greenish-grey patches near the water line",
        ],
        commonIn: ["Traditional Basmati"],
    },

    /* ==================== Library additions (provided descriptions only) ==================== */
    {
        id: "brown-spot",
        name: "Brown Spot",
        scientificName: "Bipolaris oryzae",
        category: "fungal",
        harmLevel: "High",
        tone: "warning",
        art: "brownspot",
        medicine: null,
        dose: "≈ 1.0 ml / L",
        coverage: "≈ 400 ml for 1.8 acres",
        cost: "≈ ₹700 / acre",
        symptoms: [
            "Small, round brown spots on rice leaves",
            "Can severely affect photosynthesis",
        ],
        preview: "Small round brown spots on leaves.",
        commonIn: ["Swarna", "Sona Masuri", "Ponni"],
    },
    {
        id: "false-smut",
        name: "False Smut",
        scientificName: "Ustilaginoidea virens",
        category: "fungal",
        harmLevel: "Moderate",
        tone: "info",
        art: "smut",
        medicine: null,
        dose: "≈ 2.0 g / L",
        coverage: "≈ 800 g for 2.0 acres",
        cost: "≈ ₹750 / acre",
        symptoms: [
            "Individual rice grains are transformed into large spore balls",
            "Velvety green or black in appearance",
        ],
        preview: "Green or black spore balls replace individual grains.",
        commonIn: ["Swarna", "PR 126"],
    },
    {
        id: "bakanae",
        name: "Bakanae / Foot Rot",
        scientificName: "Fusarium fujikuroi",
        category: "fungal",
        harmLevel: "High",
        tone: "warning",
        art: "bakanae",
        medicine: null,
        dose: "≈ 1.0 g / L",
        coverage: "≈ 450 g for 1.8 acres",
        cost: "≈ ₹800 / acre",
        symptoms: [
            "Infected rice plants become abnormally tall and thin",
            "Plants eventually die",
        ],
        preview: "Plants become unusually tall and thin.",
        commonIn: ["Pusa 1121", "Pusa 1509", "Traditional Basmati"],
    },
    {
        id: "bacterial-leaf-blight",
        name: "Bacterial Leaf Blight (BLB)",
        scientificName: "Xanthomonas oryzae pv. oryzae",
        category: "bacterial",
        harmLevel: "Critical",
        tone: "danger",
        art: "blb",
        medicine: null,
        dose: "≈ 0.5 g / L",
        coverage: "≈ 250 g for 1.8 acres",
        cost: "≈ ₹1,000 / acre",
        symptoms: [
            "Water-soaked streaks appear along leaf blades",
            "Streaks gradually turn yellow, then grayish-white",
        ],
        preview: "Water-soaked leaf streaks turn yellow and grayish-white.",
        commonIn: ["IR64", "Swarna", "Sona Masuri"],
    },
    {
        id: "bacterial-leaf-streak",
        name: "Bacterial Leaf Streak",
        scientificName: "Xanthomonas oryzae pv. oryzicola",
        category: "bacterial",
        harmLevel: "High",
        tone: "warning",
        art: "bls",
        medicine: null,
        dose: "≈ 0.5 g / L",
        coverage: "≈ 250 g for 1.8 acres",
        cost: "≈ ₹800 / acre",
        symptoms: [
            "Narrow translucent streaks appear between the leaf veins",
            "Yellowish-brown in color",
        ],
        preview: "Narrow yellowish-brown streaks between leaf veins.",
        commonIn: ["IR64", "BPT 5204"],
    },
    {
        id: "rice-tungro",
        name: "Rice Tungro Disease",
        scientificName: "Rice tungro virus complex",
        category: "viral",
        harmLevel: "Critical",
        tone: "danger",
        art: "tungro",
        medicine: null,
        dose: "≈ 0.3 ml / L",
        coverage: "≈ 120 ml for 2.0 acres",
        cost: "≈ ₹1,000 / acre",
        symptoms: [
            "Plants become severely stunted",
            "Yellow or orange discoloration beginning from the leaf tips",
        ],
        preview: "Severe stunting with yellow-orange leaf discoloration.",
        note: "Transmitted by the Green Leafhopper.",
        commonIn: ["Swarna", "IR64", "PR 126"],
    },
    {
        id: "rice-yellow-dwarf",
        name: "Rice Yellow Dwarf",
        scientificName: "Rice yellow dwarf phytoplasma",
        category: "viral",
        harmLevel: "High",
        tone: "warning",
        art: "yellowdwarf",
        medicine: null,
        dose: "≈ 0.3 ml / L",
        coverage: "≈ 120 ml for 2.0 acres",
        cost: "≈ ₹900 / acre",
        symptoms: [
            "Extreme plant stunting",
            "Excessive tillering creates a grassy, bushy appearance",
        ],
        preview: "Severe stunting with excessive bushy tillering.",
        commonIn: ["Swarna", "Sona Masuri"],
    },
    {
        id: "ufra",
        name: "Ufra Disease",
        scientificName: "Ditylenchus angustus",
        category: "nematode",
        harmLevel: "High",
        tone: "warning",
        art: "ufra",
        medicine: null,
        dose: "≈ 2.0 ml / L",
        coverage: "≈ 900 ml for 2.0 acres",
        cost: "≈ ₹850 / acre",
        symptoms: [
            "The stem nematode attacks growing points",
            "Twisted and distorted leaves",
            "Prevents proper panicle emergence",
        ],
        preview: "Twisted leaves and poor panicle emergence.",
        commonIn: ["Swarna", "Pokkali"],
    },
    {
        id: "root-knot",
        name: "Root-Knot",
        scientificName: "Meloidogyne spp.",
        category: "nematode",
        harmLevel: "Moderate",
        tone: "info",
        art: "rootknot",
        medicine: null,
        dose: "≈ 2.0 ml / L",
        coverage: "≈ 1,000 ml for 2.2 acres",
        coverageNote: "soil drench to the root zone",
        cost: "≈ ₹750 / acre",
        symptoms: [
            "Swelling and galls develop on the roots",
            "Reduces the plant's ability to absorb water and nutrients",
        ],
        preview: "Root swelling and galls reduce nutrient uptake.",
        commonIn: ["Sona Masuri", "Ponni"],
    },
    {
        id: "khaira",
        name: "Khaira Disease",
        scientificName: "Zinc deficiency disorder",
        category: "nutritional",
        harmLevel: "Moderate",
        tone: "info",
        art: "khaira",
        medicine: null,
        dose: "≈ 0.5 % foliar spray",
        coverage: "≈ 500 g zinc sulphate for 1.8 acres",
        cost: "≈ ₹650 / acre",
        symptoms: [
            "Rusty brown patches appear on leaves",
            "Stunted plant growth",
        ],
        preview: "Rusty brown leaf patches with stunted growth.",
        note: "Caused by zinc deficiency, particularly associated with flooded soils.",
        commonIn: ["Swarna", "PR 126", "Pokkali"],
    },
    {
        id: "iron-toxicity",
        name: "Iron Toxicity",
        scientificName: "Excess iron (bronzing) disorder",
        category: "nutritional",
        harmLevel: "Moderate",
        tone: "info",
        art: "irontox",
        medicine: null,
        dose: "≈ 0.5 % foliar spray",
        coverage: "≈ 10 kg lime for 1.8 acres",
        cost: "≈ ₹700 / acre",
        symptoms: [
            "Leaves develop bronzing or purplish-brown discoloration",
            "Commonly associated with poorly drained acidic soils",
        ],
        preview: "Bronzing or purplish-brown leaf discoloration.",
        commonIn: ["Pokkali", "Navara"],
    },
];

/*
 * Farmer keyword layer — extra searchable terms per disease.
 *
 * The page's ONLY discovery tool is search (the old severity/type filter
 * chips were removed), so farmers must find a disease by typing what they
 * see, not by knowing the textbook name. These keywords add:
 *   · affected plant parts (leaf / stem / panicle / root …)
 *   · farmer phrasings and common words ("spots on leaf", "leaf turning yellow")
 *   · Bengali symptom words so Bengali-mode searches match too
 * Nothing here claims detection — they are pure library-search terms.
 */
const farmerKeywords = {
    "leaf-blast": {
        parts: ["leaf", "panicle", "node"],
        keywords: [
            "blast", "rice blast", "leaf blast", "diamond shaped spot",
            "spots on leaf", "brown lesion", "eye shaped spot", "leaf lesions",
            "\u09ac\u09cd\u09b2\u09be\u09b8\u09cd\u099f", "\u09aa\u09be\u09a4\u09be\u09af\u09bc \u09a6\u09be\u0997", "\u09aa\u09be\u09a4\u09be \u09aa\u09cb\u09dc\u09be \u09a6\u09be\u0997",
        ],
    },
    "brown-plant-hopper": {
        parts: ["stem", "base", "tillers"],
        keywords: [
            "hopper", "pest", "insect", "hopperburn", "yellowing tillers",
            "insect attack at base", "\u09aa\u09cb\u0995\u09be", "\u09ac\u09be\u09a6\u09be\u09ae\u09bf \u09aa\u09cb\u0995\u09be", "\u0997\u09cb\u09dc\u09be\u09af\u09bc \u09aa\u09cb\u0995\u09be",
        ],
    },
    "sheath-blight": {
        parts: ["sheath", "leaf", "stem"],
        keywords: [
            "sheath", "leaf sheath", "snake skin spots", "water line patches",
            "\u09b6\u09bf\u09a5", "\u09aa\u09be\u09a4\u09be\u09b0 \u0997\u09cb\u09dc\u09be\u09af\u09bc \u09a6\u09be\u0997", "\u09b8\u09be\u09aa\u09c7\u09b0 \u099a\u09be\u09ae\u09dc\u09be\u09b0 \u09ae\u09a4\u09cb \u09a6\u09be\u0997",
        ],
    },
    "brown-spot": {
        parts: ["leaf", "grain"],
        keywords: [
            "brown spot", "leaf spot", "round brown spots", "spots on leaf",
            "\u09ac\u09be\u09a6\u09be\u09ae\u09bf \u09a6\u09be\u0997", "\u0997\u09cb\u09b2 \u09a6\u09be\u0997", "\u09aa\u09be\u09a4\u09be\u09af\u09bc \u09a6\u09be\u0997",
        ],
    },
    "false-smut": {
        parts: ["grain", "panicle"],
        keywords: [
            "smut", "spore balls", "green black grains", "grain problem",
            "\u09a6\u09be\u09a8\u09be \u0995\u09be\u09b2\u09cb", "\u09b6\u09c0\u09b7\u09c7 \u09a6\u09be\u0997", "\u0995\u09be\u09b2\u09cb \u09a6\u09be\u09a8\u09be",
        ],
    },
    "bakanae": {
        parts: ["seedling", "root", "whole plant"],
        keywords: [
            "foot rot", "bakanae", "abnormally tall", "thin plants", "seedling rot",
            "\u0997\u09be\u099b \u09b2\u09ae\u09cd\u09ac\u09be \u09b9\u0993\u09af\u09bc\u09be", "\u099a\u09bf\u0995\u09a3 \u099a\u09be\u09b0\u09be",
        ],
    },
    "bacterial-leaf-blight": {
        parts: ["leaf", "blade"],
        keywords: [
            "blb", "bacterial", "leaf blight", "yellow leaf", "leaf turning yellow",
            "water soaked streaks", "\u09aa\u09be\u09a4\u09be \u09b9\u09b2\u09c1\u09a6", "\u09aa\u09be\u09a4\u09be\u09b0 \u09ae\u09be\u09dd\u09c7 \u09a6\u09be\u0997",
        ],
    },
    "bacterial-leaf-streak": {
        parts: ["leaf", "blade"],
        keywords: [
            "bls", "bacterial", "leaf streak", "yellow streaks between veins",
            "\u09aa\u09be\u09a4\u09be\u09af\u09bc \u09b9\u09b2\u09c1\u09a6 \u09a6\u09be\u0997",
        ],
    },
    "rice-tungro": {
        parts: ["leaf", "whole plant"],
        keywords: [
            "tungro", "virus", "stunted plant", "yellow orange leaf tips", "leafhopper",
            "\u0997\u09be\u099b \u09ac\u09be\u09ae\u09a8", "\u09aa\u09be\u09a4\u09be \u09b9\u09b2\u09c1\u09a6 \u0995\u09ae\u09b2\u09be",
        ],
    },
    "rice-yellow-dwarf": {
        parts: ["leaf", "whole plant", "tillers"],
        keywords: [
            "dwarf", "phytoplasma", "excessive tillering", "bushy plant", "yellow",
            "\u09ac\u09be\u09ae\u09a8\u09a4\u09be", "\u09ac\u09c7\u09b6\u09bf \u099a\u09be\u09b0\u09be",
        ],
    },
    "ufra": {
        parts: ["stem", "panicle", "leaf"],
        keywords: [
            "ufra", "nematode", "twisted leaves", "poor panicle emergence", "stem problem",
            "\u09aa\u09be\u09a4\u09be \u09ae\u09cb\u099a\u09dc\u09be\u09a8\u09cb", "\u09b6\u09c0\u09b7 \u09a8\u09be \u0986\u09b8\u09be", "\u0995\u09c3\u09ae\u09bf",
        ],
    },
    "root-knot": {
        parts: ["root", "whole plant"],
        keywords: [
            "root knot", "root galls", "root swelling", "nematode", "root problem",
            "\u09b6\u09bf\u0995\u09dc\u09c7 \u0997\u09bf\u09df\u09be\u099f", "\u09ae\u09c2\u09b2 \u09b0\u09cb\u0997",
        ],
    },
    "khaira": {
        parts: ["leaf", "whole plant"],
        keywords: [
            "khaira", "zinc deficiency", "rusty brown patches", "stunted growth",
            "\u09ae\u09b0\u099a\u09c7 \u09a6\u09be\u0997", "\u09a6\u09b8\u09cd\u09a4\u09be \u0998\u09be\u099f\u09cd\u099f\u09bf",
        ],
    },
    "iron-toxicity": {
        parts: ["leaf", "root"],
        keywords: [
            "bronzing", "iron toxicity", "purplish brown leaves", "acidic soil",
            "\u09ae\u09b0\u099a\u09c7", "\u09b2\u09cb\u09b9\u09be \u09ac\u09c7\u09b6\u09bf",
        ],
    },
};

for (const d of diseaseLibrary) {
    const k = farmerKeywords[d.id] || { parts: [], keywords: [] };
    d.affectedPart = k.parts;
    d.keywords = k.keywords;
}

/*
 * Local, instant search across EVERY farmer-facing field:
 * name · scientificName · category · symptoms · preview ·
 * affectedPart · keywords. Pure string matching on the existing dataset —
 * no API calls, no diagnosis claims (spec §Performance / §Safety).
 *
 * Matching rules (farmer-friendly, §Fuzzy / Partial):
 *   1. full phrase substring hit → always matches
 *   2. otherwise single-word queries match as partial substrings
 *      ("bla"/"she"/"brown"), while multi-word queries need at
 *      least TWO of the words to appear — so "yellow leaf" stays
 *      precise instead of matching every leaf disease
 * Results are ranked by how many query words matched.
 */
const normalizeSearch = (s) =>
    String(s)
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, " ")
        .replace(/\s+/g, " ")
        .trim();

const searchIndex = new Map(
    diseaseLibrary.map((d) => [
        d.id,
        normalizeSearch(
            [
                d.name,
                d.scientificName,
                d.category,
                d.harmLevel,
                d.preview || "",
                ...(d.symptoms || []),
                ...(d.affectedPart || []),
                ...(d.keywords || []),
            ].join(" \u00b7 ")
        ),
    ])
);

export function searchDiseases(query) {
    const q = normalizeSearch(query);
    if (!q) return [...diseaseLibrary];
    const words = q.split(" ").filter(Boolean);
    const needed = words.length === 1 ? 1 : 2;
    const scored = [];
    for (const d of diseaseLibrary) {
        const hay = searchIndex.get(d.id) || "";
        if (hay.includes(q)) {
            scored.push([d, words.length]);
            continue;
        }
        const hits = words.filter((w) => hay.includes(w)).length;
        if (hits >= needed) scored.push([d, hits]);
    }
    return scored.sort((a, b) => b[1] - a[1]).map(([d]) => d);
}
