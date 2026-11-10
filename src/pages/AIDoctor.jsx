import { useState, useRef, useEffect } from "react";
import { useLanguage } from "../hooks/useLanguage";
import {
    Camera,
    Mic,
    MicOff,
    AlertCircle,
    Plus,
    Send,
    Volume2,
    Bot,
    User,
    Sparkles,
    Stethoscope,
    Bug,
    TrendingUp,
    DollarSign,
} from "lucide-react";
import {
    createVoiceRecognitionService,
    isSpeechRecognitionSupported,
} from "../services/voiceRecognitionService";
import "./AIDoctor.css";

const suggestedQuestions = {
    en: [
        "Which rice variety yields the highest profit?",
        "What medicine and dosage should I use for Leaf Blast?",
        "How much fertilizer is needed for IR-64 tillering?",
        "When is the best time to sell Basmati at APMC mandi?",
    ],
    bn: [
        "কোন ধানের জাত সবচেয়ে বেশি লাভ দেয়?",
        "ব্লাস্ট রোগের জন্য কোন ওষুধ এবং কী পরিমাণ ডোজ দেব?",
        "IR-64 টিলারিং পর্যায়ে কত সার প্রয়োজন?",
        "বাসমতী ধান মান্ডিতে বিক্রির সেরা সময় কখন?",
    ],
    hi: [
        "कौन सी धान की किस्म सबसे अधिक लाभ देती है?",
        "लीफ ब्लास्ट के लिए कौन सी दवा और कितनी खुराक दूं?",
        "IR-64 टिलरिंग चरण में कितनी खाद की आवश्यकता है?",
        "मंडी में बासमती बेचने का सबसे अच्छा समय कब है?",
    ],
    te: [
        "ఏ వరి రకం అత్యధిక లాభాన్ని ఇస్తుంది?",
        "లీఫ్ బ్లాస్ట్ కోసం ఏ మందు మరియు మోతాదు వాడాలి?",
        "IR-64 టిల్లరింగ్ దశకు ఎంత ఎరువు అవసరం?",
        "బాస్మతిని మార్కెట్‌లో విక్రయించడానికి ఉత్తమ సమయం ఏది?",
    ],
    ta: [
        "எந்த நெல் ரகம் அதிக லாபம் தரும்?",
        "இலை கருகல் நோய்க்கு என்ன மருந்து, எவ்வளவு அளவு பயன்படுத்த வேண்டும்?",
        "IR-64 தூர் கட்டும் நிலைக்கு எவ்வளவு உரம் தேவை?",
        "பாசுமதி நெல்லை மண்டியில் விற்க சிறந்த நேரம் எது?",
    ],
};

const mockDiagnosis = {
    problem: "Rice Leaf Blast (Swarna Variety · Field B)",
    confidence: 94,
    severity: "Immediate Treatment Required",
    medicine: "Tricyclazole 75% WP (Baan / Beam)",
    dosage: "0.6 g / liter of water (120 g per acre with 200L water)",
    treatmentCost: "₹1,200 input cost",
    productionImpact:
        "Untreated blast risks -15% yield loss (~0.5 Ton / ₹16,700 loss). Immediate spraying saves full target yield.",
    actions: [
        "Prepare spray tank with Tricyclazole 75% WP @ 0.6 g/L water",
        "Spray in early morning or late afternoon when wind speed is under 10 km/h",
        "Temporarily withhold excess nitrogen/urea top-dressing until lesion margins dry up",
        "Recheck Field B after 4 days to confirm fungal lesion sporulation has halted",
    ],
};

/* Spoken-language choices for the browser's Web Speech engine. Labels are
   shown in their own language; the codes match useLanguage's voice locales. */
const VOICE_LOCALES = [
    { code: "en-IN", label: "English" },
    { code: "hi-IN", label: "हिन्दी" },
    { code: "bn-IN", label: "বাংলা" },
    { code: "te-IN", label: "తెలుగు" },
    { code: "ta-IN", label: "தமிழ்" },
];

