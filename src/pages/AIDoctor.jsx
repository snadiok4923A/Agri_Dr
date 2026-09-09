import { useState, useRef } from "react";
import { useLanguage } from "../hooks/useLanguage";
import {
    Camera,
    Mic,
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
import { askAgricultureAI } from "../data/mockData";
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

export default function AIDoctor() {
    const { t, language } = useLanguage();
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const [listening, setListening] = useState(false);
    const [scanning, setScanning] = useState(false);
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () =>
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });

    const sendMessage = async (text) => {
        if (!text.trim()) return;
        setMessages((prev) => [
            ...prev,
            { role: "user", content: text, timestamp: new Date() },
        ]);
        setInput("");
        setLoading(true);
        const response = await askAgricultureAI(text, "default");
        setMessages((prev) => [
            ...prev,
            {
                role: "assistant",
                content: response.answer,
                confidence: response.confidence,
                timestamp: new Date(),
            },
        ]);
        setLoading(false);
        setTimeout(scrollToBottom, 100);
    };

    const handleVoice = () => {
        setListening(!listening);
        if (!listening) {
            setTimeout(() => {
                setListening(false);
                sendMessage(
                    "আমার ধানের পাতায় বাদামি দাগ দেখা যাচ্ছে, কী ওষুধ দেব?",
                );
            }, 2500);
        }
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
                        Rice variety advice, disease diagnosis, medicine dosage,
                        fertilizer calculations, and profit intelligence
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
                        Ask any question regarding rice production, fertilizer
                        schedules, medicine dosages, and expected profit
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
                            className="ai-doctor__action-btn ai-doctor__action-btn--voice"
                            onClick={handleVoice}
                        >
                            <Mic size={22} />
                            <span>{t("ai.askByVoice")}</span>
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
                                                    Confidence:{" "}
                                                    {msg.diagnosis.confidence}%
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
                                                        fontSize: 13,
                                                        fontWeight: 700,
                                                        color: "var(--text-primary)",
                                                    }}
                                                >
                                                    Rx: {msg.diagnosis.medicine}
                                                </div>
                                                <div
                                                    style={{
                                                        fontSize: 12,
                                                        color: "var(--text-secondary)",
                                                        marginTop: 4,
                                                    }}
                                                >
                                                    Dosage:{" "}
                                                    {msg.diagnosis.dosage} ·
                                                    Spend:{" "}
                                                    {
                                                        msg.diagnosis
                                                            .treatmentCost
                                                    }
                                                </div>
                                                <div
                                                    style={{
                                                        fontSize: 12,
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
                                                    Treatment Steps:
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
                        {loading && (
                            <div className="ai-doctor__message ai-doctor__message--assistant">
                                <div className="ai-doctor__message-avatar ai-doctor__message-avatar--ai">
                                    <Bot size={18} />
                                </div>
                                <div className="ai-doctor__message-content">
                                    <div className="ai-doctor__typing">
                                        <span />
                                        <span />
                                        <span />
                                    </div>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>
                    <div className="ai-doctor__input-area">
                        {listening && (
                            <div className="ai-doctor__listening">
                                <div className="ai-doctor__listening-pulse" />
                                <span>{t("ai.listening")}</span>
                            </div>
                        )}
                        {scanning && (
                            <div className="ai-doctor__scanning">
                                <div className="ai-doctor__scanning-animation" />
                                <span>
                                    Analyzing rice crop image & diagnosing
                                    symptoms...
                                </span>
                            </div>
                        )}
                        <div className="ai-doctor__input-row">
                            <button
                                className="ai-doctor__input-action"
                                onClick={handlePhoto}
                                title={t("ai.takePhoto")}
                            >
                                <Camera size={18} />
                            </button>
                            <button
                                className={`ai-doctor__input-action ${listening ? "ai-doctor__input-action--active" : ""}`}
                                onClick={handleVoice}
                                title={t("ai.askByVoice")}
                            >
                                <Mic size={18} />
                            </button>
                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) =>
                                    e.key === "Enter" && sendMessage(input)
                                }
                                placeholder={t("ai.typeQuestion")}
                                className="ai-doctor__input"
                            />
                            <button
                                className="ai-doctor__send"
                                onClick={() => sendMessage(input)}
                                disabled={!input.trim()}
                            >
                                <Send size={18} />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
