/**
 * executeVoiceCommand.js — the ONLY place a parsed intent becomes an action.
 *
 * Safety model (spec §23): every intent is an explicitly whitelisted,
 * predefined action against the app's real navigation/data/state. There is
 * NO eval(), NO Function(), NO dynamic code execution, NO arbitrary URL
 * execution — a transcript can never run arbitrary JavaScript.
 *
 * Feedback is delivered via a lightweight DOM toast (no new deps): the
 * visual feedback is created lazily on first use and reused afterwards.
 */

import { weatherData } from "../data/mockData";

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

/* ------------------------------------------------------------------ *
 * Intent → route map (REAL app routes — nothing invented)
 * ------------------------------------------------------------------ */
const NAV_ROUTES = {
    OPEN_OVERVIEW: "/",
    OPEN_MY_FARM: "/farm",
    OPEN_RICE_VARIETIES: "/crops",
    OPEN_AI_DOCTOR: "/ai-doctor",
    OPEN_SOIL_FERTILITY: "/soil",
    OPEN_DISEASE_MEDICINE: "/disease",
    OPEN_FERTILIZER_PLAN: "/fertilizer",
    OPEN_COST_PROFIT: "/finance",
    OPEN_MARKET: "/market",
    OPEN_INSIGHTS: "/insights",
    OPEN_IMPROVE_YIELD: "/improve",
    OPEN_SETTINGS: "/settings",
};

/* ------------------------------------------------------------------ *
 * Live weather values for SHOW_* intents (existing data only)
 * ------------------------------------------------------------------ */
function weatherValue(intent) {
    const c = weatherData?.current;
    if (!c) return null;
    switch (intent) {
        case "SHOW_TEMPERATURE":
            return `${c.temperature}°C`;
        case "SHOW_HUMIDITY":
            return `${c.humidity}%`;
        case "SHOW_WIND":
            return `${c.wind} km/h`;
        case "SHOW_RAIN_PROBABILITY":
            return `${c.rainProbability}%`;
        default:
            return null;
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
 *   }
 * @returns {boolean} true if the intent was recognized and executed
 */
export function executeVoiceCommand(parsed, actions) {
    if (!parsed?.intent) return false;
    const { intent, entity, feedback } = parsed;

    /* --- 1. Plain navigation --- */
    const route = NAV_ROUTES[intent];
    if (route) {
        actions.navigate?.(route);
        showToast(feedback || "Opening…");
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
            showToast(feedback || "Opening Weather…");
            return true;

        case "SHOW_TEMPERATURE":
        case "SHOW_HUMIDITY":
        case "SHOW_WIND":
        case "SHOW_RAIN_PROBABILITY": {
            const value = weatherValue(intent);
            if (value) {
                showToast(`${parsed.matchedPhrase ? "" : ""}${value}`);
            } else {
                showToast("Weather data unavailable");
            }
            return true;
        }

        /* --- 3. Rice variety entities --- */
        case "OPEN_RICE_VARIETY_DETAILS":
            if (entity?.type === "variety" && entity.id) {
                actions.navigate?.(`/crops/${entity.id}`);
                showToast(`Opening ${entity.name}…`);
                return true;
            }
            return false;

        /* --- 4. Language (existing languages only) --- */
        case "SET_LANGUAGE":
            if (entity?.type === "language" && entity.code) {
                actions.changeLanguage?.(entity.code);
                showToast(`Language: ${entity.code.toUpperCase()}`);
                return true;
            }
            return false;

        /* --- 5. Theme (existing toggle only) --- */
        case "SET_DARK_MODE":
            actions.setTheme?.("dark");
            showToast(feedback || "Dark mode");
            return true;
        case "SET_LIGHT_MODE":
            actions.setTheme?.("light");
            showToast(feedback || "Light mode");
            return true;

        /* --- 6. Voice control --- */
        case "STOP_VOICE_MODE":
            actions.stopVoice?.();
            showToast(feedback || "Voice Mode stopped");
            return true;
        case "START_VOICE_MODE":
            // Already active (we're listening) — just confirm.
            showToast(feedback || "Voice Mode active");
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
            showToast(feedback || "Opening camera…");
            return true;
        }

        /* --- 8. Navigation shortcuts (safe, existing APIs only) --- */
        case "GO_BACK":
            if (typeof actions.navigateBack === "function") {
                actions.navigateBack();
                showToast("Going back…");
                return true;
            }
            window.history.back();
            showToast("Going back…");
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

/** Shared "unknown command" feedback — keeps Voice Mode listening. */
export function showUnknownCommandFeedback() {
    showToast("Command not recognized");
}
