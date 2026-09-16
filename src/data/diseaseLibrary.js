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

/**
 * Filters: severity levels (per the provided list) + the type filters the
 * original data supported. Viral / nematode / nutritional diseases are
 * covered by the severity filters.
 */
export const diseaseFilters = [
    { id: "all", label: "All" },
    { id: "critical", label: "Critical" },
    { id: "high", label: "High" },
    { id: "moderate", label: "Moderate" },
    { id: "low", label: "Low" },
    { id: "fungal", label: "Fungal" },
    { id: "bacterial", label: "Bacterial" },
    { id: "pest", label: "Pest" },
];

export function matchesDiseaseFilter(disease, filterId) {
    if (filterId === "all") return true;
    if (["critical", "high", "moderate", "low"].includes(filterId)) {
        return disease.harmLevel.toLowerCase() === filterId;
    }
    return disease.category === filterId;
}
