import {
    createContext,
    useContext,
    useState,
    useEffect,
    useCallback,
    useRef,
} from "react";

/**
 * VoiceMode context — a clean, extensible foundation for a persistent
 * voice-controlled assistant.
 *
 * - Activation is PERSISTENT: mode stays on until stop() is called or the
 *   user navigates to another page (see Dashboard's useVoiceModeStopOnNavigate).
 * - Speech recognition (when supported) runs continuously and restarts itself
 *   after each utterance — it never auto-disables the mode.
 * - Commands are registered via registerCommands(); the handler is kept in a
 *   ref so the recognition loop always sees the latest handlers without
 *   needing to restart recognition.
 */

const VoiceModeContext = createContext(null);

export function VoiceModeProvider({ children }) {
    const [active, setActive] = useState(false);
    const [transcript, setTranscript] = useState("");
    const [supported, setSupported] = useState(false);
    const [lastCommand, setLastCommand] = useState(null);

    // Registry of command handlers: { id: (text) => boolean|void }
    const commandHandlersRef = useRef({});

    // Recognition instance lives in a ref so React re-renders never reset it
    const recognitionRef = useRef(null);

    useEffect(() => {
        const SR =
            window.SpeechRecognition || window.webkitSpeechRecognition || null;
        setSupported(Boolean(SR));
    }, []);

    const stop = useCallback(() => {
        setActive(false);
        setTranscript("");
        try {
            recognitionRef.current?.stop();
        } catch {
            /* noop */
        }
    }, []);

    const start = useCallback(() => {
        setTranscript("");
        setActive(true);
    }, []);

    const toggle = useCallback(() => {
        if (active) stop();
        else start();
    }, [active, start, stop]);

    // ---- Speech recognition loop (continuous, self-restarting) ----
    useEffect(() => {
        if (!active || !supported) return undefined;

        const SR =
            window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SR();
        recognitionRef.current = recognition;
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang =
            document.documentElement.getAttribute("lang") || "en";

        recognition.onresult = (event) => {
            let interim = "";
            let final = "";
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const res = event.results[i];
                if (res.isFinal) final += res[0].transcript;
                else interim += res[i][0].transcript;
            }
            setTranscript(final || interim);
            if (final) {
                const text = final.trim().toLowerCase();
                setLastCommand({ text, at: Date.now() });
                const handlers = Object.values(commandHandlersRef.current);
                for (const handler of handlers) {
                    try {
                        const consumed = handler?.(text);
                        if (consumed) break;
                        // A handler returning true "consumed" the command
                    } catch {
                        /* keep other handlers running */
                    }
                }
            }
        };

        recognition.onerror = () => {
            /* errors (no-speech, network) must NOT end voice mode */
        };

        recognition.onend = () => {
            // Keep the session alive: restart unless mode was explicitly stopped
            if (recognitionRef.current === recognition && activeRef.current) {
                try {
                    recognition.start();
                } catch {
                    /* already started */
                }
                return;
            }
        };

        try {
            recognition.start();
        } catch {
            /* noop */
        }

        return () => {
            recognitionRef.current = null;
            try {
                recognition.stop();
            } catch {
                /* noop */
            }
        };
    }, [active, supported]);

    // Keep a ref of `active` for the async recognition.onend callback
    const activeRef = useRef(active);
    useEffect(() => {
        activeRef.current = active;
    }, [active]);

    // Register/unregister command handlers
    const registerCommands = useCallback((handlers) => {
        commandHandlersRef.current = {
            ...commandHandlersRef.current,
            ...handlers,
        };
        return () => {
            for (const id of Object.keys(handlers)) {
                delete commandHandlersRef.current[id];
            }
        };
    }, []);

    const value = {
        active,
        transcript,
        supported,
        lastCommand,
        start,
        stop,
        toggle,
        registerCommands,
    };

    return (
        <VoiceModeContext.Provider value={value}>
            {children}
        </VoiceModeContext.Provider>
    );
}

export const useVoiceMode = () => useContext(VoiceModeContext);

/**
 * Convenience hook for pages: stop voice mode when this page unmounts
 * (i.e. the user navigated to another dashboard page).
 */
export function useVoiceModeStopOnUnmount() {
    const { stop } = useVoiceMode();
    useEffect(() => () => stop(), [stop]);
}