const APP_VOICE_LOCALE = {
    en: "en-IN",
    bn: "bn-IN",
    hi: "hi-IN",
    te: "te-IN",
    ta: "ta-IN",
};

export default function AIDoctor() {
    const { t, language, formatNumber } = useLanguage();
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const [scanning, setScanning] = useState(false);
    const [plusOpen, setPlusOpen] = useState(false);
    // Voice input state — browser Web Speech API only (no AI, no backend).
    const [voiceSupported] = useState(() => isSpeechRecognitionSupported());
    const [voiceStatus, setVoiceStatus] = useState("idle"); // idle | starting | listening | restarting
    const [interim, setInterim] = useState("");
    const [voiceError, setVoiceError] = useState(""); // translation key suffix
    const [voiceHint, setVoiceHint] = useState(false);
    const [voiceLang, setVoiceLang] = useState(
        () => APP_VOICE_LOCALE[language] || "en-IN",
    );
    const messagesEndRef = useRef(null);
    const chatbarRef = useRef(null);
    const inputRef = useRef(null);
    const voiceRef = useRef(null);
    const voiceStatusRef = useRef("idle");
    const voiceWatchdogRef = useRef(null);
    const noSpeechTimerRef = useRef(null);
    // Latest partial transcript — kept in a ref so a stop/error can always
    // salvage it, even from inside a stale callback closure.
    const partialRef = useRef("");
    const capturedRef = useRef(false); // did this session hear anything?
    const startedAtRef = useRef(0);
    const listening = voiceStatus !== "idle";

    // Close the "+" actions menu when clicking outside the chat bar
    useEffect(() => {
        if (!plusOpen) return;
        const onPointerDown = (e) => {
            if (chatbarRef.current && !chatbarRef.current.contains(e.target)) {
                setPlusOpen(false);
            }
        };
        document.addEventListener("pointerdown", onPointerDown);
        return () => document.removeEventListener("pointerdown", onPointerDown);
    }, [plusOpen]);

    /* ------------------------------------------------------------------
       Voice input — browser Web Speech API only.
       No AI model, no backend and no external speech service is involved:
       the browser transcribes speech and we append the text to the input.
       Recognised speech is NEVER sent automatically.
    ------------------------------------------------------------------ */

    const clearVoiceTimers = () => {
        if (voiceWatchdogRef.current) {
            clearTimeout(voiceWatchdogRef.current);
            voiceWatchdogRef.current = null;
        }
        if (noSpeechTimerRef.current) {
            clearTimeout(noSpeechTimerRef.current);
            noSpeechTimerRef.current = null;
        }
    };

    const applyVoiceStatus = (next) => {
        voiceStatusRef.current = next;
        setVoiceStatus(next);
    };

    /* Append recognised text to the message box instead of replacing it, so
       nothing the user typed — or said earlier in the session — is ever
       thrown away. */
    const appendToInput = (text) => {
        const chunk = text.trim();
        if (!chunk) return;
        setInput((prev) => (prev.trim() ? `${prev.trim()} ${chunk}` : chunk));
    };

    /* A session that ends must keep whatever was already recognised, even if
       the engine never got to mark it final. */
    const commitPartial = () => {
        const partial = (partialRef.current || "").trim();
        partialRef.current = "";
        if (partial) appendToInput(partial);
        setInterim("");
    };

    /**
     * End the session. `error` is a translation-key suffix; `noSpeech` asks
     * for the "nothing was heard" message when no speech was captured.
     */
    const stopVoice = (options) => {
        // Tolerate being used directly as a click handler.
        const { error = "", noSpeech = false } = options?.nativeEvent
            ? {}
            : options || {};
        clearVoiceTimers();
        const service = voiceRef.current;
        voiceRef.current = null;
        try {
            service?.stop();
        } catch {
            /* stopping must never throw */
        }
        commitPartial();
        const heardSomething = capturedRef.current;
        const listenedFor = Date.now() - startedAtRef.current;
        capturedRef.current = false;
        applyVoiceStatus("idle");
        setVoiceHint(false);
        if (error) setVoiceError(error);
        // Distinguish "no speech detected" from an engine failure: only the
        // deliberate stop after a real listening window claims it.
        else if (noSpeech && !heardSomething && listenedFor >= 2500) {
            setVoiceError("voiceNoSpeech");
        }
    };

    function handleVoiceError(code) {
        if (code === "aborted") return;
        if (code === "no-speech") {
            // Recoverable — the engine keeps listening, so explain it instead
            // of tearing the session down.
            setVoiceHint(true);
            return;
        }
        let key = "voiceStartFailed";
        if (code === "not-allowed") {
            key = "voiceDenied";
        } else if (code === "audio-capture") {
            key = "voiceNoMic";
        } else if (code === "service-not-allowed") {
            // The browser refused its speech service (policy, extension or
            // blocked endpoint) — that is not a microphone permission issue.
            key = "voiceServiceUnavailable";
        } else if (code === "language-not-supported") {
            key = "voiceLangUnsupported";
        } else if (code === "network") {
            // Browsers report a single `network` code both for a real outage
            // and for their speech endpoint being unreachable, so only call
            // it "offline" when the device actually is offline.
            const offline =
                typeof navigator !== "undefined" && navigator.onLine === false;
            key = offline ? "voiceOffline" : "voiceServiceUnavailable";
        }
        stopVoice({ error: key });
    }

    const startVoice = () => {
        if (!voiceSupported) {
            setVoiceError("voiceUnsupported");
            return;
        }
        setVoiceError("");
        setVoiceHint(false);
        applyVoiceStatus("starting");
        partialRef.current = "";
        capturedRef.current = false;
        startedAtRef.current = Date.now();

        let service = voiceRef.current;
        if (!service) {
            service = createVoiceRecognitionService({
                lang: voiceLang,
                onState: (state) => {
                    if (state === "idle") {
                        // The engine gave up while we still thought it was
                        // running — never leave the UI stuck in audio state.
                        if (voiceRef.current) {
                            voiceRef.current = null;
                            clearVoiceTimers();
                            commitPartial();
                            setVoiceHint(false);
                            applyVoiceStatus("idle");
                        }
                        return;
                    }
                    if (!voiceRef.current) return; // late event after Stop
                    applyVoiceStatus(state);
                    if (state === "listening") {
                        clearVoiceTimers();
                        // No-speech feedback: the engine keeps listening, we
                        // just tell the user we have not heard anything yet.
                        noSpeechTimerRef.current = setTimeout(() => {
                            if (voiceRef.current) setVoiceHint(true);
                        }, 12000);
                    }
                },
                onInterim: (text) => {
                    partialRef.current = text;
                    setInterim(text);
                    if (text) {
                        capturedRef.current = true;
                        setVoiceHint(false);
                    }
                },
                onFinal: (text) => {
                    // Append for review — the user decides when to send.
                    partialRef.current = "";
                    capturedRef.current = true;
                    setVoiceHint(false);
                    appendToInput(text);
                },
                onError: handleVoiceError,
            });
            voiceRef.current = service;
        }

        // Safety net: if the engine never reports "listening" (permission
        // prompt dismissed, browser quirk), fail loudly instead of spinning.
        voiceWatchdogRef.current = setTimeout(() => {
            if (voiceStatusRef.current !== "starting") return;
            stopVoice({ error: "voiceStartFailed" });
        }, 8000);

        service.setLang(voiceLang);
        service.start();
    };

    const toggleVoice = () => {
        if (voiceStatusRef.current !== "idle") stopVoice();
        else startVoice();
    };

    const handleVoiceLang = (next) => {
        setVoiceLang(next);
        voiceRef.current?.setLang(next);
    };

    /* Follow the app language as the default spoken language. */
    useEffect(() => {
        if (voiceRef.current) return;
        setVoiceLang(APP_VOICE_LOCALE[language] || "en-IN");
    }, [language]);

    /* Losing the connection mid-session ends recognition inside the browser:
       stop cleanly, keep what was heard, and say it is the connection. */
    useEffect(() => {
        if (!listening) return;
        const handleOffline = () => {
            if (voiceStatusRef.current === "idle") return;
            stopVoice({ error: "voiceOffline" });
        };
        window.addEventListener("offline", handleOffline);
        return () => window.removeEventListener("offline", handleOffline);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [listening]);

    /* Explicit text fallback offered next to every voice error. */
    const focusMessageInput = () => {
        setVoiceError("");
        inputRef.current?.focus();
    };

    /* Leaving the page must never leave the microphone open. */
    useEffect(
        () => () => {
            clearVoiceTimers();
            const service = voiceRef.current;
            voiceRef.current = null;
            try {
                service?.stop();
            } catch {
                /* ignore */
            }
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );

    const scrollToBottom = () =>
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });

    /* Deliberately model-free: the question becomes a user message and
       nothing else. No AI answer is invented while the backend is absent. */
    const sendMessage = (text) => {
        const trimmed = text.trim();
        if (!trimmed) return;
        setMessages((prev) => [
            ...prev,
            { role: "user", content: trimmed, timestamp: new Date() },
        ]);
        setInput("");
        setPlusOpen(false);
        setVoiceError("");
        setTimeout(scrollToBottom, 50);
    };

    const handleInputChange = (e) => {
        setInput(e.target.value);
        if (voiceError) setVoiceError("");
    };

    const handlePhoto = () => {
        setScanning(true);
        setTimeout(() => {
            setScanning(false);
            setMessages((prev) => [
                ...prev,
                {
                    role: "assistant",
                    isDiagnosis: true,
                    diagnosis: mockDiagnosis,
                    timestamp: new Date(),
                },
            ]);
            setTimeout(scrollToBottom, 100);
        }, 2000);
    };

    return (
        <div className="page-container ai-doctor">
            <section className="ai-doctor__header section">
                <div>
                    <h1 className="ai-doctor__title">{t("ai.askKrisiveda")}</h1>
                    <p className="ai-doctor__subtitle">
                        {t("ai.subtitle")}
                    </p>
                </div>
            </section>

            {messages.length === 0 && !scanning ? (
                <section className="ai-doctor__hero">
                    <div className="ai-doctor__hero-icon">
                        <Stethoscope size={48} />
                    </div>
                    <h2 className="ai-doctor__hero-title">
                        {t("ai.askKrisiveda")}
                    </h2>
                    <p className="ai-doctor__hero-subtitle">
                        {t("ai.heroSubtitle")}
                    </p>
                    <div className="ai-doctor__actions">
                        <button
                            className="ai-doctor__action-btn"
                            onClick={handlePhoto}
                        >
                            <Camera size={22} />
                            <span>{t("ai.takePhoto")}</span>
                        </button>
                        <button
                            className={`ai-doctor__action-btn ai-doctor__action-btn--voice${listening ? " ai-doctor__action-btn--active" : ""}`}
                            onClick={toggleVoice}
                            aria-pressed={listening}
                        >
                            {listening ? <MicOff size={22} /> : <Mic size={22} />}
                            <span>
                                {listening
                                    ? t("ai.stopListening")
                                    : t("ai.askByVoice")}
                            </span>
                        </button>
                    </div>
                    <div className="ai-doctor__suggested">
                        <span className="ai-doctor__suggested-label">
                            {t("ai.suggestedQuestions")}
                        </span>
                        <div className="ai-doctor__suggested-list">
                            {(
                                suggestedQuestions[language] ||
                                suggestedQuestions.en
                            ).map((q, i) => (
                                <button
                                    key={i}
                                    className="ai-doctor__suggested-btn"
                                    onClick={() => sendMessage(q)}
                                >
                                    <Sparkles size={14} />
                                    {q}
                                </button>
                            ))}
                        </div>
                    </div>
                </section>
            ) : (
                <div className="ai-doctor__chat">
                    <div className="ai-doctor__messages">
                        {messages.map((msg, i) => (
                            <div
                                key={i}
                                className={`ai-doctor__message ai-doctor__message--${msg.role}`}
                            >
                                <div
                                    className={`ai-doctor__message-avatar ${msg.role === "assistant" ? "ai-doctor__message-avatar--ai" : ""}`}
                                >
                                    {msg.role === "assistant" ? (
                                        <Bot size={18} />
                                    ) : (
                                        <User size={18} />
                                    )}
                                </div>
                                <div className="ai-doctor__message-content">
                                    {msg.isDiagnosis ? (
                                        <div className="ai-doctor__diagnosis">
                                            <div className="ai-doctor__diagnosis-header">
                                                <Bug size={18} />
                                                <span>
                                                    {msg.diagnosis.problem}
                                                </span>
                                            </div>
                                            <div className="ai-doctor__diagnosis-meta">
                                                <span>
                                                    {t("ai.confidence")}:{" "}
                                                    {formatNumber(msg.diagnosis.confidence)}%
                                                </span>
                                                <span
                                                    style={{
                                                        color: "var(--danger)",
                                                        fontWeight: 700,
                                                    }}
                                                >
                                                    {msg.diagnosis.severity}
                                                </span>
                                            </div>

                                            {/* Rx & Production Impact */}
                                            <div
                                                style={{
                                                    background:
                                                        "var(--bg-elevated)",
                                                    padding: "12px 14px",
                                                    borderRadius:
                                                        "var(--radius-md)",
                                                    margin: "10px 0",
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        fontSize: "min(max(calc(13px * var(--ts-body, 1)), 9px), 24px)",
                                                        fontWeight: 700,
                                                        color: "var(--text-primary)",
                                                    }}
                                                >
                                                    Rx: {msg.diagnosis.medicine}
                                                </div>
                                                <div
                                                    style={{
                                                        fontSize: "min(max(calc(12px * var(--ts-body, 1)), 9px), 24px)",
                                                        color: "var(--text-secondary)",
                                                        marginTop: 4,
                                                    }}
                                                >
                                                    {t("ai.dosageLabel")}:{" "}
                                                    {msg.diagnosis.dosage} ·
                                                    {t("ai.spend")}:{" "}
                                                    {
                                                        msg.diagnosis
                                                            .treatmentCost
                                                    }
                                                </div>
                                                <div
                                                    style={{
                                                        fontSize: "min(max(calc(12px * var(--ts-body, 1)), 9px), 24px)",
                                                        color: "var(--danger)",
                                                        marginTop: 6,
                                                        fontWeight: 600,
                                                    }}
                                                >
                                                    {
                                                        msg.diagnosis
                                                            .productionImpact
                                                    }
                                                </div>
                                            </div>

                                            <div className="ai-doctor__diagnosis-actions">
                                                <strong>
                                                    {t("ai.treatmentSteps")}
                                                </strong>
                                                <ol>
                                                    {msg.diagnosis.actions.map(
                                                        (a, j) => (
                                                            <li key={j}>{a}</li>
                                                        ),
                                                    )}
                                                </ol>
                                            </div>
                                            <button className="ai-doctor__listen-btn">
                                                <Volume2 size={14} />{" "}
                                                {t("ai.listen")}
                                            </button>
                                        </div>
                                    ) : (
                                        <>
                                            <p>{msg.content}</p>
                                            {msg.confidence && (
                                                <span className="ai-doctor__confidence">
                                                    {t("ai.confidence")}:{" "}
                                                    {msg.confidence}%
                                                </span>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                        ))}
                        {messages.length > 0 &&
                            messages[messages.length - 1].role === "user" && (
                                <p className="ai-doctor__notice" role="note">
                                    {t("ai.answerUnavailable")}
                                </p>
                            )}
                        <div ref={messagesEndRef} />
                    </div>
                </div>
            )}

            {/* Floating glass chat bar — always visible, hero & chat states */}
            <div className="ai-doctor__chatbar-anchor">
                {voiceError && (
                    <div className="ai-doctor__voice-error" role="alert">
                        <AlertCircle size={16} />
                        <div className="ai-doctor__voice-error-body">
                            <span>{t(`ai.${voiceError}`)}</span>
                            <div className="ai-doctor__voice-error-actions">
                                {voiceSupported && (
                                    <button
                                        type="button"
                                        className="ai-doctor__voice-retry"
                                        onClick={startVoice}
                                    >
                                        <Mic size={13} />
                                        {t("ai.voiceRetry")}
                                    </button>
                                )}
                                <button
                                    type="button"
                                    className="ai-doctor__voice-type"
                                    onClick={focusMessageInput}
                                >
                                    {t("ai.voiceTypeInstead")}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
                {listening && (
                    <div
                        className="ai-doctor__listening"
                        role="status"
                        aria-live="polite"
                    >
                        <div className="ai-doctor__listening-row">
                            <span className="ai-doctor__listening-pulse" />
                            <span className="ai-doctor__listening-text">
                                {voiceStatus === "starting"
                                    ? t("ai.voiceStarting")
                                    : t("ai.listening")}
                            </span>
                            <label className="ai-doctor__voice-lang">
                                <span>{t("ai.voiceLanguage")}</span>
                                <select
                                    value={voiceLang}
                                    onChange={(e) =>
                                        handleVoiceLang(e.target.value)
                                    }
                                    aria-label={t("ai.voiceLanguage")}
                                >
                                    {VOICE_LOCALES.map((l) => (
                                        <option key={l.code} value={l.code}>
                                            {l.label}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <button
                                type="button"
                                className="ai-doctor__voice-stop"
                                onClick={() => stopVoice({ noSpeech: true })}
                            >
                                <MicOff size={14} />
                                {t("ai.stopListening")}
                            </button>
                        </div>
                        <p className="ai-doctor__listening-preview">
                            {interim ? `“${interim}”` : t("ai.voiceHint")}
                        </p>
                        {voiceHint && (
                            <p className="ai-doctor__voice-hint">
                                {t("ai.voiceNoSpeech")}
                            </p>
                        )}
                    </div>
                )}
                {scanning && (
                    <div className="ai-doctor__scanning">
                        <div className="ai-doctor__scanning-animation" />
                        <span>
                            {t("ai.scanning")}
                        </span>
                    </div>
                )}
                <div className="ai-doctor__chatbar" ref={chatbarRef}>
                    <div className="ai-doctor__plus-wrap">
                        <button
                            className="ai-doctor__plus"
                            onClick={() => setPlusOpen(!plusOpen)}
                            aria-expanded={plusOpen}
                            aria-label={t("ai.moreActions")}
                            title={t("ai.moreActions")}
                        >
                            <Plus size={19} />
                        </button>
                        {plusOpen && (
                            <div className="ai-doctor__plus-menu">
                                <button
                                    className="ai-doctor__plus-item"
                                    onClick={() => {
                                        setPlusOpen(false);
                                        handlePhoto();
                                    }}
                                >
                                    <Camera size={16} />
                                    <span>{t("ai.takePhoto")}</span>
                                </button>
                            </div>
                        )}
                    </div>
                    <input
                        type="text"
                        ref={inputRef}
                        value={input}
                        onChange={handleInputChange}
                        onKeyDown={(e) => {
                            if (
                                e.key === "Enter" &&
                                !e.nativeEvent.isComposing
                            ) {
                                sendMessage(input);
                            }
                        }}
                        placeholder={t("ai.askAnything")}
                        aria-label={t("ai.askAnything")}
                        className="ai-doctor__chatbar-input"
                    />
                    <button
                        className={`ai-doctor__chatbar-mic ${listening ? "ai-doctor__chatbar-mic--active" : ""}`}
                        onClick={toggleVoice}
                        title={
                            listening
                                ? t("ai.stopListening")
                                : t("ai.askByVoice")
                        }
                        aria-label={
                            listening
                                ? t("ai.stopListening")
                                : t("ai.askByVoice")
                        }
                        aria-pressed={listening}
                    >
                        {listening ? <MicOff size={18} /> : <Mic size={18} />}
                    </button>
                    <button
                        className="ai-doctor__chatbar-send"
                        onClick={() => sendMessage(input)}
                        disabled={!input.trim()}
                        aria-label={t("ai.send")}
                    >
                        <Send size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
}
