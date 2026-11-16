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
 * Flow:
 *   microphone → Web Speech API (native, no external service) → final
 *   transcript → parseVoiceCommand() (pure rules) → executeVoiceCommand()
 *   (whitelisted actions) → UI toast feedback.
 *
 * LIFECYCLE (see voiceRecognitionService):
 *   status: idle | starting | listening | restarting | processing | error.
 *   `listening` is only ever emitted by the engine's own onstart; when the
 *   engine ends or the service retries, status becomes `restarting`. A
 *   terminal failure stops the service, clears `active`, and surfaces a
 *   localized error — the card can never stay stuck on "Listening…".
 *   Temporary `network` failures are retried (bounded) inside the service;
 *   `retryInfo` exposes the attempt for the "Reconnecting…" label.
 *
 * LANGUAGE (single source of truth: useLanguage):
 *   recognition.lang follows the website language; changing it restarts an
 *   active session with the new locale. No silent English fallback.
 *
 * TEXT FALLBACK: `submitText` runs the SAME parser/executor as a transcript.
 *   A sentence that is not a command opens the AI Doctor with the question
 *   preserved (that page owns the assistant conversation).
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
    "start-failed": "voiceServiceUnavailable",
    unsupported: "voiceUnsupported",
};

/** Same final transcript delivered twice in quick succession = one command.
 *  (Continuous recognition + the end/restart cycle can replay a result.) */
const DUPLICATE_WINDOW_MS = 1200;

/** How long the "Processing…" state is shown after a transcript/question. */
const PROCESSING_MS = 700;

/** Typed text that is a question, not a command. Spoken input has no
 *  punctuation, so this only applies to the text fallback: a sentence like
 *  "which variety gives the best profit?" contains the word "profit" but
 *  must reach the assistant instead of opening the finance page. */
const QUESTION_OPENER =
    /^(what|which|how|when|where|why|who|whose|is|are|can|could|should|do|does|did|will|would)\b/i;

function looksLikeQuestion(text) {
    return /[?？]\s*$/.test(text) || QUESTION_OPENER.test(text.trim());
}

/** DOM event used to open the Dashboard's floating Weather modal from voice. */
export const VOICE_OPEN_WEATHER_EVENT = "krisiveda:voice-open-weather";

/** DOM event used to open the mobile drawer (sidebar) from voice (§13/§38). */
export const VOICE_OPEN_SIDEBAR_EVENT = "krisiveda:voice-open-sidebar";

