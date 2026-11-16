/**
 * VoiceRecognitionService — guarded wrapper around the browser's native Web
 * Speech API (SpeechRecognition). NO external speech-to-text service: the
 * browser does the recognition, this module only owns the lifecycle.
 *
 * Reliability contract (why this file exists):
 *  - ONE recogniser instance at a time. Every session gets a fresh instance
 *    and a generation number, so events from an aborted session can never
 *    mutate the state of a newer one.
 *  - Handlers are detached and the instance aborted before a replacement,
 *    before a language switch and on stop(), so no orphan keeps the mic open.
 *  - Temporary failures (`network`, unknown engine errors) retry a BOUNDED
 *    number of times with growing delays, then surface one clear error.
 *  - Permanent failures (`not-allowed`, `service-not-allowed`,
 *    `language-not-supported`, `audio-capture`, no API) never retry; the
 *    service stops and reports the code.
 *  - A denied microphone is remembered: starting again does not re-prompt.
 *  - `no-speech` / `aborted` are not errors (silence and our own restarts).
 *  - States: idle | starting | listening | restarting | error. `restarting`
 *    is emitted when the engine ends by itself or a retry is scheduled —
 *    never `listening`, so the UI cannot claim the mic is live when it isn't.
 *
 * Usage:
 *   const svc = createVoiceRecognitionService({ lang, onState, onFinal,
 *     onInterim, onError, onRetry });
 *   svc.start(); svc.stop(); svc.setLang("bn-IN");
 */

/** Max automatic retries for temporary engine failures. */
const MAX_RETRIES = 3;
/** Backoff before each retry (ms) — bounded, no infinite loop. */
const RETRY_DELAYS = [700, 1500, 3000];
/** Delay before restarting after the engine ends on its own (silence). */
const RESTART_DELAY = 300;

/** Failures that retrying cannot fix. */
const PERMANENT_ERRORS = new Set([
    "not-allowed",
    "service-not-allowed",
    "language-not-supported",
    "audio-capture",
    "unsupported",
]);

/** Errors we treat as temporary and retry. */
const TRANSIENT_ERRORS = new Set(["network", "start-failed", "unknown"]);

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
 *   onState(state)   – idle | starting | listening | restarting | error
 *   onFinal(text, alternatives)
 *   onInterim(text)
 *   onError(code)    – terminal failure; the service has already stopped
 *   onRetry(info)    – { attempt, max, delay, code } before a retry
 *   onLangApplied(lang)
 */
