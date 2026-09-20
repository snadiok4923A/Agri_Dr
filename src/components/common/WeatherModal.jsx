import { useEffect, useState } from "react";
import {
    X,
    Droplets,
    Wind,
    Eye,
    Thermometer,
    CloudRain,
    CloudSun,
    Sun,
    Cloud,
    CloudFog,
    CloudSnow,
    CloudLightning,
    CloudDrizzle,
    ShieldAlert,
} from "lucide-react";
import { useWeather } from "../../hooks/useWeather";
import { useLanguage } from "../../hooks/useLanguage";
import { reverseGeocode } from "../../services/geocodingService";
import { WeatherConditionIllustration } from "./AgriIllustrations";
import "./WeatherModal.css";

/* Forecast strip icons per WMO conditionKey — same lucide vector language
   the modal already used (one consistent icon family, no emoji). */
const dayIcon = (conditionKey) => {
    switch (conditionKey) {
        case "clear":
        case "mainlyClear":
            return Sun;
        case "partlyCloudy":
            return CloudSun;
        case "overcast":
            return Cloud;
        case "fog":
            return CloudFog;
        case "drizzle":
        case "freezingDrizzle":
            return CloudDrizzle;
        case "rain":
        case "freezingRain":
        case "rainShowers":
            return CloudRain;
        case "snowfall":
        case "snowGrains":
        case "snowShowers":
            return CloudSnow;
        case "thunderstorm":
        case "thunderstormHail":
            return CloudLightning;
        default:
            return CloudSun;
    }
};

/**
 * Centered floating glassmorphism weather modal.
 * Opens over the dashboard (no navigation, no side panel).
 * All values come from the real Open-Meteo response (useWeather) —
 * temperature, condition, humidity, wind and the 7-day forecast.
 */
