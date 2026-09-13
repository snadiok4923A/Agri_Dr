/*
 * Rice variety discovery dataset — seeded from rice.txt
 * ("A Comprehensive Guide to Paddy Farming in India").
 *
 * Data rules (do not break these):
 *  - Exact numbers appear ONLY where rice.txt supports them:
 *      · Common non-basmati group economics (cost ₹17,500–24,500/acre,
 *        yield 20–25 q/acre, MSP ≈ ₹2,300/q, revenue ₹46,000–57,500,
 *        profit ₹25,000–30,000)
 *      · Basmati: price ₹3,500–4,500+/q, yield 18–20 q/acre,
 *        profit ₹40,000–50,000+/acre (revenue = derived arithmetic)
 *      · Black rice: yield 10–12 q/acre, milled price ₹150–300/kg,
 *        profit ₹60,000–80,000+/acre
 *      · GI-tagged (Gobindobhog, Kalanamak): 50–80% above common paddy
 *    Anything else stays `null` and renders as an em-dash "—".
 *  - Water / fertilizer / pesticide levels are qualitative and indicative,
 *    derived from the source's qualitative statements (e.g. PR 126
 *    "matures quickly, saving water and time"; the most-farmed group is
 *    "resilient to diseases"; Pokkali is saltwater-tolerant).
 *  - `variant` picks the illustration's grain design (PaddyIcon) so each
 *    variety visually matches its real grain character.
 *  - `status` / `statusTone` are NEVER hand-assigned — they are derived
 *    from the data below by deriveBadge() at export time.
 *  - `tags` drive the filter chips: premium | profit | demand | quick.
 *    "Low Input" is computed from the input levels at render time.
 */

// Shared economics blocks straight from rice.txt
const COMMON_ECON = {
    price: { label: "≈₹2,300", per: "/Q", note: "MSP" },
    yieldQ: { label: "20–25", per: "Q/acre" },
    cost: { label: "₹17.5–24.5K", per: "/acre" },
    revenue: { label: "₹46–57.5K", per: "/acre" },
    profit: { label: "₹25–30K", per: "/acre" },
};

const BASMATI_ECON = {
    price: { label: "₹3,500–4,500+", per: "/Q", note: "open market" },
    yieldQ: { label: "18–20", per: "Q/acre" },
    cost: null,
    revenue: { label: "₹63–90K", per: "/acre", note: "derived" },
    profit: { label: "₹40–50K+", per: "/acre" },
};

const BASMATI_INPUTS = { water: "Medium", fertilizer: "Medium", pesticide: "Low" };
const COMMON_INPUTS = { water: "High", fertilizer: "Medium", pesticide: "Low" };
const NICHE_INPUTS = { water: "Medium", fertilizer: "Low", pesticide: "Low" };

