import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
    X,
    CloudSun,
    Droplets,
    Wind,
    Eye,
    Thermometer,
    CloudRain,
    ShieldAlert,
    ArrowRight,
} from "lucide-react";
import { weatherData, farmData } from "../../data/mockData";
import { WeatherSunCloudIllustration } from "./AgriIllustrations";
import "./WeatherModal.css";

const dayIcon = (icon) => {
    if (icon === "sun") return CloudSun; // keep one consistent vector language
    if (icon === "cloud-rain") return CloudRain;
    if (icon === "cloud") return CloudSun;
    return CloudSun;
};

/**
 * Centered floating glassmorphism weather modal.
 * Opens over the dashboard (no navigation, no side panel).
 */
export default function WeatherModal({ open, onClose }) {
    const navigate = useNavigate();

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

    const cur = weatherData.current;
    const impact = weatherData.farmImpact;

    return (
        <div
            className="wmodal__overlay"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-label="Current Weather"
        >
            <div
                className="wmodal"
                onClick={(e) => e.stopPropagation()}
            >
                {/* ===== 1. Header ===== */}
                <header className="wmodal__head">
                    <span className="wmodal__head-title">Current Weather</span>
                    <button
                        className="wmodal__close"
                        onClick={onClose}
                        aria-label="Close weather"
                    >
                        <X size={16} />
                    </button>
                </header>

                {/* ===== 2. Main weather ===== */}
                <div className="wmodal__main">
                    <span className="wmodal__main-icon">
                        <WeatherSunCloudIllustration size={72} />
                    </span>
                    <div className="wmodal__main-data">
                        <span className="wmodal__temp">
                            {cur.temperature}°C
                        </span>
                        <span className="wmodal__cond">{cur.condition}</span>
                        <span className="wmodal__farm">{farmData.name}</span>
                    </div>
                </div>

                {/* ===== 3. Metric row ===== */}
                <div className="wmodal__metrics">
                    <div className="wmodal__metric">
                        <Thermometer size={15} />
                        <div>
                            <strong>{cur.feelsLike}°C</strong>
                            <span>Feels Like</span>
                        </div>
                    </div>
                    <div className="wmodal__metric">
                        <Droplets size={15} />
                        <div>
                            <strong>{cur.humidity}%</strong>
                            <span>Humidity</span>
                        </div>
                    </div>
                    <div className="wmodal__metric">
                        <Wind size={15} />
                        <div>
                            <strong>{cur.wind} km/h</strong>
                            <span>Wind</span>
                        </div>
                    </div>
                    <div className="wmodal__metric">
                        <Eye size={15} />
                        <div>
                            <strong>{cur.visibility} km</strong>
                            <span>Visibility</span>
                        </div>
                    </div>
                </div>

                {/* ===== 4. Single most important advisory ===== */}
                <div className="wmodal__advisory">
                    <ShieldAlert size={17} className="wmodal__advisory-ico" />
                    <div>
                        <strong>Spraying Advisory</strong>
                        <span>{impact.sprayAdvisory}</span>
                    </div>
                    <button
                        className="wmodal__advisory-link"
                        onClick={() => navigate("/weather")}
                        title="Open Weather Advisory"
                    >
                        <ArrowRight size={14} />
                    </button>
    </div>

                {/* ===== 5. 7-Day Forecast ===== */}
                <div className="wmodal__forecast">
                    <span className="wmodal__forecast-title">7-Day Forecast</span>
                    <div className="wmodal__forecast-grid">
                        {weatherData.forecast.map((day, i) => {
                            const Icon = dayIcon(day.icon);
                            return (
                                <div
                                    key={i}
                                    className={`wmodal__day ${i === 0 ? "wmodal__day--today" : ""}`}
                                >
                                    <span className="wmodal__day-name">
                                        {i === 0
                                            ? "Today"
                                            : i === 1
                                              ? "Tomorrow"
                                              : day.day}
                                    </span>
                                    <Icon
                                        size={19}
                                        className="wmodal__day-icon"
                                    />
                                    <span className="wmodal__day-hi">
                                        {day.high}°
                                    </span>
                                    <span className="wmodal__day-lo">
                                        {day.low}°
                                    </span>
                                    <span className="wmodal__day-rain">
                                        <Droplets size={10} />
                                        {day.rain}%
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