export function VoiceModeProvider({ children }) {
    const [active, setActive] = useState(false);
    const [status, setStatus] = useState("idle");
    const [transcript, setTranscript] = useState("");
    const [lastCommand, setLastCommand] = useState(null); // { text, intent, at }
    const [voiceError, setVoiceError] = useState(null); // ai.* key suffix
    const [retryInfo, setRetryInfo] = useState(null); // { attempt, max }
    const [retryable, setRetryable] = useState(false); // temporary failure?
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
    const processingTimerRef = useRef(null);

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
        clearTimeout(processingTimerRef.current);
        setActive(false);
        setStatus("idle");
        setTranscript("");
        setVoiceError(null);
        setRetryInfo(null);
        setRetryable(false);
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
        clearTimeout(processingTimerRef.current);
        setTranscript("");
        setVoiceError(null);
        setRetryInfo(null);
        setRetryable(false);
        lastFinalRef.current = { text: "", at: 0 };
        setActive(true);
    }, [supported]);

    const toggle = useCallback(() => {
        if (active) stop();
        else start();
    }, [active, start, stop]);

    /** Retry after a terminal failure (fresh attempt budget). */
    const retry = useCallback(() => {
        setVoiceError(null);
        setRetryInfo(null);
        setRetryable(false);
        if (active) {
            // Force a clean restart even if React still sees `active`.
            stopRef.current?.();
            setTimeout(() => start(), 0);
            return;
        }
        start();
    }, [active, start]);

    /** Show processing, then fall back to whatever the engine is really doing. */
    const showProcessing = useCallback(() => {
        setStatus("processing");
        clearTimeout(processingTimerRef.current);
        processingTimerRef.current = setTimeout(() => {
            if (!activeRef.current) return;
            // Only return to Listening if the engine is genuinely listening;
            // a session that ended in the meantime keeps its own status.
            if (serviceRef.current?.getState() === "listening") {
                setStatus("listening");
            }
        }, PROCESSING_MS);
    }, []);

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
        showProcessing();
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
    }, [showProcessing]);

    /* ---------- Recognition service lifecycle ---------- */
    useEffect(() => {
        if (!active || !supported) return undefined;

        const service =
            serviceRef.current ||
            createVoiceRecognitionService({
                lang: SR_LANGS[language] || "en-IN",
                onState: (s) => {
                    setStatus(s);
                    if (s === "listening") setRetryInfo(null);
                },
                onInterim: (next) => setTranscript(next),
                onRetry: (info) =>
                    setRetryInfo({ attempt: info.attempt, max: info.max }),
                onError: (code) => {
                    // The service has already stopped and released the mic.
                    setVoiceError(VOICE_ERROR_KEYS[code] || "voiceServiceUnavailable");
                    setRetryable(code === "network" || code === "start-failed");
                    setRetryInfo(null);
                    setActive(false);
                    setStatus("idle");
                },
            });
        serviceRef.current = service;
        service.setHandlers({
            onFinal: handleFinalTranscript,
            onState: (s) => {
                setStatus(s);
                if (s === "listening") setRetryInfo(null);
            },
            onRetry: (info) =>
                setRetryInfo({ attempt: info.attempt, max: info.max }),
            onError: (code) => {
                setVoiceError(VOICE_ERROR_KEYS[code] || "voiceServiceUnavailable");
                setRetryable(code === "network" || code === "start-failed");
                setRetryInfo(null);
                setActive(false);
                setStatus("idle");
            },
        });
        service.setLang(SR_LANGS[language] || "en-IN");
        service.start();

        return () => {
            // stop() is explicit everywhere; the provider also stops on
            // unmount below, so a navigation can never leave the mic open.
        };
    }, [active, supported, handleFinalTranscript]); // eslint-disable-line react-hooks/exhaustive-deps

    /* Follow the app's language selector: an active session is stopped and
       restarted by the service with the new locale. */
    useEffect(() => {
        serviceRef.current?.setLang(SR_LANGS[language] || "en-IN");
        setVoiceError(null);
    }, [language]);

    /* Provider unmount = no Voice Mode: release the microphone. */
    useEffect(
        () => () => {
            clearTimeout(processingTimerRef.current);
            try {
                serviceRef.current?.stop();
            } catch {
                /* noop */
            }
            serviceRef.current = null;
        },
        [],
    );

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

    /**
     * Typed fallback — the same rule parser and executor a transcript uses.
     * A real question (not a command) is handed to the assistant page with
     * the text intact, so nothing is lost and no answer is invented here.
     */
    const submitText = useCallback(
        (text) => {
            const trimmed = String(text || "").trim();
            if (!trimmed) return false;
            // A typed submission is a working fallback: clear the failure
            // state so the card does not keep showing a dead engine.
            setVoiceError(null);
            setRetryInfo(null);
            setRetryable(false);
            setTranscript(trimmed);
            showProcessing();
            const parsed = looksLikeQuestion(trimmed)
                ? null
                : parseVoiceCommand(trimmed);
            if (parsed) {
                setLastCommand({ text: trimmed, intent: parsed.intent, at: Date.now() });
                const handled = executeVoiceCommand(parsed, actionsRef.current);
                if (handled) return true;
            }
            navigate("/ai-doctor", { state: { question: trimmed } });
            return true;
        },
        [navigate, showProcessing],
    );

    /* PERF: recognition streams interim transcripts constantly while
       listening — every one of those setState calls re-renders the
       provider. A stable value object keeps that churn scoped to the
       components that actually show voice state. */
    const value = useMemo(
        () => ({
            active,
            status,
            transcript,
            supported,
            lastCommand,
            voiceError,
            retryInfo,
            retryable,
            start,
            stop,
            toggle,
            retry,
            submitText,
        }),
        [
            active,
            status,
            transcript,
            supported,
            lastCommand,
            voiceError,
            retryInfo,
            retryable,
            start,
            stop,
            toggle,
            retry,
            submitText,
        ]
    );

    return (
        <VoiceModeContext.Provider value={value}>
            {children}
        </VoiceModeContext.Provider>
    );
}

export const useVoiceMode = () => useContext(VoiceModeContext);
