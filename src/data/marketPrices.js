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
 * Price history (modal-price trend) per variety.
 *
 * There is no historical price API wired up yet, so each series is
 * DERIVED deterministically from the record's current min/modal/max:
 * a small seeded walk around modalPrice whose values stay within
 * [minPrice, maxPrice] and whose LAST point is exactly today's
 * modalPrice. Because the seed comes from the record id, the same
 * variety always yields the same series (no fake random jitter between
 * renders). When a real history feed lands, replace this function's
 * body — the UI contract ({date, minPrice, modalPrice, maxPrice}[]) is
 * already the AGMARKNET daily-record shape.
 */
const hashSeed = (str) => {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return (h >>> 0) / 4294967295;
};

export function buildPriceHistory(record, days = 30) {
    const min = record.minPrice ?? Math.round(record.modalPrice * 0.965);
    const max = record.maxPrice ?? Math.round(record.modalPrice * 1.035);
    const span = max - min;
    const seed = hashSeed(record.id);
    const phase = seed * Math.PI * 2;
    const amp = span * (0.28 + seed * 0.18); // gentle drift inside the band
    const period = 5 + Math.round(seed * 4); // 5–9 day cycle

    const points = [];
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    for (let i = days - 1; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const t = days - 1 - i; // 0..days-1
        // smooth walk inside the band; both endpoints sit exactly on today's
        // modal price (envelope = 0), amplitude peaks mid-series
        const envelope = Math.sin((Math.PI * t) / (days - 1));
        const raw =
            record.modalPrice -
            amp * Math.sin(phase + (t / period) * Math.PI * 2) * envelope;
        const value = Math.round(
            Math.min(max, Math.max(min, raw))
        );
        points.push({
            date: d.toISOString().slice(0, 10),
            minPrice: min,
            modalPrice: value,
            maxPrice: max,
        });
    }
    points[points.length - 1] = {
        ...points[points.length - 1],
        modalPrice: record.modalPrice,
    };
    return points;
}

/*
 * §18 data validation: every record must satisfy min ≤ modal ≤ max.
 * Records without explicit min/max get a deterministic band around the
 * modal price (−3.5% / +3.5% — the same band buildPriceHistory uses), so
 * the detail window never shows min = modal = max and the price-history
 * area always has room to move. No invented randomness: pure arithmetic.
 */
for (const r of marketPrices) {
    if (r.minPrice === undefined) r.minPrice = Math.round(r.modalPrice * 0.965);
    if (r.maxPrice === undefined) r.maxPrice = Math.round(r.modalPrice * 1.035);
}

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