export function createVoiceRecognitionService({
    lang = "en-IN",
    onState,
    onFinal,
    onInterim,
    onError,
    onRetry,
    onLangApplied,
} = {}) {
    let handlers = { onState, onFinal, onInterim, onError, onRetry, onLangApplied };
    let currentLang = lang;
    let recognition = null;
    let wantActive = false; // user intent, not the engine's state
    let generation = 0; // invalidates callbacks of older sessions
    let retries = 0;
    let retryTimer = null;
    let restartTimer = null;
    let permissionBlocked = false; // remembered — never re-prompt in a loop
    let state = "idle";

    function emit(next) {
        state = next;
        try {
            handlers.onState?.(next);
        } catch {
            /* listener errors must never break the loop */
        }
    }

    function clearTimers() {
        if (retryTimer) clearTimeout(retryTimer);
        if (restartTimer) clearTimeout(restartTimer);
        retryTimer = null;
        restartTimer = null;
    }

    /** Remove every handler and abort the instance — no orphaned microphone. */
    function detach() {
        const rec = recognition;
        recognition = null;
        if (!rec) return;
        try {
            rec.onstart = null;
            rec.onresult = null;
            rec.onerror = null;
            rec.onend = null;
        } catch {
            /* some engines expose read-only handlers */
        }
        try {
            rec.abort?.();
        } catch {
            /* already ended */
        }
        try {
            rec.stop?.();
        } catch {
            /* already ended */
        }
    }

    /** Terminal stop: clean up, tell the UI exactly why, never pretend live. */
    function fail(code) {
        wantActive = false;
        clearTimers();
        generation += 1;
        detach();
        emit("error");
        try {
            handlers.onError?.(code);
        } catch {
            /* noop */
        }
    }

    function scheduleRestart(delay) {
        clearTimers();
        restartTimer = setTimeout(() => {
            restartTimer = null;
            if (!wantActive) return;
            beginSession();
        }, delay);
    }

    /** Retry a temporary failure a bounded number of times. */
    function scheduleRetry(code) {
        if (retries >= MAX_RETRIES) {
            fail(code);
            return;
        }
        retries += 1;
        const delay = RETRY_DELAYS[Math.min(retries - 1, RETRY_DELAYS.length - 1)];
        emit("restarting");
        detach();
        try {
            handlers.onRetry?.({ code, attempt: retries, max: MAX_RETRIES, delay });
        } catch {
            /* noop */
        }
        clearTimers();
        retryTimer = setTimeout(() => {
            retryTimer = null;
            if (!wantActive) return;
            beginSession();
        }, delay);
    }

    function handleError(code) {
        // Our own abort/restart — not a failure.
        if (code === "aborted") return;
        // Silence: the engine ends the session itself; onend restarts it.
        if (code === "no-speech") return;
        if (code === "not-allowed") permissionBlocked = true;
        if (PERMANENT_ERRORS.has(code)) {
            fail(code);
            return;
        }
        if (TRANSIENT_ERRORS.has(code)) {
            scheduleRetry(code);
            return;
        }
        // Unknown engine code: treat as temporary, still bounded.
        scheduleRetry(code);
    }

    /** Build a fresh recogniser and start it. Only one exists at a time. */
    function beginSession() {
        if (!wantActive) return;
        clearTimers();
        detach(); // guarantees no previous instance is alive

        const SR = getSpeechRecognitionCtor();
        if (!SR) {
            fail("unsupported");
            return;
        }

        const gen = (generation += 1);
        emit("starting");

        let rec;
        try {
            rec = new SR();
        } catch {
            fail("unsupported");
            return;
        }
        recognition = rec;
        try {
            rec.continuous = true;
            rec.interimResults = true;
            rec.maxAlternatives = 3;
            rec.lang = currentLang;
        } catch {
            /* engines with read-only options still work with defaults */
        }

        rec.onstart = () => {
            if (gen !== generation || !wantActive) return;
            emit("listening");
        };

        rec.onresult = (event) => {
            if (gen !== generation || !wantActive) return;
            let interim = "";
            let finalText = "";
            const finalAlts = [];
            const results = event?.results || [];
            for (let i = event?.resultIndex || 0; i < results.length; i++) {
                const result = results[i];
                if (!result) continue;
                const text = result[0]?.transcript || "";
                if (result.isFinal) {
                    finalText += text;
                    for (let j = 0; j < result.length && j < 3; j++) {
                        const alt = result[j]?.transcript?.trim();
                        if (alt && !finalAlts.includes(alt)) finalAlts.push(alt);
                    }
                } else {
                    interim += text;
                }
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
                // The engine demonstrably works — give future failures a full
                // retry budget again.
                retries = 0;
                try {
                    handlers.onFinal?.(final, finalAlts);
                } catch {
                    /* noop */
                }
            }
        };

        rec.onerror = (event) => {
            if (gen !== generation) return;
            handleError(event?.error || "unknown");
        };

        rec.onend = () => {
            if (gen !== generation) return;
            // This instance is finished either way.
            recognition = null;
            if (!wantActive) {
                emit("idle");
                return;
            }
            // Browsers end continuous sessions after silence; keep the user's
            // intent alive but say "restarting" — never "listening".
            emit("restarting");
            scheduleRestart(RESTART_DELAY);
        };

        try {
            rec.start();
        } catch {
            // Typically InvalidStateError from a still-closing engine.
            handleError("start-failed");
        }
    }

    return {
        /** Begin listening. No-op when already active. */
        start() {
            if (wantActive) return;
            if (permissionBlocked) {
                // Remembered denial: explaining beats re-prompting forever.
                wantActive = false;
                emit("error");
                try {
                    handlers.onError?.("not-allowed");
                } catch {
                    /* noop */
                }
                return;
            }
            wantActive = true;
            retries = 0;
            // Start synchronously from the user's click/tap. An async
            // Permissions API preflight can consume transient user activation
            // and make browsers reject SpeechRecognition.start() before they
            // can show their own microphone permission prompt. The recognition
            // API reports denied permissions via its normal `not-allowed`
            // error, which is handled and remembered above.
            beginSession();
        },

        /** Stop immediately: timers cleared, handlers detached, mic released. */
        stop() {
            wantActive = false;
            clearTimers();
            generation += 1;
            detach();
            emit("idle");
        },

        /**
         * Switch recognition language. An active session is stopped safely and
         * restarted with the new locale; the retry budget resets because this
         * is a fresh configuration, not a failure loop.
         */
        setLang(nextLang) {
            if (!nextLang || nextLang === currentLang) return;
            currentLang = nextLang;
            try {
                handlers.onLangApplied?.(nextLang);
            } catch {
                /* noop */
            }
            if (!wantActive) return;
            retries = 0;
            clearTimers();
            emit("starting");
            beginSession();
        },

        getLang: () => currentLang,
        isListening: () => wantActive,
        getState: () => state,
        /** Replace callbacks without disturbing the running session. */
        setHandlers(next = {}) {
            handlers = { ...handlers, ...next };
        },
    };
}