const RAW_VARIETIES = [
    // ==================== BASMATI (aromatic long-grain) ====================
    {
        id: "pusa-1121",
        name: "Pusa 1121",
        group: "basmati",
        tone: "gold",
        variant: "basmati",
        ...BASMATI_ECON,
        inputs: BASMATI_INPUTS,
        region: "Punjab · Haryana · W. UP · Uttarakhand",
        duration: null,
        method: "Transplanting / DSR",
        soil: null,
        market: {
            demand: "High — export driven",
            pricePos: "₹3,500–4,500+/Q",
            profit: "₹40,000–50,000+ /acre",
        },
        tags: ["premium", "profit"],
    },
    {
        id: "pusa-1509",
        name: "Pusa 1509",
        group: "basmati",
        tone: "gold",
        variant: "basmati",
        ...BASMATI_ECON,
        inputs: BASMATI_INPUTS,
        region: "Punjab · Haryana · W. UP · Uttarakhand",
        duration: null,
        method: "Transplanting / DSR",
        soil: null,
        market: {
            demand: "High — export driven",
            pricePos: "₹3,500–4,500+/Q",
            profit: "₹40,000–50,000+ /acre",
        },
        tags: ["premium", "profit"],
    },
    {
        id: "pusa-1718",
        name: "Pusa 1718",
        group: "basmati",
        tone: "gold",
        variant: "basmati",
        ...BASMATI_ECON,
        inputs: BASMATI_INPUTS,
        region: "Punjab · Haryana · W. UP · Uttarakhand",
        duration: null,
        method: "Transplanting / DSR",
        soil: null,
        market: {
            demand: "Medium — export",
            pricePos: "₹3,500–4,500+/Q",
            profit: "₹40,000–50,000+ /acre",
        },
        tags: ["premium"],
    },
    {
        id: "traditional-basmati",
        name: "Traditional Basmati",
        group: "basmati",
        tone: "gold",
        variant: "basmati",
        ...BASMATI_ECON,
        inputs: BASMATI_INPUTS,
        region: "Punjab · Haryana · W. UP · Uttarakhand",
        duration: null,
        method: "Transplanting / DSR",
        soil: null,
        market: {
            demand: "High — export driven",
            pricePos: "₹3,500–4,500+/Q",
            profit: "₹40,000–50,000+ /acre",
        },
        tags: ["premium"],
    },

    // ==================== COMMON NON-BASMATI (high volume) ====================
    {
        id: "sona-masuri",
        name: "Sona Masuri",
        group: "common",
        tone: "leaf",
        variant: "white",
        ...COMMON_ECON,
        inputs: COMMON_INPUTS,
        region: "South India",
        duration: null,
        method: "Transplanting / DSR",
        soil: null,
        market: {
            demand: "High — heavily grown in the South",
            pricePos: "≈MSP ₹2,300/Q",
            profit: "₹25,000–30,000 /acre",
        },
        tags: ["demand"],
    },
    {
        id: "ponni",
        name: "Ponni",
        group: "common",
        tone: "leaf",
        variant: "white",
        ...COMMON_ECON,
        inputs: COMMON_INPUTS,
        region: "South India",
        duration: null,
        method: "Transplanting / DSR",
        soil: null,
        market: {
            demand: "High — South India staple",
            pricePos: "≈MSP ₹2,300/Q",
            profit: "₹25,000–30,000 /acre",
        },
        tags: ["demand"],
    },
    {
        id: "ir64",
        name: "IR64",
        group: "common",
        tone: "leaf",
        variant: "common",
        ...COMMON_ECON,
        inputs: COMMON_INPUTS,
        region: "Nationwide",
        duration: null,
        method: "Transplanting / DSR",
        soil: null,
        market: {
            demand: "Very High — public distribution + export",
            pricePos: "≈MSP ₹2,300/Q",
            profit: "₹25,000–30,000 /acre",
        },
        tags: ["demand"],
    },
    {
        id: "swarna",
        name: "Swarna",
        aka: "MTU 7029",
        group: "common",
        tone: "leaf",
        variant: "golden",
        ...COMMON_ECON,
        inputs: COMMON_INPUTS,
        region: "Eastern & Southern India",
        duration: null,
        method: "Transplanting / DSR",
        soil: null,
        market: {
            demand: "Very High — extremely popular, high yield",
            pricePos: "≈MSP ₹2,300/Q",
            profit: "₹25,000–30,000 /acre",
        },
        tags: ["demand"],
    },
    {
        id: "bpt-5204",
        name: "BPT 5204",
        aka: "Samba Mahsuri",
        group: "common",
        tone: "leaf",
        variant: "fine",
        ...COMMON_ECON,
        inputs: COMMON_INPUTS,
        region: "Andhra Pradesh · Telangana",
        duration: null,
        method: "Transplanting / DSR",
        soil: null,
        market: {
            demand: "High — fine grain & taste",
            pricePos: "≈MSP ₹2,300/Q",
            profit: "₹25,000–30,000 /acre",
        },
        tags: ["demand"],
    },
    {
        id: "pr-126",
        name: "PR 126",
        group: "common",
        tone: "leaf",
        variant: "common",
        ...COMMON_ECON,
        inputs: { water: "Low", fertilizer: "Medium", pesticide: "Low" },
        region: "Punjab",
        duration: { label: "Short", note: "early maturity" },
        method: "Transplanting / DSR",
        soil: null,
        market: {
            demand: "Very High — Punjab favourite",
            pricePos: "≈MSP ₹2,300/Q",
            profit: "₹25,000–30,000 /acre",
        },
        tags: ["demand", "quick"],
    },

    // ==================== REGIONAL / NICHE / SPECIALTY ====================
    {
        id: "black-rice",
        name: "Black Rice",
        aka: "Chak Hao",
        group: "specialty",
        tone: "teal",
        variant: "black",
        price: { label: "₹15–30K", per: "/Q", note: "milled" },
        yieldQ: { label: "10–12", per: "Q/acre" },
        cost: null,
        revenue: null,
        profit: { label: "₹60–80K+", per: "/acre" },
        inputs: { water: "Medium", fertilizer: "Low", pesticide: "Low" },
        region: "Manipur · Northeast",
        duration: null,
        method: "Traditional, specific conditions",
        soil: null,
        market: {
            demand: "High — urban & organic buyers",
            pricePos: "₹150–300/kg milled",
            profit: "₹60,000–80,000+ /acre",
        },
        tags: ["premium", "profit"],
    },
    {
        id: "red-rice-matta",
        name: "Red Rice",
        aka: "Matta",
        group: "specialty",
        tone: "teal",
        variant: "red",
        price: null,
        yieldQ: null,
        cost: null,
        revenue: null,
        profit: null,
        inputs: NICHE_INPUTS,
        region: "Kerala",
        duration: null,
        method: "Traditional",
        soil: null,
        market: {
            demand: "Medium — Kerala staple",
            pricePos: null,
            profit: null,
        },
        tags: [],
    },
    {
        id: "gobindobhog",
        name: "Gobindobhog",
        group: "specialty",
        tone: "gold",
        variant: "whiteGold",
        price: { label: "₹3.4–4.1K", per: "/Q", note: "GI premium (est.)" },
        yieldQ: null,
        cost: null,
        revenue: null,
        profit: null,
        inputs: NICHE_INPUTS,
        region: "West Bengal",
        duration: null,
        method: "Traditional",
        soil: null,
        market: {
            demand: "High — festivals & premium dining",
            pricePos: "50–80% above common paddy",
            profit: null,
        },
        tags: ["premium", "demand"],
    },
    {
        id: "kalanamak",
        name: "Kalanamak",
        aka: "Buddha's rice",
        group: "specialty",
        tone: "teal",
        variant: "darkHusk",
        price: { label: "₹3.4–4.1K", per: "/Q", note: "GI premium (est.)" },
        yieldQ: null,
        cost: null,
        revenue: null,
        profit: null,
        inputs: NICHE_INPUTS,
        region: "Terai, UP",
        duration: null,
        method: "Traditional, limited region",
        soil: null,
        market: {
            demand: "Medium — premium niche",
            pricePos: "50–80% above common paddy",
            profit: null,
        },
        tags: ["premium"],
    },
    {
        id: "joha",
        name: "Joha",
        group: "specialty",
        tone: "teal",
        variant: "paleGold",
        price: null,
        yieldQ: null,
        cost: null,
        revenue: null,
        profit: null,
        inputs: NICHE_INPUTS,
        region: "Assam",
        duration: null,
        method: "Traditional",
        soil: null,
        market: {
            demand: "Medium — regional aromatic",
            pricePos: null,
            profit: null,
        },
        tags: [],
    },
    {
        id: "navara",
        name: "Navara",
        group: "specialty",
        tone: "teal",
        variant: "navara",
        price: null,
        yieldQ: null,
        cost: null,
        revenue: null,
        profit: null,
        inputs: NICHE_INPUTS,
        region: "Kerala",
        duration: null,
        method: "Traditional, limited scale",
        soil: null,
        market: {
            demand: "Low — medicinal niche",
            pricePos: null,
            profit: null,
        },
        tags: [],
    },
    {
        id: "pokkali",
        name: "Pokkali",
        group: "specialty",
        tone: "teal",
        variant: "pokkali",
        price: null,
        yieldQ: null,
        cost: null,
        revenue: null,
        profit: null,
        inputs: { water: "Low", fertilizer: "Low", pesticide: "Low" },
        region: "Coastal Kerala",
        duration: null,
        method: "Saline tidal (traditional)",
        soil: "Saline coastal",
        market: {
            demand: "Low — regional niche",
            pricePos: null,
            profit: null,
        },
        tags: [],
    },
];

