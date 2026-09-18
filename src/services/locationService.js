/**
 * locationService.js — the ONLY place the app touches the Geolocation API.
 *
 * Privacy (spec §23): coordinates live in memory only. Nothing here writes
 * to storage, analytics, or any service other than the caller (which sends
 * them solely to the Open-Meteo weather request).
 *
 * Error contract (spec §11) — every failure resolves to one of:
 *   PERMISSION_DENIED | POSITION_UNAVAILABLE | TIMEOUT | UNSUPPORTED
 */

export const LOCATION_ERRORS = {
    PERMISSION_DENIED: "PERMISSION_DENIED",
    POSITION_UNAVAILABLE: "POSITION_UNAVAILABLE",
    TIMEOUT: "TIMEOUT",
    UNSUPPORTED: "UNSUPPORTED",
};

export function isGeolocationSupported() {
    return typeof navigator !== "undefined" && !!navigator.geolocation;
}

function classifyError(err) {
    if (!err) return LOCATION_ERRORS.POSITION_UNAVAILABLE;
    switch (err.code) {
        case 1: // PERMISSION_DENIED
            return LOCATION_ERRORS.PERMISSION_DENIED;
        case 2: // POSITION_UNAVAILABLE
            return LOCATION_ERRORS.POSITION_UNAVAILABLE;
        case 3: // TIMEOUT
            return LOCATION_ERRORS.TIMEOUT;
        default:
            return LOCATION_ERRORS.POSITION_UNAVAILABLE;
    }
}

/**
 * getCurrentLocation — Promise wrapper around navigator.geolocation.
 * @param {{ timeoutMs?: number }} opts
 * @returns {Promise<{ latitude: number, longitude: number }>}
 *          rejects with a LOCATION_ERRORS code (string).
 */
export function getCurrentLocation({ timeoutMs = 10000 } = {}) {
    return new Promise((resolve, reject) => {
        if (!isGeolocationSupported()) {
            reject(LOCATION_ERRORS.UNSUPPORTED);
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const { latitude, longitude } = pos?.coords || {};
                if (
                    typeof latitude !== "number" ||
                    typeof longitude !== "number" ||
                    Number.isNaN(latitude) ||
                    Number.isNaN(longitude)
                ) {
                    reject(LOCATION_ERRORS.POSITION_UNAVAILABLE);
                    return;
                }
                resolve({ latitude, longitude });
            },
            (err) => reject(classifyError(err)),
            { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 5 * 60 * 1000 },
        );
    });
}
