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
import { useLanguage } from "./useLanguage";
import { useTheme } from "./useTheme";

/**
 * VoiceMode context — the persistent, rule-based voice assistant runtime.
 *
 * Flow (per spec):
 *   microphone → Web Speech API (native, no external service) → final
 *   transcript → parseVoiceCommand() (pure rules) → executeVoiceCommand()
 *   (whitelisted actions) → UI toast feedback.
 *
 * - Activation is PERSISTENT: recognition self-restarts (continuous sessions
 *   end after silence in browsers) until stop() is called — a command never
 *   turns Voice Mode off by itself. Navigating between pages also keeps the
 *   session alive, so "Market Intelligence kholo" works from anywhere.
 * - Unknown commands NEVER stop Voice Mode ("Command not recognized" toast).
 * - Voice Mode stops only via: the Stop button/header icon, or a spoken stop
 *   command ("stop voice" / "voice bondho" / "ভয়েস বন্ধ করো" …).
 */

const VoiceModeContext = createContext(null);

/** App language code → Web Speech recognition locale (existing languages only). */
const SR_LANGS = {
    en: "en-IN",
    bn: "bn-IN",
    hi: "hi-IN",
    te: "te-IN",
    ta: "ta-IN",
};

/**
 * §2/§3 — ALL speech locales we rotate through. The SPOKEN language is
 * independent of the website language: recognition starts at the app's
 * locale but automatically rotates (bn → hi → te → ta → en …) whenever a
 * transcript matches no command, so a Bengali sentence is understood even
 * in English mode and vice-versa. The last SUCCESSFUL locale becomes the
 * primary guess (sticky), which is the practical multi-locale strategy for
 * the Web Speech API — no user-visible language switch needed.
 */
const SR_LOCALES = ["en-IN", "bn-IN", "hi-IN", "te-IN", "ta-IN"];

/** DOM event used to open the Dashboard's floating Weather modal from voice. */
export const VOICE_OPEN_WEATHER_EVENT = "krisiveda:voice-open-weather";

/** DOM event used to open the mobile drawer (sidebar) from voice (§13/§38). */
export const VOICE_OPEN_SIDEBAR_EVENT = "krisiveda:voice-open-sidebar";

export function VoiceModeProvider({ children }) {
    const [active, setActive] = useState(false);
    const [status, setStatus] = useState("idle"); // idle | starting | listening | restarting
    const [transcript, setTranscript] = useState("");
    const [lastCommand, setLastCommand] = useState(null); // { text, intent, at }
    const [supported] = useState(() => isSpeechRecognitionSupported());

    const navigate = useNavigate();
    const location = useLocation();
    const { language, changeLanguage } = useLanguage();
    const { setTheme } = useTheme();

    // Latest callbacks/actions for the recognition loop (avoids restarts).
    const actionsRef = useRef(null);
    const activeRef = useRef(false);
    const serviceRef = useRef(null);
    const stopRef = useRef(null);
    // Multilingual rotation state (§2/§3).
    const localeIndexRef = useRef(0);
    const rotatingRef = useRef(false);

    useEffect(() => {
        activeRef.current = active;
    }, [active]);

    const stop = useCallback(() => {
        setActive(false);
        setStatus("idle");
        setTranscript("");
        rotatingRef.current = false;
        try {
            serviceRef.current?.stop();
        } catch {
            /* noop */
        }
    }, []);
    stopRef.current = stop;

    const start = useCallback(() => {
        if (!supported) return;
        setTranscript("");
        // First guess = the app's current language (§2: most likely locale).
        const primary = SR_LOCALES.indexOf(SR_LANGS[language] || "en-IN");
        localeIndexRef.current = primary >= 0 ? primary : 0;
        setActive(true);
    }, [supported, language]);

    const toggle = useCallback(() => {
        if (active) stop();
        else start();
    }, [active, start, stop]);

    /* ---------- Handle one finalized utterance ---------- */
    const handleFinalTranscript = useCallback((text, alternatives = []) => {
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
            // §2/§3 fallback: rotate recognition to the next supported
            // locale so the next attempt (repeat/continuation) is heard in
            // another language. The Web Speech API cannot re-recognize past
            // audio, so the rotation is what makes mixed-language use
            // practical. After a full cycle we wrap to the app language.
            if (activeRef.current && !rotatingRef.current) {
                rotatingRef.current = true;
                localeIndexRef.current = (localeIndexRef.current + 1) % SR_LOCALES.length;
                serviceRef.current?.setLang(SR_LOCALES[localeIndexRef.current]);
            }
            showUnknownCommandFeedback();
            return;
        }
        // Success: this locale understood the farmer — keep it primary.
        rotatingRef.current = false;
        setLastCommand({ text, intent: parsed.intent, at: Date.now() });
        const handled = executeVoiceCommand(parsed, actionsRef.current);
        if (!handled) showUnknownCommandFeedback();
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
                    if (code === "not-allowed" || code === "service-not-allowed") {
                        // Microphone blocked — cannot keep listening.
                        stopRef.current?.();
                    }
                    // no-speech / network / aborted: stay in voice mode.
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

    /* Follow the app's language selector so farmers can speak Bangla/Hindi. */
    useEffect(() => {
        serviceRef.current?.setLang(SR_LANGS[language] || "en-IN");
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
        };
    }, [navigate, location.pathname, setTheme, changeLanguage]);

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
            start,
            stop,
            toggle,
        }),
        [active, status, transcript, supported, lastCommand, start, stop, toggle]
    );

    return (
        <VoiceModeContext.Provider value={value}>
            {children}
        </VoiceModeContext.Provider>
    );
}

export const useVoiceMode = () => useContext(VoiceModeContext);
