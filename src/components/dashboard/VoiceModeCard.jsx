import { Mic, Square } from "lucide-react";
import { useVoiceMode } from "../../hooks/useVoiceMode";
import "./DashboardFeatureCards.css";

/**
 * Voice Mode card — entry point for the persistent voice assistant.
 * Mirrors the dashboard's glass card language (surface, border, radius,
 * typography). Activation is persistent: it stays on until stopped from
 * the header or until the user navigates away.
 */
export default function VoiceModeCard() {
    const { active, start, stop, supported, transcript } = useVoiceMode();

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
                <span className="feature-card__title">Voice Mode</span>
            </div>

            {active ? (
                <>
                    <p className="feature-card__sub feature-card__sub--live">
                        <span className="feature-card__live-dot" />
                        Listening continuously…
                    </p>
                    {transcript && (
                        <span className="feature-card__transcript">
                            “{transcript}”
                        </span>
                    )}
                    <button
                        type="button"
                        className="feature-card__btn feature-card__btn--stop"
                        onClick={stop}
                    >
                        <Square size={13} />
                        Stop Voice Mode
                    </button>
                </>
            ) : (
                <>
                    <p className="feature-card__sub">
                        Control Krisiveda with your voice
                    </p>
                    <button
                        type="button"
                        className="feature-card__btn feature-card__btn--start"
                        onClick={start}
                        disabled={!supported}
                        title={
                            supported
                                ? undefined
                                : "Voice input is not supported in this browser"
                        }
                    >
                        <Mic size={14} />
                        {supported ? "Start Voice Mode" : "Voice Unavailable"}
                    </button>
                </>
            )}
        </div>
    );
}
