/**
 * executeVoiceCommand.js — the ONLY place a parsed intent becomes an action.
 *
 * Safety model (spec §23): every intent is an explicitly whitelisted,
 * predefined action against the app's real navigation/data/state. There is
 * NO eval(), NO Function(), NO dynamic code execution, NO arbitrary URL
 * execution — a transcript can never run arbitrary JavaScript.
 *
 * LANGUAGE: every user-visible string resolves through the app's translator
 * (`actions.t`), so feedback is spoken/shown in the currently selected
 * website language. Missing keys fall back to English, never to a raw key.
 *
 * Feedback is delivered via a lightweight DOM toast (no new deps).
 */

import { getCachedWeather } from "../services/weatherService";
import { closeTopOverlay } from "./overlayBus";

/* ------------------------------------------------------------------ *
 * Toast feedback ("Opening Market…", "Command not recognized", …)
 * ------------------------------------------------------------------ */
let toastEl = null;
let toastTimer = null;

function showToast(message) {
    if (typeof document === "undefined") return;
    if (!toastEl) {
        toastEl = document.createElement("div");
        toastEl.className = "voice-toast";
        toastEl.setAttribute("role", "status");
        toastEl.setAttribute("aria-live", "polite");
        document.body.appendChild(toastEl);
    }
    toastEl.textContent = message;
    toastEl.classList.add("voice-toast--visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        toastEl?.classList.remove("voice-toast--visible");
    }, 2600);
}

/** Translate through the app, falling back to an English string — never to
 *  a raw dotted key (the translator returns the key when it is missing). */
function tr(actions, key, fallback, params) {
    const value = actions?.t?.(key, params);
    return typeof value === "string" && value && value !== key
        ? value
        : fallback ?? value ?? "";
}

/* ------------------------------------------------------------------ *
 * Intent → route map (REAL app routes — nothing invented)
 * ------------------------------------------------------------------ */
const NAV_ROUTES = {
    OPEN_OVERVIEW: "/",
    OPEN_MY_FARM: "/farm",
    OPEN_RICE_VARIETIES: "/crops",
    OPEN_AI_DOCTOR: "/ai-doctor",
    OPEN_DISEASE_MEDICINE: "/disease",
    OPEN_FERTILIZER_PLAN: "/fertilizer",
    OPEN_COST_PROFIT: "/finance",
    OPEN_MARKET: "/market",
    OPEN_INSIGHTS: "/insights",
    OPEN_IMPROVE_YIELD: "/improve",
    OPEN_SETTINGS: "/settings",
};

/** Intent → localized page name (`nav.*` keys). */
const NAV_LABEL_KEYS = {
    OPEN_OVERVIEW: "nav.overview",
    OPEN_MY_FARM: "nav.myFarm",
    OPEN_RICE_VARIETIES: "nav.crops",
    OPEN_AI_DOCTOR: "nav.aiDoctor",
    OPEN_DISEASE_MEDICINE: "nav.disease",
    OPEN_FERTILIZER_PLAN: "nav.fertilizer",
    OPEN_COST_PROFIT: "nav.finance",
    OPEN_MARKET: "nav.market",
    OPEN_INSIGHTS: "nav.insights",
    OPEN_IMPROVE_YIELD: "nav.improve",
    OPEN_SETTINGS: "nav.settings",
};

/** "Opening <page>…" in the active language. */
function openingName(actions, intent) {
    const name = NAV_LABEL_KEYS[intent] ? actions?.t?.(NAV_LABEL_KEYS[intent]) : "";
    if (!name || name === NAV_LABEL_KEYS[intent]) {
        return tr(actions, "voice.feedback.openingNamed", "Opening…", {
            name: intent,
        });
    }
    return tr(actions, "voice.feedback.openingNamed", "Opening {name}…", {
        name,
    });
}

/* ------------------------------------------------------------------ *
 * Live weather values for SHOW_* intents — read from the SAME cached
 * Open-Meteo response the Weather Card renders, so spoken values always
 * match what's on screen (never the old demo numbers).
 * ------------------------------------------------------------------ */
function weatherValue(intent, actions) {
    const c = getCachedWeather()?.current;
    if (!c) return null;
    const num = (n) =>
        actions?.formatNumber ? actions.formatNumber(Math.round(n)) : String(Math.round(n));
    switch (intent) {
        case "SHOW_TEMPERATURE":
            return `${num(c.temperature)}°C`;
        case "SHOW_HUMIDITY":
            return `${num(c.humidity)}%`;
        case "SHOW_WIND": {
            const unit = actions?.t?.("units.kmh");
            return `${num(c.wind)} ${unit && unit !== "units.kmh" ? unit : "km/h"}`;
        }
        case "SHOW_RAIN_PROBABILITY":
            return `${num(c.rainProbability)}%`;
        default:
            return null;
    }
}

