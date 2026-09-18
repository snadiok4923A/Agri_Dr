/*
 * Market Intelligence data layer — the ONLY place price records live.
 *
 * Kept separate from the UI (spec: "Clearly separate data layer from UI
 * components"): the Market page just maps over `marketPrices` and renders
 * fields. Swapping in a live mandi-rate API later means replacing this
 * module's export — no component changes.
 *
 * Records follow the AGMARKNET-style mandi-rate shape used across India:
 *   marketPrice → the latest quoted price at the market centre,
 *   modalPrice  → the most-traded (mode) price of the session.
 * Values are seeded from the app's existing demo price scale
 * (₹3,280–5,200/Q for the four farmed varieties) and realistic mandi
 * centres; they are display data, not a live feed.
 *
 * Images reuse the exact per-variety assets in public/crops/ (same
 * mapping as the Rice Varieties page). `image: null` varieties fall
 * back to the shared rice illustration at render time.
 */

// Mandi centres by district (real West Bengal / South-India market towns)
const M = {
    burdwan: {
        market: "Burdwan Mandi",
        state: "West Bengal",
        district: "Purba Bardhaman",
    },
    memari: {
        market: "Memari APMC",
        state: "West Bengal",
        district: "Purba Bardhaman",
    },
    kolkata: {
        market: "Kolkata Wholesale APMC",
        state: "West Bengal",
        district: "North 24 Parganas",
    },
    durgapur: {
        market: "Durgapur Agro Hub",
        state: "West Bengal",
        district: "Paschim Bardhaman",
    },
    bangaon: {
        market: "Bangaon APMC",
        state: "West Bengal",
        district: "North 24 Parganas",
    },
    guskara: {
        market: "Guskara Market",
        state: "West Bengal",
        district: "Purba Bardhaman",
    },
    bangalore: {
        market: "Bengaluru APMC",
        state: "Karnataka",
        district: "Bengaluru Urban",
    },
    kurnool: {
        market: "Kurnool Market",
        state: "Andhra Pradesh",
        district: "Kurnool",
    },
    thanjavur: {
        market: "Thanjavur Mandi",
        state: "Tamil Nadu",
        district: "Thanjavur",
    },
    imphal: {
        market: "Imphal Ima Market",
        state: "Manipur",
        district: "Imphal West",
    },
};

export const marketPrices = [
    // ==================== The farmer's own varieties first ====================
    {
        id: "basmati-1121",
        name: "Basmati 1121",
        image: "/crops/Pusa_1121.jpg",
        marketPrice: 5200,
        modalPrice: 5150,
        unit: "Quintal",
        ...M.kolkata,
    },
    {
        id: "ir64",
        name: "IR-64",
        image: "/crops/IR64.jpg",
        marketPrice: 3420,
        modalPrice: 3380,
        unit: "Quintal",
        ...M.burdwan,
    },
    {
        id: "swarna",
        name: "Swarna",
        image: "/crops/Swarna.jpg",
        marketPrice: 3280,
        modalPrice: 3250,
        unit: "Quintal",
        ...M.burdwan,
    },
    {
        id: "samba-mahsuri",
        name: "Samba Mahsuri",
        image: "/crops/BPT_5204.jpg",
        marketPrice: 3600,
        modalPrice: 3550,
        unit: "Quintal",
        ...M.durgapur,
    },

    // ==================== Other varieties (browsable directory) ====================
    {
        id: "pusa-1509",
        name: "Pusa 1509",
        image: "/crops/Pusa_1509.jpg",
        marketPrice: 5450,
        modalPrice: 5400,
        unit: "Quintal",
        ...M.kolkata,
    },
    {
        id: "pusa-1718",
        name: "Pusa 1718",
        image: "/crops/Pusa_1718.jpg",
        marketPrice: 5100,
        modalPrice: 5050,
        unit: "Quintal",
        ...M.kolkata,
    },
    {
        id: "traditional-basmati",
        name: "Traditional Basmati",
        image: "/crops/Traditional_Basmati.jpg",
        marketPrice: 6800,
        modalPrice: 6700,
        unit: "Quintal",
        ...M.kolkata,
    },
    {
        id: "sona-masuri",
        name: "Sona Masuri",
        image: "/crops/Sona_Masuri.jpg",
        marketPrice: 4150,
        modalPrice: 4100,
        unit: "Quintal",
        ...M.bangalore,
    },
    {
        id: "ponni",
        name: "Ponni",
        image: "/crops/Ponni.jpg",
        marketPrice: 3900,
        modalPrice: 3850,
        unit: "Quintal",
        ...M.thanjavur,
    },
    {
        id: "pr-126",
        name: "PR 126",
        image: "/crops/PR_126.jpg",
        marketPrice: 3350,
        modalPrice: 3300,
        unit: "Quintal",
        ...M.memari,
    },
    {
        id: "black-rice",
        name: "Black Rice",
        image: "/crops/black_rice.jpg",
        marketPrice: 18500,
        modalPrice: 18200,
        unit: "Quintal",
        ...M.imphal,
    },
    {
        id: "red-rice",
        name: "Red Rice",
        image: "/crops/Red_Rice.jpg",
        marketPrice: 4600,
        modalPrice: 4550,
        unit: "Quintal",
        ...M.thanjavur,
    },
    {
        id: "gobindobhog",
        name: "Gobindobhog",
        image: "/crops/Gobindobhog.jpg",
        marketPrice: 4050,
        modalPrice: 4000,
        unit: "Quintal",
        ...M.burdwan,
    },
    {
        id: "kalanamak",
        name: "Kalanamak",
        image: "/crops/Kalanamak.jpg",
        marketPrice: 4250,
        modalPrice: 4200,
        unit: "Quintal",
        ...M.memari,
    },
    {
        id: "joha",
        name: "Joha",
        image: "/crops/Joha.jpg",
        marketPrice: 5600,
        modalPrice: 5500,
        unit: "Quintal",
        ...M.guskara,
    },
    {
        id: "navara",
        name: "Navara",
        image: "/crops/Navara.jpg",
        marketPrice: 7400,
        modalPrice: 7200,
        unit: "Quintal",
        ...M.thanjavur,
    },
    {
        id: "pokkali",
        name: "Pokkali",
        image: "/crops/Pokkali.jpg",
        marketPrice: 4300,
        modalPrice: 4250,
        unit: "Quintal",
        ...M.thanjavur,
    },
    {
        id: "bpt-5204",
        name: "BPT 5204",
        image: "/crops/BPT_5204.jpg",
        marketPrice: 3800,
        modalPrice: 3760,
        unit: "Quintal",
        ...M.kurnool,
    },
    {
        id: "bangaon-common",
        name: "Common Paddy",
        image: null, // no dedicated asset → shared rice illustration fallback
        marketPrice: 3100,
        modalPrice: 3060,
        unit: "Quintal",
        ...M.bangaon,
    },
];

/*
 * Simple filter chips (spec §Filters: minimal). `match` receives the
 * record; keep predicates narrow so chips stay predictable.
 */
export const marketFilters = [
    { id: "all", label: "All", match: () => true },
    { id: "basmati", label: "Basmati", match: (r) => /basmati|1121|1509|1718/i.test(r.name) },
    { id: "traditional", label: "Traditional", match: (r) => /traditional|gobindobhog|kalanamak|joha|navara|pokkali|black|red/i.test(r.name) },
    { id: "premium", label: "Premium", match: (r) => r.marketPrice >= 5000 },
    { id: "other", label: "Other", match: (r) => !/basmati|1121|1509|1718|traditional|gobindobhog|kalanamak|joha|navara|pokkali|black|red/i.test(r.name) },
];
