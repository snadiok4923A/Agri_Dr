/**
 * diseaseLibrary.js — the Rice Disease Library dataset.
 *
 * Derived STRICTLY from the app's existing `diseaseData` (mockData.js) —
 * every medicine, dose, coverage, cost, symptom and variety below comes
 * from that source. Nothing agricultural is invented here.
 *
 * Presentation-only transforms:
 *   · "Leaf Blast (Magnaporthe oryzae)" → common name + scientific name
 *   · severity  → friendly harm level (Low / Moderate / High / Critical)
 *   · symptoms sentence → 2–4 short symptom bullets (same wording)
 *   · dosage parenthetical "250 g for 1.8 ac" → coverage value
 */

export const diseaseLibrary = [
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
];

/** Filters the existing data actually supports (All / type / high-risk). */
export const diseaseFilters = [
    { id: "all", label: "All" },
    { id: "high", label: "High Risk" },
    { id: "fungal", label: "Fungal" },
    { id: "pest", label: "Pest" },
];

export function matchesDiseaseFilter(disease, filterId) {
    if (filterId === "all") return true;
    if (filterId === "high")
        return disease.harmLevel === "Critical" || disease.harmLevel === "Moderate";
    return disease.category === filterId;
}
