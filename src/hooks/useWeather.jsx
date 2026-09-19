/**
 * useWeather.jsx — Weather State layer (spec §24).
 *
 * Location Service → Weather Service → this provider → Weather Card.
 * Fetches ONCE on mount (no aggressive polling, spec §14); refreshes only
 * via `refresh()` / `retryLocation()` — both update just the weather state,
 * never reload the page (spec §12/§13). Coordinates stay in memory —
 * never persisted (spec §23).
 *
 * SEPARATED STATES (spec §8/§9 — no single generic loading/error flag):
 *
 *   phase: "locating"   → navigator.geolocation is running (permission
 *                         dialog may be open — card shows "Detecting
 *                         location...", NEVER an error)          (§1/§3)
 *          "loading"    → coordinates in hand, Open-Meteo in flight
 *          "ready"      → real weather on screen
 *          "locError"   → geolocation callback actually rejected    (§6/§7)
 *          "wxError"    → coordinates valid, Open-Meteo failed
 *
 *   locationError → one of PERMISSION_DENIED | POSITION_UNAVAILABLE |
 *                   TIMEOUT | UNSUPPORTED (drives the §14/§15/§16 message)
 *   weatherError  → NETWORK_ERROR | API_ERROR_* | API_MALFORMED
 *
 * RACE PROTECTION (spec §10): every async step checks a generation token —
 * a retry bumps the token so a stale in-flight geolocation/weather result
 * from a previous attempt can never overwrite newer state. The permission
 * dialog, re-renders, double effects and duplicate geolocation calls
 * (coalesced in locationService) are all covered.
 */

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { getCurrentLocation, LOCATION_ERRORS, isGeolocationSupported } from "../services/locationService";
import { fetchWeather } from "../services/weatherService";

/** Reasonable refresh interval — manual refreshes inside this window reuse cache. */
const REFRESH_INTERVAL_MS = 10 * 60 * 1000;

const WeatherContext = createContext(null);

export function WeatherProvider({ children }) {
    const [phase, setPhase] = useState("locating"); // §1: "Detecting location..." from first paint
    const [weather, setWeather] = useState(null);
    const [locationError, setLocationError] = useState(null);
    const [weatherError, setWeatherError] = useState(null);

    /** Bumped on every (re)start; stale async results are dropped. */
    const genRef = useRef(0);
    /** Mount guard for React 18 StrictMode double-effect (spec §10). */
    const bootstrappedRef = useRef(false);
    const lastFetchRef = useRef(0);

    /**
     * run — one complete location → weather pipeline.
     * Returns true if this invocation is still the current one.
     */
    const run = useCallback(async ({ force = false } = {}) => {
        const gen = ++genRef.current;
        const isCurrent = () => genRef.current === gen;

        setLocationError(null);
        setWeatherError(null);

        // ---------- 1. LOCATION (§2: wait for the actual callback) ----------
        // Retry passes force: it must start a FRESH geolocation request —
        // never join an old pending one (e.g. a parked permission prompt).
        setPhase("locating");
        let coords = null;
        try {
            coords = await getCurrentLocation({ force });
        } catch (err) {
            if (!isCurrent()) return false; // stale attempt — ignore
            const code =
                err === LOCATION_ERRORS.UNSUPPORTED
                    ? LOCATION_ERRORS.UNSUPPORTED
                    : err?.code || String(err);
            setLocationError(code);
            setPhase("locError");
            return false;
        }

        if (!isCurrent()) return false; // retry superseded us mid-flight

        // ---------- 2. WEATHER (§19: only after valid lat/lng) ----------
        setPhase("loading");
        console.log("Fetching weather...");
        try {
            const data = await fetchWeather(coords, { force, maxAgeMs: REFRESH_INTERVAL_MS });
            if (!isCurrent()) return false;
            setWeather(data);
            lastFetchRef.current = Date.now();
            setPhase("ready");
            console.log("Weather loaded");
            return true;
        } catch (err) {
            if (!isCurrent()) return false;
            setWeatherError(err?.message || String(err));
            setPhase("wxError");
            return false;
        }
    }, []);

    // One pipeline on mount — dashboard load only (spec §14).
    useEffect(() => {
        if (bootstrappedRef.current) return; // StrictMode/double-effect guard
        bootstrappedRef.current = true;
        if (!isGeolocationSupported()) {
            setLocationError(LOCATION_ERRORS.UNSUPPORTED);
            setPhase("locError");
            return;
        }
        run();
    }, [run]);

    /**
     * retryLocation (§11) — clear previous error → loading state → request
     * geolocation again → wait for the success callback → fetch weather.
     * The generation bump invalidates any still-running earlier attempt.
     */
    const retryLocation = useCallback(() => {
        run({ force: true });
    }, [run]);

    /** Refresh weather (no page reload); force-bypasses the cache interval. */
    const refreshWeather = useCallback(() => {
        run({ force: true });
    }, [run]);

    const value = {
        phase, // "locating" | "loading" | "ready" | "locError" | "wxError"
        status: phase, // legacy alias for existing consumers
        weather,
        locationError,
        weatherError,
        isStale: weather ? Date.now() - lastFetchRef.current > REFRESH_INTERVAL_MS : false,
        retryLocation,
        refreshWeather,
    };

    return <WeatherContext.Provider value={value}>{children}</WeatherContext.Provider>;
}

export const useWeather = () => useContext(WeatherContext);
