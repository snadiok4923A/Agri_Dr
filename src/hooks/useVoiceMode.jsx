import {
    createContext,
    useContext,
    useState,
    useEffect,
    useCallback,
    useMemo,
    useRef,
} from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { createVoiceRecognitionService, isSpeechRecognitionSupported } from "../services/voiceRecognitionService";
import { parseVoiceCommand } from "../voice/voiceCommandParser";
import { executeVoiceCommand, showUnknownCommandFeedback } from "../voice/executeVoiceCommand";
import { LANGUAGES, useLanguage } from "./useLanguage";
import { useTheme } from "./useTheme";
import { useOnboarding } from "./useOnboarding";

/**
 * VoiceMode context — the persistent, rule-based voice assistant runtime.
 *
 * Flow (per spec):
 *   microphone → Web Speech API (native, no external service) → final
 *   transcript → parseVoiceCommand() (pure rules) → executeVoiceCommand()
 *   (whitelisted actions) → UI toast feedback.
 *
 * LANGUAGE (single source of truth: useLanguage):
 *   recognition.lang ALWAYS follows the website language and is re-applied
 *   on every session/restart. There is no silent locale rotation: if the
 *   browser cannot recognise the selected locale it reports
 *   language-not-supported, Voice Mode stops and says so in that language,
 *   and the user can type instead. Every spoken label/feedback string is
 *   resolved through the same translation tree as the rest of the UI.
 *
 * - Activation is PERSISTENT: recognition self-restarts (continuous sessions
 *   end after silence in browsers) until stop() is called.
 * - Unknown commands NEVER stop Voice Mode.
 * - Voice Mode stops only via: the Stop button/header icon, a spoken stop
 *   command, a microphone/service/language failure, or leaving the app.
 */

const VoiceModeContext = createContext(null);

/** App language code → Web Speech recognition locale (existing languages). */
export const SR_LANGS = {
    en: "en-IN",
    bn: "bn-IN",
    hi: "hi-IN",
    te: "te-IN",
    ta: "ta-IN",
};

/** Recognition error code → translation key suffix under `ai.*`. */
const VOICE_ERROR_KEYS = {
    "not-allowed": "voiceDenied",
    "service-not-allowed": "voiceServiceUnavailable",
    "language-not-supported": "voiceLangUnsupported",
    "audio-capture": "voiceNoMic",
    network: "voiceServiceUnavailable",
    unsupported: "voiceUnsupported",
};

/** Errors that mean the engine cannot keep listening at all. */
const FATAL_ERRORS = new Set([
    "not-allowed",
    "service-not-allowed",
    "language-not-supported",
    "audio-capture",
    "unsupported",
]);

/** Same final transcript delivered twice in quick succession = one command.
 *  (Continuous recognition + the end/restart cycle can replay a result.) */
const DUPLICATE_WINDOW_MS = 1200;

/** DOM event used to open the Dashboard's floating Weather modal from voice. */
export const VOICE_OPEN_WEATHER_EVENT = "krisiveda:voice-open-weather";

/** DOM event used to open the mobile drawer (sidebar) from voice (§13/§38). */
export const VOICE_OPEN_SIDEBAR_EVENT = "krisiveda:voice-open-sidebar";

