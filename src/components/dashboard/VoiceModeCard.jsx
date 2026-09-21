import { useState, useEffect } from "react";
import { Mic, Square } from "lucide-react";
import { useVoiceMode } from "../../hooks/useVoiceMode";
import { useLanguage } from "../../hooks/useLanguage";
import "./DashboardFeatureCards.css";

/**
 * Voice Mode card — entry point for the persistent voice assistant.
 * Mirrors the dashboard's glass card language (surface, border, radius,
 * typography). Activation is persistent: it stays on until stopped from
 * the card, the header icon, or a spoken stop command ("voice bondho").
 * All labels resolve through the i18n system.
 */
export default function VoiceModeCard() {
    const { active, status, start, stop, supported, transcript, lastCommand } =
        useVoiceMode();
    const { t } = useLanguage();

    /* Activation transition (visual only, §state machine):
       click → "activating" → the WHOLE button floods with a flowing
       multi-color gradient while the microphone/permission initializes.
       It ends only when activation actually RESOLVES:
         • success: status flips to "listening" → active UI (border loop)
         • failure/denied: the hook calls stop() → active=false → idle
       A 10s safety cap guarantees the button can never stay stuck
       colorful. Recognition/mic/commands are untouched. */
    const [activating, setActivating] = useState(false);

    useEffect(() => {
        if (!activating) return;
        if ((active && status === "listening") || !active) {
            setActivating(false);
        }
        // still "starting" (permission prompt, engine warm-up) → keep flowing
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

    const listening = active && (status === "listening" || status === "starting");
    const restarting = active && status === "restarting";

    const statusLabel = !active
        ? null
        : listening || restarting
          ? t("dashboard.listening")
          : t("dashboard.starting");

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

            {/* Visual-only gate (§6 state machine): while `activating`, the
                start button stays mounted with the full-button flowing
                gradient — even though recognition is already starting under
                the hood. When activation RESOLVES it switches: success →
                active UI (stop button + border loop); failure/denied →
                idle button. Mic/commands/stop behavior untouched. */}
            {active && !activating ? (
                <>
                    <p className="feature-card__sub feature-card__sub--live">
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
}
