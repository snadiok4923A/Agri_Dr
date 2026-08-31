import { useLanguage } from '../hooks/useLanguage';
import { weatherData } from '../data/mockData';
import { CloudSun, Droplets, Thermometer, Wind, AlertTriangle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import './Weather.css';

export default function Weather() {
  const { t } = useLanguage();

  if (true) { // Show full for all modes, weather is always useful
    return (
      <div className="page-container weather-page">
        <section className="weather-page__header section"><h1 className="weather-page__title">{t('nav.weather')}</h1></section>
        <section className="weather-page__current section">
          <div className="weather-page__main">
            <CloudSun size={64} className="weather-page__main-icon" />
            <div>
              <span className="weather-page__temp">{weatherData.current.temperature}°C</span>
              <span className="weather-page__feels">Feels like {weatherData.current.feelsLike}°C</span>
              <span className="weather-page__condition">{weatherData.current.condition}</span>
            </div>
          </div>
          <div className="weather-page__details">
            <div className="weather-page__detail"><Droplets size={18} /><div><span className="weather-page__detail-value">{weatherData.current.humidity}%</span><span className="weather-page__detail-label">{t('weather.humidity')}</span></div></div>
            <div className="weather-page__detail"><CloudSun size={18} /><div><span className="weather-page__detail-value">{weatherData.current.rainProbability}%</span><span className="weather-page__detail-label">{t('weather.rainProbability')}</span></div></div>
            <div className="weather-page__detail"><Wind size={18} /><div><span className="weather-page__detail-value">{weatherData.current.wind} km/h</span><span className="weather-page__detail-label">{t('weather.wind')}</span></div></div>
          </div>
        </section>
        <section className="weather-page__impact section">
          <div className="weather-page__impact-card">
            <div className="weather-page__impact-header"><AlertTriangle size={18} /><span>{t('weather.farmImpact')}</span></div>
            <p className="weather-page__impact-message">{weatherData.farmImpact.message}</p>
          </div>
        </section>
        <section className="weather-page__forecast section">
          <h2 className="weather-page__section-title">{t('weather.sevenDayForecast')}</h2>
          <div className="weather-page__forecast-grid">
            {weatherData.forecast.map((day, i) => (
              <div key={i} className={`weather-page__forecast-card ${i === 0 ? 'weather-page__forecast-card--today' : ''}`}>
                <span className="weather-page__forecast-day">{i === 0 ? t('weather.today') : i === 1 ? t('weather.tomorrow') : day.day}</span>
                <CloudSun size={24} className="weather-page__forecast-icon" />
                <span className="weather-page__forecast-high">{day.high}°</span>
                <span className="weather-page__forecast-low">{day.low}°</span>
                <div className="weather-page__forecast-rain"><Droplets size={12} /><span>{day.rain}%</span></div>
              </div>
            ))}
          </div>
        </section>
      </div>
    );
  }
}