/** Specific intent → display name for entity windows (data names are proper
 *  nouns and stay untranslated, exactly like the pages that show them). */
function entityOpening(actions, name) {
    return tr(actions, "voice.feedback.openingNamed", "Opening {name}…", {
        name,
    });
}

/** DOM events pages listen to for voice-driven React state changes. */
export const VOICE_OPEN_DISEASE_EVENT = "krisiveda:voice-open-disease";
export const VOICE_OPEN_MARKET_EVENT = "krisiveda:voice-open-market";
export const VOICE_FILTER_MARKET_EVENT = "krisiveda:voice-filter-market";
export const VOICE_OPEN_SIDEBAR_EVENT = "krisiveda:voice-open-sidebar";

/** Navigate (if needed), then dispatch a detail event after the paint. */
function navigateThenEvent(actions, path, eventName, detail) {
    const dispatch = () =>
        window.dispatchEvent(new CustomEvent(eventName, { detail }));
    if (typeof actions.navigate === "function") {
        // Router state is the source of truth for the current path.
        if (actions.currentPath !== path) {
            actions.navigate(path);
            setTimeout(dispatch, 350);
        } else {
            dispatch();
        }
    } else {
        dispatch();
    }
}

/**
 * executeVoiceCommand — performs the action for a parsed command.
 *
 * @param {object} parsed        result of parseVoiceCommand()
 * @param {object} actions       app capabilities passed by the provider:
 *   {
 *     navigate(path)             – react-router navigate
 *     openWeather()              – open the floating Weather modal
 *     setTheme("dark"|"light")   – theme setter
 *     changeLanguage(code)       – language setter
 *     stopVoice()                – stop voice mode
 *     t(key, params)             – translator for the active language
 *     formatNumber(value)        – locale digit formatting
 *     getFarmSummary()           – { area, count } | null from real parcels
 *     languageName(code)         – native language name
 *   }
 * @returns {boolean} true if the intent was recognized and executed
 */
