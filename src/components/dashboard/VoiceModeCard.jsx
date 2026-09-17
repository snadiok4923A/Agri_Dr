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

            {active ? (
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
                        className="feature-card__btn feature-card__btn--start"
                        onClick={start}
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
