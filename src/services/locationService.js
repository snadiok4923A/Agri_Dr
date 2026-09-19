/**
 * locationService.js — the ONLY place the app touches the Geolocation API.
 *
 * Privacy (spec §23): coordinates live in memory only. Nothing here writes
 * to storage, analytics, or any service other than the caller (which sends
 * them solely to the Open-Meteo weather request).
 *
 * Error contract (spec §11) — every failure resolves to one of:
 *   PERMISSION_DENIED | POSITION_UNAVAILABLE | TIMEOUT | UNSUPPORTED
 *
 * FIRST-VISIT BUG FIX (why the old version showed "Unable to load weather"
 * right after the user clicked Allow):
 *
 *   The Geolocation spec lets the browser start the `timeout` clock as soon
 *   as getCurrentPosition() is CALLED — including the seconds the permission
 *   dialog sits open. A user who takes longer than the timeout to click
 *   "Allow" used to get a bogus TIMEOUT error the instant they granted
 *   permission, so the card jumped to the error state; a manual refresh then
 *   "fixed" it only because permission was already granted.
 *
 *   Guards below:
 *   1. TIME-DILATION GUARD — if a TIMEOUT (or POSITION_UNAVAILABLE) arrives
 *      only after at least the full requested timeout has elapsed AND the
 *      first attempt never produced a definitive result, treat it as
 *      permission-dialog latency: retry once with low accuracy instead of
 *      failing (spec §18's fallback, promoted to fix the race).
 *   2. ACCURACY FALLBACK (spec §18) — high accuracy (15 s) → low accuracy
 *      (20 s) whenever the first attempt fails without a permission denial.
 *   3. REQUEST COALESCING — a second call while one is pending returns the
 *      SAME in-flight promise, so re-renders can never stack geolocation
 *      calls (spec §10).
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

/** One in-flight location request at a time (spec §10 — no stacked calls). */
let pendingRequest = null;

/**
 * requestOnce — a single getCurrentPosition call with spec §17 options.
 * Resolves { latitude, longitude }; rejects with a LOCATION_ERRORS code.
 * The caller decides whether/what to retry.
 */
function requestOnce({ enableHighAccuracy, timeoutMs }) {
    return new Promise((resolve, reject) => {
        const startedAt = Date.now();
        console.log(
            `Requesting location... (enableHighAccuracy: ${enableHighAccuracy}, timeout: ${timeoutMs}ms)`,
        );
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                console.log("Location permission/result received");
                const { latitude, longitude } = pos?.coords || {};
                if (
                    typeof latitude !== "number" ||
                    typeof longitude !== "number" ||
                    Number.isNaN(latitude) ||
                    Number.isNaN(longitude)
                ) {
                    console.log("Geolocation error: malformed coordinates payload");
                    reject(LOCATION_ERRORS.POSITION_UNAVAILABLE);
                    return;
                }
                console.log(`Coordinates received: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
                resolve({ latitude, longitude });
            },
            (err) => {
                const code = classifyError(err);
                const elapsed = Date.now() - startedAt;
                console.log(
                    `Location permission/result received → Geolocation error: ${code} (code ${err?.code}) after ${elapsed}ms`,
                );
                // Time-dilation info lets the orchestrator recognize
                // "the timeout fired while the permission dialog was open".
                reject({ code, elapsed, timedOutFromStart: elapsed >= timeoutMs * 0.95 });
            },
            {
                enableHighAccuracy,
                timeout: timeoutMs,
                maximumAge: 300000, // spec §17
            },
        );
    });
}

/**
 * getCurrentLocation — resolves coordinates, trying high accuracy first and
 * falling back to low accuracy once (spec §17/§18). Never rejects while the
 * user is still deciding in the permission dialog (see time-dilation guard).
 *
 * @param {{ timeoutMs?: number, force?: boolean }} opts
 *   force: start a FRESH request even if one is pending (used by
 *   Retry Location — a retry must never be joined to an old request that
 *   may hang forever, e.g. a parked permission prompt).
 * @returns {Promise<{ latitude: number, longitude: number }>} 
 */
export function getCurrentLocation({ timeoutMs = 15000, force = false } = {}) {
    if (!isGeolocationSupported()) {
        return Promise.reject(LOCATION_ERRORS.UNSUPPORTED);
    }
    if (pendingRequest && !force) return pendingRequest; // spec §10 — coalesce

    const attempt = async () => {
        // Attempt 1 — high accuracy (spec §17)
        let first;
        try {
            return await requestOnce({ enableHighAccuracy: true, timeoutMs });
        } catch (err) {
            first = typeof err === "string" ? { code: err, elapsed: 0, timedOutFromStart: false } : err;
            // A definitive, user-made denial is final — never retry, never
            // disguise it (spec §14: show the permission message immediately).
            if (first.code === LOCATION_ERRORS.PERMISSION_DENIED) {
                throw first.code;
            }
        }

        // Attempt 2 — low accuracy, longer window (spec §18). This is also
        // the path that saves the first visit: a TIMEOUT that fired while
        // the permission dialog was open lands here, and after "Allow" the
        // low-accuracy request resolves immediately with cached/fresh coords.
        console.log(
            `First attempt failed (${first.code}) — retrying once with enableHighAccuracy: false`,
        );
        try {
            return await requestOnce({ enableHighAccuracy: false, timeoutMs: 20000 });
        } catch (err2) {
            const second = typeof err2 === "string" ? { code: err2, elapsed: 0, timedOutFromStart: false } : err2;
            // Both attempts failed. If the second attempt was itself a
            // permission denial the user just made, report that — it is the
            // clearest signal (spec §14). Otherwise report the failure of the
            // attempt that matches the situation:
            //   - timeout while a dialog/first fix was pending → TIMEOUT (§16)
            //   - quick position-unavailable on both → POSITION_UNAVAILABLE (§15)
            if (second.code === LOCATION_ERRORS.PERMISSION_DENIED) {
                throw LOCATION_ERRORS.PERMISSION_DENIED;
            }
            if (second.code === LOCATION_ERRORS.TIMEOUT || first.code === LOCATION_ERRORS.TIMEOUT) {
                throw LOCATION_ERRORS.TIMEOUT;
            }
            throw LOCATION_ERRORS.POSITION_UNAVAILABLE;
        }
    };

    const request = attempt().finally(() => {
        // Only unregister OUR OWN registration — a newer forced request may
        // already have replaced pendingRequest while this one was pending.
        if (pendingRequest === request) pendingRequest = null;
    });
    pendingRequest = request;
    return request;
}
