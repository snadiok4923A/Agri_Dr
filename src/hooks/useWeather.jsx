/**
 * useWeather.jsx — Weather State layer (spec §24).
 *
 * Location Service → Weather Service → this provider → Weather Card.
 * Fetches ONCE on mount (no aggressive polling, spec §14); refreshes only
 * via `refresh()` / `retryLocation()` — both update just the weather state,
 * never reload the page (spec §12/§13). Coordinates stay in memory —
 * never persisted (spec §23).
 *
 * Status machine:
 *   "idle"       → before the first attempt
 *   "locating"   → asking the browser for coordinates
 *   "loading"    → coordinates known, fetching Open-Meteo
 *   "ready"      → real data available
 *   "denied"     → user refused the permission prompt (location permission needed)
 *   "unsupported"→ browser has no Geolocation API
 *   "error"      → timeout / position unavailable / network or API failure
 */

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { getCurrentLocation, LOCATION_ERRORS, isGeolocationSupported } from "../services/locationService";
import { fetchWeather } from "../services/weatherService";

/** Reasonable refresh interval — manual refreshes inside this window reuse cache. */
const REFRESH_INTERVAL_MS = 10 * 60 * 1000;

const WeatherContext = createContext(null);

export function WeatherProvider({ children }) {
    const [status, setStatus] = useState("idle");
    const [weather, setWeather] = useState(null);
    const [errorCode, setErrorCode] = useState(null); // LOCATION_ERRORS.* | NETWORK_ERROR | API_*
    const inFlightRef = useRef(false);
    const lastFetchRef = useRef(0);

    const load = useCallback(async ({ force = false } = {}) => {
        if (inFlightRef.current) return;
        inFlightRef.current = true;
        setErrorCode(null);

        try {
            // 1. Location (skipped only if we already have coordinates in memory)
            let coords = null;
            try {
                coords = await getCurrentLocation({ timeoutMs: 10000 });
            } catch (err) {
                setStatus(err === LOCATION_ERRORS.PERMISSION_DENIED ? "denied" : err === LOCATION_ERRORS.UNSUPPORTED ? "unsupported" : "error");
                setErrorCode(err);
                return;
            }

            // 2. Weather by coordinates
            setStatus("loading");
            try {
                const data = await fetchWeather(coords, {
                    force,
                    maxAgeMs: REFRESH_INTERVAL_MS,
                });
                setWeather(data);
                lastFetchRef.current = Date.now();
                setStatus("ready");
            } catch (err) {
                // Keep showing the last good data if a refresh fails mid-session
                setWeather((prev) => {
                    if (prev) {
                        setStatus("ready");
                        return prev;
                    }
                    return prev;
                });
                setStatus((s) => (s === "ready" ? s : "error"));
                setErrorCode(err?.message || String(err));
            }
        } finally {
            inFlightRef.current = false;
        }
    }, []);

    // One fetch on mount — dashboard load only (spec §14)
    useEffect(() => {
        if (!isGeolocationSupported()) {
            setStatus("unsupported");
            setErrorCode(LOCATION_ERRORS.UNSUPPORTED);
            return;
        }
        load();
    }, [load]);

    /** Retry Location — re-asks for coordinates + reloads weather (spec §12). */
    const retryLocation = useCallback(() => {
        load({ force: true });
    }, [load]);

    /** Refresh weather (no page reload); force-bypasses the cache interval. */
    const refreshWeather = useCallback(() => {
        load({ force: true });
    }, [load]);

    const value = {
        status,
        weather,
        errorCode,
        isStale: weather ? Date.now() - lastFetchRef.current > REFRESH_INTERVAL_MS : false,
        retryLocation,
        refreshWeather,
    };

    return <WeatherContext.Provider value={value}>{children}</WeatherContext.Provider>;
}

export const useWeather = () => useContext(WeatherContext);
