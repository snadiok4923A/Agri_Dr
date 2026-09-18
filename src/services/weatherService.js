/**
 * weatherService.js — the ONLY place the app talks to Open-Meteo.
 *
 * Client-side only (GitHub Pages safe): plain fetch, no key, no backend,
 * no proxy. Coordinates arrive from locationService and are sent nowhere
 * else (spec §22/§23).
 *
 * Normalized shape consumed by the Weather Card / modal / voice system
 * (mirrors the legacy mockData.weatherData fields so every existing
 * consumer keeps working):
 *   current: { temperature, feelsLike, humidity, rainProbability, wind,
 *              visibility, code, conditionKey }
 *   forecast: [{ date, day, high, low, rain, conditionKey }]
 *   meta: { fetchedAt, latitude, longitude, timezone }
 */

const API_URL = "https://api.open-meteo.com/v1/forecast";

/** Sane guard against malformed responses reaching the UI (spec §11). */
const isNum = (n) => typeof n === "number" && Number.isFinite(n);
const num = (v, fallback = null) => (isNum(v) ? v : fallback);

/**
 * WMO weather interpretation codes (spec §5) → stable condition keys.
 * conditionKey feeds both the icon illustration and the translated label.
 */
export function wmoCondition(code) {
    const c = num(code, 0);
    if (c === 0) return "clear";
    if (c === 1) return "mainlyClear";
    if (c === 2) return "partlyCloudy";
    if (c === 3) return "overcast";
    if (c === 45 || c === 48) return "fog";
    if (c >= 51 && c <= 55) return "drizzle";
    if (c === 56 || c === 57) return "freezingDrizzle";
    if (c >= 61 && c <= 65) return "rain";
    if (c === 66 || c === 67) return "freezingRain";
    if (c >= 71 && c <= 75) return "snowfall";
    if (c === 77) return "snowGrains";
    if (c >= 80 && c <= 82) return "rainShowers";
    if (c === 85 || c === 86) return "snowShowers";
    if (c === 95) return "thunderstorm";
    if (c === 96 || c === 99) return "thunderstormHail";
    return "partlyCloudy";
}

/** Day names for the 7-day strip — "Today"/"Tomorrow" stay keys so they translate. */
function dayKey(dateStr, index) {
    if (index === 0) return "today";
    if (index === 1) return "tomorrow";
    const d = new Date(`${dateStr}T12:00:00`);
    return Number.isNaN(d.getTime())
        ? ""
        : ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][d.getDay()];
}

let memoryCache = null; // module-level: survives route changes, not reloads

/**
 * fetchWeather — one Open-Meteo request per refresh, coordinates-based.
 * @param {{ latitude: number, longitude: number }} coords
 * @param {{ force?: boolean, maxAgeMs?: number }} opts
 * @returns {Promise<object>} normalized weather (rejects on network/API error)
 */
export async function fetchWeather({ latitude, longitude }, { force = false, maxAgeMs = 10 * 60 * 1000 } = {}) {
    if (
        !isNum(latitude) ||
        !isNum(longitude) ||
        latitude < -90 ||
        latitude > 90 ||
        longitude < -180 ||
        longitude > 180
    ) {
        throw new Error("INVALID_COORDS");
    }

    if (!force && memoryCache && Date.now() - memoryCache.meta.fetchedAt < maxAgeMs) {
        return memoryCache;
    }

    const params = new URLSearchParams({
        latitude: String(latitude),
        longitude: String(longitude),
        // Current block (spec §3)
        current:
            "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation," +
            "weather_code,cloud_cover,wind_speed_10m,wind_direction_10m",
        // Daily block — 7 days for the existing forecast UI
        daily:
            "weather_code,temperature_2m_max,temperature_2m_min," +
            "precipitation_probability_max,wind_speed_10m_max",
        temperature_unit: "celsius",
        wind_speed_unit: "kmh",
        precipitation_unit: "mm",
        timezone: "auto",
        forecast_days: "7",
    });

    let res;
    try {
        res = await fetch(`${API_URL}?${params.toString()}`);
    } catch {
        throw new Error("NETWORK_ERROR");
    }
    if (!res.ok) throw new Error(`API_ERROR_${res.status}`);

    const data = await res.json();
    const cur = data?.current || {};
    const daily = data?.daily || {};
    const temperature = num(cur.temperature_2m);
    const humidity = num(cur.relative_humidity_2m);
    const wind = num(cur.wind_speed_10m);
    if (temperature === null) throw new Error("API_MALFORMED");

    // Visibility: Open-Meteo's free forecast block doesn't expose it;
    // estimate a clear value from cloud cover so nothing displays NaN.
    const cloudCover = num(cur.cloud_cover, 50);
    const visibility = Math.round((24 - (cloudCover / 100) * 16) * 10) / 10;

    const code = num(cur.weather_code, 0);
    const dates = Array.isArray(daily.time) ? daily.time : [];

    const weather = {
        current: {
            temperature,
            feelsLike: num(cur.apparent_temperature, temperature),
            humidity: humidity ?? 0,
            rainProbability: num(
                Array.isArray(daily.precipitation_probability_max)
                    ? daily.precipitation_probability_max[0]
                    : null,
                0,
            ),
            wind: wind ?? 0,
            visibility,
            code,
            conditionKey: wmoCondition(code),
            isDay: cur.is_day !== 0,
        },
        forecast: dates.slice(0, 7).map((date, i) => {
            const dCode = num(daily.weather_code?.[i], 0);
            return {
                date,
                day: dayKey(date, i),
                high: num(daily.temperature_2m_max?.[i]),
                low: num(daily.temperature_2m_min?.[i]),
                rain: num(daily.precipitation_probability_max?.[i], 0),
                wind: num(daily.wind_speed_10m_max?.[i]),
                conditionKey: wmoCondition(dCode),
            };
        }),
        meta: {
            fetchedAt: Date.now(),
            latitude,
            longitude,
            timezone: data?.timezone || "auto",
        },
    };

    memoryCache = weather;
    return weather;
}

/**
 * getCachedWeather — the last successful weather (or null). Lets non-React
 * modules (e.g. the voice command executor) read the SAME live values the
 * UI shows, so temperature/humidity/wind are always from one response.
 */
export function getCachedWeather() {
    return memoryCache;
}
