/**
 * geocodingService.js — coordinates → human-readable place (city + state).
 *
 * The browser Geolocation API yields numbers, not names. The Weather floating
 * window shows a small two-line location caption ("Kolaghat" / "West Bengal")
 * under its close button; this service turns the coordinates the weather
 * pipeline ALREADY obtained into those two lines.
 *
 * Provider: BigDataCloud's free client-side reverse-geocoding endpoint —
 * no API key, no registration, HTTPS, CORS-enabled, so it works from the
 * static GitHub Pages deployment (spec §22). Coordinates travel only as the
 * query parameters of this one lookup and are never persisted (spec §23);
 * the in-memory cache below lives for the page session only.
 *
 * Failure contract: ANY problem — offline, HTTP error, malformed payload,
 * missing fields — resolves to `null`. The caller simply hides the caption;
 * nothing placeholder, hardcoded, or fake is ever shown.
 *
 * `language` is forwarded as `localityLanguage`, so the caption follows the
 * selected UI language where the provider has a translation (e.g. Bengali);
 * the provider falls back to English on its own when it doesn't.
 */

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // a locality rarely changes — day-long session cache

/** "lat,lng:lang" → { at, place }. Successes only; failures stay uncached so a
 *  transient network blip retries on the next modal open instead of sticking. */
const cache = new Map();
/** In-flight requests by key — repeated opens/l language toggles coalesce. */
const pending = new Map();

function cacheKey({ latitude, longitude, language }) {
    return `${latitude.toFixed(4)},${longitude.toFixed(4)}:${language || "en"}`;
}

/** Extract { line1, line2 } from the provider payload, or null if unusable. */
function pickPlaceName(data) {
    const clean = (v) => (typeof v === "string" ? v.trim() : "");
    const city = clean(data?.city) || clean(data?.locality);
    const state = clean(data?.principalSubdivision);
    const line1 = city || state;
    if (!line1) return null;
    const line2 = state && state !== line1 ? state : "";
    return { line1, line2 };
}

/**
 * reverseGeocode — resolves { line1, line2 } for the given coordinates,
 * or null when the name cannot be determined. Never throws.
 *
 * @param {{ latitude: number, longitude: number, language?: string }} params
 */
export async function reverseGeocode({ latitude, longitude, language = "en" } = {}) {
    if (
        typeof latitude !== "number" ||
        typeof longitude !== "number" ||
        Number.isNaN(latitude) ||
        Number.isNaN(longitude)
    ) {
        return null;
    }

    const key = cacheKey({ latitude, longitude, language });
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.place;
    if (pending.has(key)) return pending.get(key);

    const request = (async () => {
        try {
            const url =
                `https://api.bigdatacloud.net/data/reverse-geocode-client` +
                `?latitude=${latitude}&longitude=${longitude}` +
                `&localityLanguage=${encodeURIComponent(language)}`;
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const place = pickPlaceName(await res.json());
            if (place) cache.set(key, { at: Date.now(), place });
            return place;
        } catch (err) {
            console.log(`Reverse geocoding unavailable: ${err?.message || err}`);
            return null; // caller hides the caption — no fake names (§13)
        } finally {
            pending.delete(key);
        }
    })();

    pending.set(key, request);
    return request;
}
