/*
 * fuzzySearch.js — tiny dependency-free fuzzy matcher for the onboarding
 * rice-variety autocomplete. Deterministic: same input → same ranking,
 * every time. No AI, no network.
 *
 * Scoring tiers (best first):
 *   1. prefix match        "pus"  → "Pusa 1121"
 *   2. substring match     "sona" → "Sona Masuri"
 *   3. fuzzy subsequence   "psa"  → "Pusa 1121" (typo-tolerant)
 *
 * Ties break alphabetically, so short inputs never shuffle.
 */

/** Collapse case + separators so "bpt-5204", "BPT 5204" and "bpt5204" match alike. */
export function normalizeForSearch(text) {
    return String(text ?? "")
        .toLowerCase()
        .replace(/[^a-z0-9\u00c0-\u024f\u0900-\u097f\u0980-\u09ff\u0b80-\u0bff\u0c00-\u0c7f]+/g, " ")
        .trim();
}

/** Longest-common-subsequence length — the classic fuzzy subsequence test. */
function lcsLength(query, target) {
    const rows = Array.from({ length: query.length + 1 }, () =>
        Array.from({ length: target.length + 1 }, () => 0),
    );
    for (let i = 1; i <= query.length; i += 1) {
        for (let j = 1; j <= target.length; j += 1) {
            rows[i][j] = query[i - 1] === target[j - 1]
                ? rows[i - 1][j - 1] + 1
                : Math.max(rows[i - 1][j], rows[i][j - 1]);
        }
    }
    return rows[query.length][target.length];
}

/**
 * Rank `items` against `query`.
 * @param {Array<{item: any, text: string}>} entries — pre-normalized search text per item
 * @param {string} query — raw user input
 * @param {number} limit — max results
 * @returns {Array<any>} ranked items (may be empty)
 */
export function fuzzyRank(entries, query, limit = 8) {
    const q = normalizeForSearch(query);
    if (!q) return [];
    const scored = [];
    for (const { item, text } of entries) {
        if (!text) continue;
        let score;
        if (text.startsWith(q)) {
            score = text === q ? 3 : 2; // exact beats prefix
        } else if (text.includes(q)) {
            score = 1;
        } else {
            const lcs = lcsLength(q, text);
            // Require a solid fraction of the query to appear in order —
            // keeps "zzz" from matching everything.
            if (lcs >= Math.max(2, Math.ceil(q.length * 0.6))) score = 0;
            else continue;
        }
        scored.push({ item, score, name: text });
    }
    scored.sort((a, b) => b.score - a.score || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    return scored.slice(0, limit).map((s) => s.item);
}