/* ================================================================
 * BADGE DERIVATION — computed from the data above, never hand-set.
 * Priority: farm-calendar facts → economics → demand → niche status.
 * ================================================================ */

/* Largest number in a label, normalized to ₹K ("₹3,500–4,500+" → 4.5,
 * "₹60–80K+" → 80, "≈₹2,300" → 2.3). Returns 0 when absent. */
function upperNum(label) {
    if (!label) return 0;
    const nums = (String(label).match(/\d[\d,.]*/g) || [])
        .map((n) => parseFloat(n.replace(/,/g, "")))
        .filter((n) => !Number.isNaN(n));
    if (!nums.length) return 0;
    const max = Math.max(...nums);
    return max > 500 ? max / 1000 : max; // ₹ → ₹K
}

function deriveBadge(v) {
    const priceK = upperNum(v.price?.label); // ₹K / quintal
    const profitK = upperNum(v.profit?.label); // ₹K / acre
    const demand = (v.market?.demand || "").toLowerCase();
    const gi =
        /GI/i.test(v.price?.note || "") ||
        /above common/i.test(v.market?.pricePos || "");

    if (v.duration?.label === "Short" || v.tags?.includes("quick"))
        return "Quick Harvest"; // early maturity dominates the calendar
    if (profitK >= 55) return "High Profit"; // black-rice class economics
    if (gi) return "Premium"; // GI-tagged, commands above-common price
    if (priceK >= 3.4 && demand.includes("export") && demand.includes("high"))
        return "Trending"; // export-grade premium price + strong demand
    if (priceK >= 3.4) return "Premium"; // premium price, calmer demand
    if (profitK >= 40) return "High Profit";
    if (demand.startsWith("very high"))
        return "Best Value"; // max volume at MSP economics
    if (demand.startsWith("high")) return "High Demand";
    if (v.group === "specialty") return "Niche"; // no economics, limited market
    return "Good";
}

const BADGE_TONE = {
    "High Profit": "leaf",
    "Best Value": "leaf",
    Trending: "gold",
    Premium: "gold",
    "High Demand": "info",
    "Quick Harvest": "info",
    Good: "muted",
    Niche: "violet",
    "Low Margin": "danger",
};

export const riceVarieties = RAW_VARIETIES.map((v) => {
    const status = deriveBadge(v);
    return { ...v, status, statusTone: BADGE_TONE[status] || "muted" };
});

// Filter chips — "Low Input" is derived from input levels, not tags
export const cropFilters = [
    { id: "all", label: "All" },
    { id: "profit", label: "High Profit" },
    { id: "demand", label: "High Demand" },
    { id: "premium", label: "Premium" },
    { id: "quick", label: "Quick Harvest" },
    { id: "low-input", label: "Low Input" },
];