export default function WeatherModal({ open, onClose }) {
    const { t, formatNumber, language } = useLanguage();
    const { status, weather, locationError, coords } = useWeather();
    const ready = status === "ready" && !!weather;

    /** Small location caption beside the current temperature — city
     *  (line 1) + state (line 2), right-aligned in the main weather row.
     *  Resolved from the coordinates the weather pipeline already
     *  obtained; stays hidden until a real name resolves. */
    const [place, setPlace] = useState(null);

    useEffect(() => {
        if (!open) return;
        if (!coords) {
            setPlace(null); // no fix (denied/unsupported) → caption hidden
            return;
        }
        let cancelled = false;
        reverseGeocode({ latitude: coords.latitude, longitude: coords.longitude, language })
            .then((p) => {
                if (!cancelled) setPlace(p); // null → gracefully hidden
            });
        return () => {
            cancelled = true;
        };
    }, [open, coords, language]);

    useEffect(() => {
        if (!open) return;
        const onKey = (e) => {
            if (e.key === "Escape") onClose();
        };
        document.addEventListener("keydown", onKey);
        document.body.style.overflow = "hidden";
        return () => {
            document.removeEventListener("keydown", onKey);
            document.body.style.overflow = "";
        };
    }, [open, onClose]);

    if (!open) return null;

    const cur = weather?.current;
    const rain = cur?.rainProbability ?? 0;

    return (
        <div
            className="wmodal__overlay"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-label={t("weather.currentWeather")}
        >
            <div
                className="wmodal"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Foreground layer — sits above the panel's glass background
                    (the ::before sheen) so glassmorphism can never fade or
                    wash out the actual content. No opacity, no filter here. */}
                <div className="wmodal__content">
                {/* ===== 1. Header ===== */}
                <header className="wmodal__head">
                    <span className="wmodal__head-title">{t("weather.currentWeather")}</span>
                    <button
                        className="wmodal__close"
                        onClick={onClose}
                        aria-label={t("weather.closeWeather")}
                    >
                        <X size={16} />
                    </button>
                </header>

                {/* ===== 2. Main weather ===== */}
                {ready ? (
                    <>
                        <div className="wmodal__main">
                            <span className="wmodal__main-icon">
                                <WeatherConditionIllustration
                                    condition={cur.conditionKey}
                                    size={72}
                                />
                            </span>
                            <div className="wmodal__main-data">
                                <span className="wmodal__temp">
                                    {formatNumber(Math.round(cur.temperature))}°C
                                </span>
                                <span className="wmodal__cond">
                                    {t(
                                        `weather.cond${cur.conditionKey
                                            .charAt(0)
                                            .toUpperCase()}${cur.conditionKey.slice(1)}`,
                                    )}
                                </span>
                            </div>

                            {/* Location caption — right side of the temperature,
                                vertically centered against the temp/condition block */}
                            {place && (
                                <div className="wmodal__loc">
                                    <span className="wmodal__loc-city">{place.line1}</span>
                                    {place.line2 && (
                                        <span className="wmodal__loc-state">{place.line2}</span>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* ===== 3. Metric row (feels like from Open-Meteo) ===== */}
                        <div className="wmodal__metrics">
                            <div className="wmodal__metric">
                                <Thermometer size={15} />
                                <div>
                                    <strong>{formatNumber(Math.round(cur.feelsLike))}°C</strong>
                                    <span>{t("weather.feelsLike")}</span>
                                </div>
                            </div>
                            <div className="wmodal__metric">
                                <Droplets size={15} />
                                <div>
                                    <strong>{formatNumber(Math.round(cur.humidity))}%</strong>
                                    <span>{t("weather.humidity")}</span>
                                </div>
                            </div>
                            <div className="wmodal__metric">
                                <Wind size={15} />
                                <div>
                                    <strong>{formatNumber(Math.round(cur.wind))} km/h</strong>
                                    <span>{t("weather.wind")}</span>
                                </div>
                            </div>
                            <div className="wmodal__metric">
                                <Eye size={15} />
                                <div>
                                    <strong>{formatNumber(cur.visibility)} km</strong>
                                    <span>{t("weather.visibility")}</span>
                                </div>
                            </div>
                        </div>

                        {/* ===== 4. Single most important advisory (rain-based) ===== */}
                        <div className="wmodal__advisory">
                            <ShieldAlert size={17} className="wmodal__advisory-ico" />
                            <div>
                                <strong>{t("weather.sprayingAdvisory")}</strong>
                                <span>
                                    {rain >= 40
                                        ? t("weather.advisoryHigh", { n: formatNumber(Math.round(rain)) })
                                        : rain >= 20
                                          ? t("weather.advisoryModerate", { n: formatNumber(Math.round(rain)) })
                                          : t("weather.advisoryLow", { n: formatNumber(Math.round(rain)) })}
                                </span>
                            </div>
                        </div>

                        {/* ===== 5. 7-Day Forecast (real Open-Meteo daily data) ===== */}
                        <div className="wmodal__forecast">
                            <span className="wmodal__forecast-title">{t("weather.forecast7Day")}</span>
                            <div className="wmodal__forecast-grid">
                                {weather.forecast.map((day, i) => {
                                    const Icon = dayIcon(day.conditionKey);
                                    return (
                                        <div
                                            key={day.date || i}
                                            className={`wmodal__day ${i === 0 ? "wmodal__day--today" : ""}`}
                                        >
                                            <span className="wmodal__day-name">
                                                {i === 0
                                                    ? t("common.today")
                                                    : i === 1
                                                      ? t("common.tomorrow")
                                                      : day.day === "today" || day.day === "tomorrow"
                                                        ? day.day
                                                        : t(`weather.day${day.day.charAt(0).toUpperCase()}${day.day.slice(1)}`, "")}
                                            </span>
                                            <Icon
                                                size={19}
                                                className="wmodal__day-icon"
                                            />
                                            <span className="wmodal__day-hi">
                                                {formatNumber(Math.round(day.high))}°
                                            </span>
                                            <span className="wmodal__day-lo">
                                                {formatNumber(Math.round(day.low))}°
                                            </span>
                                            <span className="wmodal__day-rain">
                                                <Droplets size={10} />
                                                {formatNumber(Math.round(day.rain))}%
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </>
                ) : (
                    /* Loading / denied / error — same modal shell, honest state */
                    <div className="wmodal__state">
                        {status === "loading" ? (
                            <>
                                <span className="wmodal__state-icon wmodal__state-icon--loading">
                                    <WeatherConditionIllustration condition="partlyCloudy" size={64} />
                                </span>
                                <span className="wmodal__state-text">
                                    {t("weather.weatherLoading")}
                                </span>
                            </>
                        ) : status === "locating" || status === "idle" ? (
                            <>
                                <span className="wmodal__state-icon wmodal__state-icon--loading">
                                    <WeatherConditionIllustration condition="partlyCloudy" size={64} />
                                </span>
                                <span className="wmodal__state-text">
                                    {t("weather.locating")}
                                </span>
                            </>
                        ) : (
                            <>
                                <span className="wmodal__state-icon">
                                    <CloudRain size={34} />
                                </span>
                                <span className="wmodal__state-text">
                                    {status === "wxError"
                                        ? t("weather.weatherUnavailable")
                                        : locationError === "PERMISSION_DENIED"
                                          ? t("weather.locationDenied")
                                          : locationError === "TIMEOUT"
                                            ? t("weather.locationTimeout")
                                            : locationError === "UNSUPPORTED"
                                              ? t("weather.locationNeeded")
                                              : t("weather.locationUnavailable")}
                                </span>
                            </>
                        )}
                    </div>
                )}
                </div>{/* /wmodal__content */}
            </div>
        </div>
    );
}
