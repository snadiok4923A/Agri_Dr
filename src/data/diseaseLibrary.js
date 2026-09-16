/**
 * diseaseLibrary.js — the Rice Disease Library dataset.
 *
 * Original 3 entries derive from the app's existing `diseaseData`
 * (mockData.js). The 11 newer entries use ONLY the descriptions provided
 * for the library — no medicine, dose, coverage or cost is invented where
 * the app has no data (those fields are simply absent, and the modal
 * points to an agronomist instead).
 *
 * Presentation-only transforms:
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
        cost: "₹1,200",
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
        cost: "₹850",
        symptoms: [
            "Yellowing tillers at the base",
            "Early signs of hopperburn at dense spots",
        ],
        commonIn: ["IR-64"],
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
        cost: "₹650",
        symptoms: [
            "Snake-skin like spots on leaf sheaths",
            "Greenish-grey patches near the water line",
        ],
        commonIn: ["Basmati"],
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
        symptoms: [
            "Small, round brown spots on rice leaves",
            "Can severely affect photosynthesis",
        ],
        preview: "Small round brown spots on leaves.",
    },
    {
        id: "false-smut",
        name: "False Smut",
        scientificName: "Ustilaginoidea virens",
        category: "fungal",
        harmLevel: "Moderate",
        tone: "info",
        art: "smut",
        symptoms: [
            "Individual rice grains are transformed into large spore balls",
            "Velvety green or black in appearance",
        ],
        preview: "Green or black spore balls replace individual grains.",
    },
    {
        id: "bakanae",
        name: "Bakanae / Foot Rot",
        scientificName: "Fusarium fujikuroi",
        category: "fungal",
        harmLevel: "High",
        tone: "warning",
        art: "bakanae",
        symptoms: [
            "Infected rice plants become abnormally tall and thin",
            "Plants eventually die",
        ],
        preview: "Plants become unusually tall and thin.",
    },
    {
        id: "bacterial-leaf-blight",
        name: "Bacterial Leaf Blight (BLB)",
        scientificName: "Xanthomonas oryzae pv. oryzae",
        category: "bacterial",
        harmLevel: "Critical",
        tone: "danger",
        art: "blb",
        symptoms: [
            "Water-soaked streaks appear along leaf blades",
            "Streaks gradually turn yellow, then grayish-white",
        ],
        preview: "Water-soaked leaf streaks turn yellow and grayish-white.",
    },
    {
        id: "bacterial-leaf-streak",
        name: "Bacterial Leaf Streak",
        scientificName: "Xanthomonas oryzae pv. oryzicola",
        category: "bacterial",
        harmLevel: "High",
        tone: "warning",
        art: "bls",
        symptoms: [
            "Narrow translucent streaks appear between the leaf veins",
            "Yellowish-brown in color",
        ],
        preview: "Narrow yellowish-brown streaks between leaf veins.",
    },
    {
        id: "rice-tungro",
        name: "Rice Tungro Disease",
        category: "viral",
        harmLevel: "Critical",
        tone: "danger",
        art: "tungro",
        symptoms: [
            "Plants become severely stunted",
            "Yellow or orange discoloration beginning from the leaf tips",
        ],
        preview: "Severe stunting with yellow-orange leaf discoloration.",
        note: "Transmitted by the Green Leafhopper.",
    },
    {
        id: "rice-yellow-dwarf",
        name: "Rice Yellow Dwarf",
        category: "viral",
        harmLevel: "High",
        tone: "warning",
        art: "yellowdwarf",
        symptoms: [
            "Extreme plant stunting",
            "Excessive tillering creates a grassy, bushy appearance",
        ],
        preview: "Severe stunting with excessive bushy tillering.",
    },
    {
        id: "ufra",
        name: "Ufra Disease",
        category: "nematode",
        harmLevel: "High",
        tone: "warning",
        art: "ufra",
        symptoms: [
            "The stem nematode attacks growing points",
            "Twisted and distorted leaves",
            "Prevents proper panicle emergence",
        ],
        preview: "Twisted leaves and poor panicle emergence.",
    },
    {
        id: "root-knot",
        name: "Root-Knot",
        category: "nematode",
        harmLevel: "Moderate",
        tone: "info",
        art: "rootknot",
        symptoms: [
            "Swelling and galls develop on the roots",
            "Reduces the plant's ability to absorb water and nutrients",
        ],
        preview: "Root swelling and galls reduce nutrient uptake.",
    },
    {
        id: "khaira",
        name: "Khaira Disease",
        category: "nutritional",
        harmLevel: "Moderate",
        tone: "info",
        art: "khaira",
        symptoms: [
            "Rusty brown patches appear on leaves",
            "Stunted plant growth",
        ],
        preview: "Rusty brown leaf patches with stunted growth.",
        note: "Caused by zinc deficiency, particularly associated with flooded soils.",
    },
    {
        id: "iron-toxicity",
        name: "Iron Toxicity",
        category: "nutritional",
        harmLevel: "Moderate",
        tone: "info",
        art: "irontox",
        symptoms: [
            "Leaves develop bronzing or purplish-brown discoloration",
            "Commonly associated with poorly drained acidic soils",
        ],
        preview: "Bronzing or purplish-brown leaf discoloration.",
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
