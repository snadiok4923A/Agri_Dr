/**
 * overlayBus.js — tiny registry of the app's temporary UI overlays
 * (floating modals, weather window, mobile drawer) so the voice CLOSE
 * command can close the ACTIVE one through React state — never DOM hacks.
 *
 * Each page/component registers { isOpen(), close() } via its own state.
 * closeTopOverlay() closes the first OPEN overlay and reports whether
 * anything was closed (spec §19/§21: when nothing is open, do nothing —
 * the executor decides what feedback to give).
 *
 * Adding a future overlay = one registerOverlay() call in that component.
 */

const overlays = new Set();

/** Register an overlay handler. Returns an unregister function. */
export function registerOverlay(entry) {
    overlays.add(entry);
    return () => overlays.delete(entry);
}

/** Close the first open overlay. true → something closed, false → none open. */
export function closeTopOverlay() {
    for (const o of overlays) {
        try {
            if (o.isOpen()) {
                o.close();
                return true;
            }
        } catch {
            /* a broken listener must never block the others */
        }
    }
    return false;
}

/** True when any registered overlay is currently open. */
export function hasOpenOverlay() {
    for (const o of overlays) {
        try {
            if (o.isOpen()) return true;
        } catch {
            /* ignore */
        }
    }
    return false;
}