export function executeVoiceCommand(parsed, actions) {
    if (!parsed?.intent) return false;
    const { intent, entity } = parsed;

    /* --- 0. CLOSE — highest priority (§18–§22) ---
     * Closes ONLY the active temporary UI via registered React state.
     * §21: when nothing temporary is open, DO NOTHING — no navigation,
     * no feedback, no page change. */
    if (intent === "CLOSE_ACTIVE_OVERLAY") {
        const closed = closeTopOverlay();
        if (closed) showToast(tr(actions, "voice.feedback.closed", "Closed"));
        // Consumed either way — never falls through to "not recognized".
        return true;
    }

    /* --- 0b. Mobile sidebar (§13/§38) — opens the drawer, no navigation --- */
    if (intent === "OPEN_SIDEBAR") {
        window.dispatchEvent(new CustomEvent(VOICE_OPEN_SIDEBAR_EVENT));
        showToast(
            tr(actions, "voice.feedback.openingMenu", "Opening menu…"),
        );
        return true;
    }

    /* --- 1. Plain navigation --- */
    const route = NAV_ROUTES[intent];
    if (route) {
        actions.navigate?.(route);
        showToast(openingName(actions, intent));
        return true;
    }

    switch (intent) {
        /* --- 2. Weather --- */
        case "OPEN_WEATHER":
            // The app's weather UI is the floating glass modal on the
            // dashboard — open it; navigate home first if we're elsewhere.
            if (typeof actions.openWeather === "function") {
                actions.openWeather();
            } else {
                actions.navigate?.("/");
            }
            showToast(
                tr(actions, "voice.feedback.openingWeather", "Opening Weather…"),
            );
            return true;

        case "SHOW_TEMPERATURE":
        case "SHOW_HUMIDITY":
        case "SHOW_WIND":
        case "SHOW_RAIN_PROBABILITY": {
            const value = weatherValue(intent, actions);
            if (value) {
                showToast(value);
            } else {
                showToast(
                    tr(
                        actions,
                        "voice.feedback.weatherUnavailable",
                        "Weather data unavailable",
                    ),
                );
            }
            return true;
        }

        /* --- 2b. Farm land (real survey parcels; never demo numbers) --- */
        case "SHOW_FARM_AREA": {
            const summary = actions.getFarmSummary?.();
            if (summary) {
                showToast(
                    tr(
                        actions,
                        "voice.feedback.farmArea",
                        "Your farm has {area} across {count} parcels.",
                        {
                            area: summary.area,
                            count: actions?.formatNumber
                                ? actions.formatNumber(summary.count)
                                : summary.count,
                        },
                    ),
                );
            } else {
                showToast(
                    tr(
                        actions,
                        "voice.feedback.farmAreaMissing",
                        "No saved farm land found. Add your parcels in My Farm, then ask again.",
                    ),
                );
            }
            return true;
        }

        /* --- 3. Rice variety entities ---
         * Specific variety → Market page + its floating price window.
         * Broad family ("basmati") → Market page with the Basmati filter. */
        case "OPEN_MARKET_VARIETY":
            if (entity?.type === "variety" && entity.id) {
                navigateThenEvent(actions, "/market", VOICE_OPEN_MARKET_EVENT, {
                    id: entity.id,
                });
                showToast(entityOpening(actions, entity.name));
                return true;
            }
            return false;

        case "OPEN_MARKET_FILTERED":
            if (entity?.type === "variety") {
                navigateThenEvent(actions, "/market", VOICE_FILTER_MARKET_EVENT, {
                    filter: entity.id === "basmati-1121" ? "basmati" : "all",
                });
                showToast(openingName(actions, "OPEN_MARKET"));
                return true;
            }
            return false;

        /* --- 3b. Specific disease → Disease page + its floating window --- */
        case "OPEN_DISEASE_DETAIL":
            if (entity?.type === "disease" && entity.id) {
                navigateThenEvent(actions, "/disease", VOICE_OPEN_DISEASE_EVENT, {
                    id: entity.id,
                });
                showToast(entityOpening(actions, entity.name));
                return true;
            }
            return false;

        /* --- 4. Language (existing languages only) --- */
        case "SET_LANGUAGE":
            if (entity?.type === "language" && entity.code) {
                actions.changeLanguage?.(entity.code);
                showToast(
                    tr(
                        actions,
                        "voice.feedback.languageSet",
                        "Language: {name}",
                        {
                            name: actions.languageName
                                ? actions.languageName(entity.code)
                                : entity.code,
                        },
                    ),
                );
                return true;
            }
            return false;

        /* --- 5. Theme (existing toggle only) --- */
        case "SET_DARK_MODE":
            actions.setTheme?.("dark");
            showToast(tr(actions, "voice.feedback.darkMode", "Dark mode on"));
            return true;
        case "SET_LIGHT_MODE":
            actions.setTheme?.("light");
            showToast(tr(actions, "voice.feedback.lightMode", "Light mode on"));
            return true;

        /* --- 6. Voice control --- */
        case "STOP_VOICE_MODE":
            actions.stopVoice?.();
            showToast(
                tr(actions, "voice.feedback.voiceStopped", "Voice Mode stopped"),
            );
            return true;
        case "START_VOICE_MODE":
            // Already active (we're listening) — just confirm.
            showToast(
                tr(actions, "voice.feedback.voiceActive", "Voice Mode active"),
            );
            return true;

        /* --- 7. Photo actions on the dashboard's Crop Diagnosis card --- */
        case "TAKE_CROP_PHOTO":
        case "UPLOAD_CROP_PHOTO": {
            const eventName =
                intent === "TAKE_CROP_PHOTO"
                    ? "krisiveda:voice-take-photo"
                    : "krisiveda:voice-upload-photo";
            const dispatch = () =>
                window.dispatchEvent(new CustomEvent(eventName));
            if (typeof actions.navigate === "function") {
                // Route home first if needed, then trigger after the paint.
                actions.navigate("/");
                setTimeout(dispatch, 350);
            } else {
                dispatch();
            }
            showToast(
                tr(
                    actions,
                    "voice.feedback.openingCamera",
                    "Opening camera…",
                ),
            );
            return true;
        }

        /* --- 8. Navigation shortcuts (safe, existing APIs only) --- */
        case "GO_BACK":
            if (typeof actions.navigateBack === "function") {
                actions.navigateBack();
            } else {
                window.history.back();
            }
            showToast(tr(actions, "voice.feedback.goingBack", "Going back…"));
            return true;
        case "SCROLL_DOWN":
        case "SCROLL_UP": {
            const scroller =
                document.querySelector(".layout__content") ||
                document.scrollingElement ||
                document.documentElement;
            const delta = intent === "SCROLL_DOWN" ? 420 : -420;
            scroller?.scrollBy?.({ top: delta, behavior: "smooth" });
            return true;
        }

        default:
            return false;
    }
}

/** Shared "unknown command" feedback — keeps Voice Mode listening and is
 *  shown in the currently selected website language. */
export function showUnknownCommandFeedback(actions) {
    showToast(
        tr(actions, "voice.commandNotRecognized", "Command not recognized"),
    );
}
