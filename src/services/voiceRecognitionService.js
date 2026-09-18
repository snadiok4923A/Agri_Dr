/**
 * VoiceRecognitionService — thin, safe wrapper around the browser's native
 * Web Speech API (SpeechRecognition). NO external AI service, NO network
 * speech-to-text beyond what the browser itself provides.
 *
 * Responsibilities:
 *  - Detect support (window.SpeechRecognition || window.webkitSpeechRecognition)
 *  - Run continuous sessions that self-restart when the engine ends on its own
 *    (browsers stop recognition after silence; we restart unless the user
 *    explicitly stopped)
 *  - Surface final transcripts + lifecycle state through small callbacks
 *  - Never throw: every browser API touch is guarded
 *
 * Usage:
 *   const svc = createVoiceRecognitionService({ lang, onFinal, onInterim, onState, onError });
 *   svc.start(); svc.stop(); svc.setLang("bn-IN"); svc.isListening();
 */

/**
 * @returns {Function|null} the SpeechRecognition constructor, or null when
 * the browser does not support the Web Speech API.
 */
export function getSpeechRecognitionCtor() {
    if (typeof window === "undefined") return null;
    return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

/** True when this browser can run voice recognition at all. */
export function isSpeechRecognitionSupported() {
    return Boolean(getSpeechRecognitionCtor());
}

/**
 * Create a recognition service instance.
 * Callbacks (all optional):
 *   onState(state)   – "idle" | "starting" | "listening" | "restarting"
 *   onFinal(text)    – finalized utterance (trimmed, non-empty)
 *   onInterim(text)  – live partial transcript (may be "")
 *   onError(code)    – recognition error code ("not-allowed", "network", …)
 *   onLangApplied(l) – confirmation that a recognition.lang change was applied
 */
export function createVoiceRecognitionService({
    lang = "en-IN",
    onState,
    onFinal,
    onInterim,
    onError,
    onLangApplied,
} = {}) {
    // Latest-callback holders — mutable config so the recognition loop can
    // always call the current closures without a restart.
    let handlers = { onState, onFinal, onInterim, onError, onLangApplied };
    let currentLang = lang;
    let recognition = null;
    let wantActive = false; // user intent — NOT the same as the engine's state
    let restarting = false;

    function emitState(state) {
        try {
            handlers.onState?.(state);
        } catch {
            /* listener errors must never break the loop */
        }
    }

    function buildRecognition() {
        const SR = getSpeechRecognitionCtor();
        if (!SR) return null;
        const rec = new SR();
        rec.continuous = true; // keep listening across utterances
        rec.interimResults = true; // live "Listening…" feedback
        rec.maxAlternatives = 3; // §30: alternatives help ambiguous commands
        rec.lang = currentLang;

        rec.onstart = () => {
            restarting = false;
            emitState("listening");
        };

        rec.onresult = (event) => {
            let interim = "";
            let finalText = "";
            let finalAlts = [];
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const result = event.results[i];
                const text = result[0]?.transcript || "";
                if (result.isFinal) {
                    finalText += text;
                    // Collect up to 3 recognition alternatives (§30) — the
                    // parser tries them in order when the first is unclear.
                    for (let j = 0; j < result.length && j < 3; j++) {
                        const alt = result[j]?.transcript?.trim();
                        if (alt && !finalAlts.includes(alt)) finalAlts.push(alt);
                    }
                } else interim += text;
            }
            if (interim.trim()) {
                try {
                    handlers.onInterim?.(interim.trim());
                } catch {
                    /* noop */
                }
            }
            const final = finalText.trim();
            if (final) {
                try {
                    handlers.onFinal?.(final, finalAlts);
                } catch {
                    /* noop */
                }
            }
        };

        rec.onerror = (event) => {
            const code = event?.error || "unknown";
            // Recoverable: keep voice mode alive, surface for debugging only.
            if (code === "no-speech" || code === "aborted") return;
            try {
                handlers.onError?.(code);
            } catch {
                /* noop */
            }
        };

        rec.onend = () => {
            // Browsers end sessions after silence or per-utterance.
            // While the user still wants voice mode, restart automatically.
            if (wantActive) {
                restarting = true;
                emitState("restarting");
                // Small delay avoids "already started" InvalidStateError loops.
                setTimeout(() => {
                    if (!wantActive) return;
                    try {
                        recognition?.start();
                    } catch {
                        /* already running — onstart will clear `restarting` */
                    }
                }, 250);
            } else {
                emitState("idle");
            }
        };

        return rec;
    }

    return {
        /** Begin a persistent listening session (no-op if already active). */
        start() {
            if (wantActive) return;
            const SR = getSpeechRecognitionCtor();
            if (!SR) {
                try {
                    handlers.onError?.("unsupported");
                } catch {
                    /* noop */
                }
                return;
            }
            wantActive = true;
            emitState("starting");
            if (!recognition) recognition = buildRecognition();
            try {
                recognition.lang = currentLang;
                recognition.start();
            } catch {
                /* start() called while already started — onend will recover */
            }
        },

        /** Fully stop the session (user intent — no auto-restart). */
        stop() {
            wantActive = false;
            restarting = false;
            try {
                recognition?.stop();
            } catch {
                /* noop */
            }
            recognition = null;
            emitState("idle");
        },

        /**
         * Change the recognition language (applies live where the engine
         * supports it; otherwise takes effect on the next auto-restart).
         */
        setLang(nextLang) {
            if (!nextLang || nextLang === currentLang) return;
            currentLang = nextLang;
            try {
                if (recognition && !wantActive) recognition.lang = nextLang;
                else if (recognition) {
                    // Restart so the new language is guaranteed to apply.
                    try {
                        recognition.stop();
                    } catch {
                        /* onend restarts with the new lang */
                    }
                }
                try {
                    handlers.onLangApplied?.(nextLang);
                } catch {
                    /* noop */
                }
            } catch {
                /* never throw from a language switch */
            }
        },

        getLang: () => currentLang,
        isListening: () => wantActive,
        /** Replace callbacks wholesale (keeps the recognition loop alive). */
        setHandlers(next = {}) {
            handlers = { ...handlers, ...next };
        },
    };
}