export function VoiceModeProvider({ children }) {
    const [active, setActive] = useState(false);
    const [status, setStatus] = useState("idle"); // idle | starting | listening | restarting
    const [transcript, setTranscript] = useState("");
    const [lastCommand, setLastCommand] = useState(null); // { text, intent, at }
    const [voiceError, setVoiceError] = useState(null); // ai.* key suffix
    const [supported] = useState(() => isSpeechRecognitionSupported());

    const navigate = useNavigate();
    const location = useLocation();
    const { language, changeLanguage, t, formatNumber } = useLanguage();
    const { setTheme } = useTheme();
    const { farm, isFarmComplete } = useOnboarding();

    // Latest callbacks/actions for the recognition loop (avoids restarts).
    const actionsRef = useRef(null);
    const activeRef = useRef(false);
    const serviceRef = useRef(null);
    const stopRef = useRef(null);
    const lastFinalRef = useRef({ text: "", at: 0 });
    const farmRef = useRef({ farm, isFarmComplete });

    useEffect(() => {
        farmRef.current = { farm, isFarmComplete };
    }, [farm, isFarmComplete]);

    useEffect(() => {
        activeRef.current = active;
    }, [active]);

    /* Localized "your farm has X across N parcels" answer — built from the
       SAME survey parcels the My Farm / Finance pages use, never demo data.
       Mixed units are summed per unit (no invented conversion rates). */
    const getFarmSummary = useCallback(() => {
        const parcels = farmRef.current.isFarmComplete
            ? farmRef.current.farm?.parcels || []
            : [];
        if (!parcels.length) return null;
        const byUnit = new Map();
        parcels.forEach((parcel) => {
            const unit = parcel.unit || "acre";
            const area = Number(parcel.area);
            if (!Number.isFinite(area) || area <= 0) return;
            byUnit.set(unit, (byUnit.get(unit) || 0) + area);
        });
        if (!byUnit.size) return null;
        const parts = [...byUnit.entries()].map(([unit, sum]) => {
            const key = `units.${unit}`;
            const label = t(key);
            return `${formatNumber(Math.round(sum * 100) / 100)} ${
                label === key ? unit : label
            }`;
        });
        return { area: parts.join(" + "), count: parcels.length };
    }, [t, formatNumber]);

    const stop = useCallback(() => {
        setActive(false);
        setStatus("idle");
        setTranscript("");
        setVoiceError(null);
        try {
            serviceRef.current?.stop();
        } catch {
            /* noop */
        }
    }, []);
    stopRef.current = stop;

    const start = useCallback(() => {
        if (!supported) {
            setVoiceError("voiceUnsupported");
            return;
        }
        setTranscript("");
        setVoiceError(null);
        lastFinalRef.current = { text: "", at: 0 };
        setActive(true);
    }, [supported]);

    const toggle = useCallback(() => {
        if (active) stop();
        else start();
    }, [active, start, stop]);

    /* ---------- Handle one finalized utterance ---------- */
    const handleFinalTranscript = useCallback((text, alternatives = []) => {
        const normalized = String(text || "").trim().toLowerCase();
        if (!normalized) return;
        // One recognition event must never run a command twice.
        const now = Date.now();
        if (
            lastFinalRef.current.text === normalized &&
            now - lastFinalRef.current.at < DUPLICATE_WINDOW_MS
        ) {
            return;
        }
        lastFinalRef.current = { text: normalized, at: now };

        setTranscript(text);
        // §30: try the top transcript first, then recognition alternatives —
        // the first alternative that matches a command wins.
        const candidates = [text, ...alternatives.filter((a) => a && a !== text)];
        let parsed = null;
        for (const candidate of candidates) {
            parsed = parseVoiceCommand(candidate);
            if (parsed) break;
        }
        if (!parsed) {
            setLastCommand({ text, intent: null, at: Date.now() });
            showUnknownCommandFeedback(actionsRef.current);
            return;
        }
        setLastCommand({ text, intent: parsed.intent, at: Date.now() });
        const handled = executeVoiceCommand(parsed, actionsRef.current);
        if (!handled) showUnknownCommandFeedback(actionsRef.current);
    }, []);

    /* ---------- Recognition service lifecycle ---------- */
    useEffect(() => {
        if (!active || !supported) return undefined;

        const service =
            serviceRef.current ||
            createVoiceRecognitionService({
                lang: SR_LANGS[language] || "en-IN",
                onState: (s) => setStatus(s),
                onFinal: handleFinalTranscript,
                onInterim: (t) => setTranscript(t),
                onError: (code) => {
                    const key = VOICE_ERROR_KEYS[code];
                    if (key) setVoiceError(key);
                    if (FATAL_ERRORS.has(code)) {
                        // Cannot keep listening (mic blocked, locale
                        // unsupported, no input device…). Stop cleanly and
                        // keep the localized explanation on screen.
                        setActive(false);
                        setStatus("idle");
                        try {
                            serviceRef.current?.stop();
                        } catch {
                            /* noop */
                        }
                    }
                    // no-speech / aborted / network: keep voice mode alive.
                },
            });
        serviceRef.current = service;
        service.setHandlers({ onFinal: handleFinalTranscript });
        service.setLang(SR_LANGS[language] || "en-IN");
        service.start();

        return () => {
            // Component-scoped cleanup only happens when voice mode turns off
            // (or the provider unmounts) — stop() already covers navigation.
        };
    }, [active, supported, handleFinalTranscript]); // eslint-disable-line react-hooks/exhaustive-deps

    /* Follow the app's language selector: recognition switches immediately
       (the service restarts its live session with the new locale), and a
       previous "language not supported" message is cleared so the new
       language gets a fair try. No page refresh, no re-login. */
    useEffect(() => {
        serviceRef.current?.setLang(SR_LANGS[language] || "en-IN");
        setVoiceError(null);
    }, [language]);

    /* ---------- App actions handed to the executor ---------- */
    useEffect(() => {
        const openWeatherModal = () => {
            const dispatch = () =>
                window.dispatchEvent(new CustomEvent(VOICE_OPEN_WEATHER_EVENT));
            if (location.pathname !== "/") {
                navigate("/");
                setTimeout(dispatch, 350);
            } else {
                dispatch();
            }
        };

        actionsRef.current = {
            navigate,
            currentPath: location.pathname,
            navigateBack: () => navigate(-1),
            openWeather: openWeatherModal,
            setTheme,
            changeLanguage,
            stopVoice: () => stopRef.current?.(),
            t,
            formatNumber,
            getFarmSummary,
            languageName: (code) =>
                LANGUAGES.find((l) => l.code === code)?.native || code,
        };
    }, [
        navigate,
        location.pathname,
        setTheme,
        changeLanguage,
        t,
        formatNumber,
        getFarmSummary,
    ]);

    /* PERF: recognition streams interim transcripts constantly while
       listening — every one of those setState calls re-renders the
       provider. A stable value object (plus the already-useCallback'd
       actions) keeps that churn scoped to the components that actually
       show voice state (the Voice Mode card and the header indicator)
       instead of cascading through the whole app. */
    const value = useMemo(
        () => ({
            active,
            status,
            transcript,
            supported,
            lastCommand,
            voiceError,
            start,
            stop,
            toggle,
        }),
        [active, status, transcript, supported, lastCommand, voiceError, start, stop, toggle]
    );

    return (
        <VoiceModeContext.Provider value={value}>
            {children}
        </VoiceModeContext.Provider>
    );
}

export const useVoiceMode = () => useContext(VoiceModeContext);
