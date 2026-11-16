import { memo, useEffect, useState } from "react";
import { Mic, Square, Send } from "lucide-react";
import { useVoiceMode } from "../../hooks/useVoiceMode";
import { useLanguage } from "../../hooks/useLanguage";
import "./DashboardFeatureCards.css";

/**
 * Voice Mode card — entry point for the persistent voice assistant.
 * Mirrors the dashboard's glass card language (surface, border, radius,
 * typography). Activation is persistent: it stays on until stopped from
 * the card, the header icon, or a spoken stop command.
 *
 * Presentation is honest about the engine:
 *   starting / listening / restarting / processing are distinct labels, and
 *   a terminal failure stops the card, explains itself in the selected
 *   language and offers a typed fallback right here — no stuck "Listening…".
 */
/* PERF: this card takes no props. React.memo stops it from re-rendering
   when the Dashboard re-renders for unrelated reasons (weather arriving,
   location phases, the crop-diagnosis flow, the mobile breakpoint) — its
   own context subscriptions still update it normally (spec §11: unrelated
   state must not re-render other cards). */
export default memo(function VoiceModeCard() {
    const {
        active,
        status,
        start,
        stop,
        supported,
        transcript,
        lastCommand,
        voiceError,
        retryInfo,
        retryable,
        retry,
        submitText,
    } = useVoiceMode();
    const { t } = useLanguage();
    const [typed, setTyped] = useState("");

    /* Activation transition (visual only): click → "activating" → flowing
       gradient while the microphone/permission initializes. It resolves as
       soon as the engine reports a real state (listening, retrying, error),
       with a 10s safety cap. Recognition/commands are untouched. */
    const [activating, setActivating] = useState(false);

    useEffect(() => {
        if (!activating) return;
        if (!active || (status !== "starting" && status !== "idle")) {
            setActivating(false);
        }
    }, [activating, active, status]);

    useEffect(() => {
        if (!activating) return undefined;
        const timer = setTimeout(() => setActivating(false), 10000);
        return () => clearTimeout(timer);
    }, [activating]);

    const handleStart = () => {
        if (!supported || activating) return;
        setActivating(true);
        start();
    };

    const listening = active && status === "listening";
    const busy = active && status !== "listening" && status !== "error";

    /* Status is derived from the engine's own events — never optimistic. */
    const statusLabel = !active
        ? null
        : status === "listening"
          ? t("dashboard.listening")
          : status === "processing"
            ? t("dashboard.processing")
            : status === "restarting" && retryInfo
              ? t("dashboard.reconnecting", {
                    attempt: retryInfo.attempt,
                    max: retryInfo.max,
                })
              : status === "restarting"
                ? t("dashboard.restarting")
                : t("dashboard.starting");

    /* Retrying only helps when the failure was temporary. Permission denial
       and unsupported locales need a settings change, not another prompt. */
    const canRetry = supported && retryable;
    const showTyping = Boolean(voiceError) || !supported;

    const handleTypedSubmit = (event) => {
        event?.preventDefault?.();
        const text = typed.trim();
        if (!text) return;
        setTyped("");
        submitText(text);
    };

    return (
        <div
            className={`feature-card feature-card--voice ${
                active ? "feature-card--voice-active" : ""
            }`}
        >
            <div className="feature-card__head">
                <span className="feature-card__icon feature-card__icon--leaf">
                    <Mic size={18} />
                </span>
                <span className="feature-card__title">{t("dashboard.voiceMode")}</span>
            </div>

            {/* Every failure is explained in the selected language, with a
                typing fallback — never a silent stop, never an English
                message in a Bengali/Hindi/Telugu/Tamil UI. */}
            {voiceError && (
                <div className="feature-card__voice-error" role="alert">
                    <span>{t(`ai.${voiceError}`)}</span>
                    {canRetry && (
                        <button
                            type="button"
                            className="feature-card__voice-type"
                            onClick={retry}
                        >
                            {t("ai.voiceRetry")}
                        </button>
                    )}
                </div>
            )}

            {/* Typed fallback — same parser/executor as speech, available
                without closing Voice Mode. */}
            {showTyping && (
                <form
                    className="feature-card__voice-fallback"
                    onSubmit={handleTypedSubmit}
                >
                    <input
                        type="text"
                        value={typed}
                        onChange={(e) => setTyped(e.target.value)}
                        placeholder={t("dashboard.voiceTypePlaceholder")}
                        aria-label={t("dashboard.voiceTypePlaceholder")}
                        className="feature-card__voice-input"
                    />
                    <button
                        type="submit"
                        className="feature-card__voice-send"
                        aria-label={t("dashboard.voiceSend")}
                        title={t("dashboard.voiceSend")}
                        disabled={!typed.trim()}
                    >
                        <Send size={14} />
                    </button>
                </form>
            )}

            {active && !activating ? (
                <>
                    <p
                        className={`feature-card__sub feature-card__sub--live${
                            busy ? " feature-card__sub--busy" : ""
                        }`}
                    >
                        <span className="feature-card__live-dot" />
                        {statusLabel}
                    </p>
                    {transcript && (
                        <span className="feature-card__transcript">
                            “{transcript}”
                        </span>
                    )}
                    {lastCommand?.intent && (
                        <span className="feature-card__lastcmd">
                            ✓ {lastCommand.intent.replaceAll("_", " ").toLowerCase()}
                        </span>
                    )}
                    <button
                        type="button"
                        className="feature-card__btn feature-card__btn--stop"
                        onClick={stop}
                    >
                        <Square size={13} />
                        {t("dashboard.stopVoiceMode")}
                    </button>
                </>
            ) : (
                <>
                    <p className="feature-card__sub">
                        {t("dashboard.voiceControlSub")}
                    </p>
                    <button
                        type="button"
                        className={`feature-card__btn feature-card__btn--start${
                            activating
                                ? " feature-card__btn--start--activating"
                                : ""
                        }`}
                        onClick={handleStart}
                        disabled={!supported}
                        title={
                            supported
                                ? undefined
                                : t("dashboard.voiceNotSupported")
                        }
                    >
                        <Mic size={14} />
                        {supported ? t("dashboard.startVoiceMode") : t("dashboard.voiceUnavailable")}
                    </button>
                    {!supported && (
                        <span className="feature-card__hint">
                            {t("dashboard.voiceNotSupported")}
                        </span>
                    )}
                </>
            )}
        </div>
    );
});
