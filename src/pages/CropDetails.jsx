import { useParams, useNavigate } from 'react-router-dom';
import { useLanguage } from '../hooks/useLanguage';
import { crops } from '../data/mockData';
import { ArrowLeft, CheckCircle2, Circle } from 'lucide-react';
import ProgressBar from '../components/common/ProgressBar';
import './CropDetails.css';

export default function CropDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const crop = crops.find(c => c.id === id) || crops[0];

  const progress = (crop.day / crop.totalDays) * 100;

  return (
    <div className="page-container crop-details">
      <button className="crop-details__back" onClick={() => navigate('/crops')}>
        <ArrowLeft size={16} />
        {t('common.back')}
      </button>

      <section className="crop-details__header section">
        <div className="crop-details__header-left">
          <span className="crop-details__crop-name">{crop.variety || crop.name}</span>
          <span className="crop-details__crop-field">{crop.field}</span>
        </div>
      </section>

      {/* Main Stats */}
      <section className="crop-details__stats section">
        <div className="crop-details__day-stat">
          <span className="crop-details__day-label">Day {crop.day} / {crop.totalDays}</span>
          <div className="crop-details__day-bar">
            <div className="crop-details__day-fill" style={{ width: `${progress}%` }} />
          </div>
        </div>
        <div className="crop-details__stat-card">
          <span className="crop-details__stat-label">{t('crops.growthStage')}</span>
          <span className="crop-details__stat-value">{crop.stage}</span>
        </div>
        <div className="crop-details__stat-card">
          <span className="crop-details__stat-label">{t('crops.cropHealth')}</span>
          <span className="crop-details__stat-value crop-details__stat-value--green">{crop.health}%</span>
        </div>
        <div className="crop-details__stat-card">
          <span className="crop-details__stat-label">{t('crops.expectedYield')}</span>
          <span className="crop-details__stat-value">{crop.expectedYield} {t('common.ton')}</span>
        </div>
      </section>

      {/* Growth Timeline */}
      <section className="crop-details__timeline section">
        <h2 className="crop-details__section-title">{t('crops.growthTimeline')}</h2>
        <div className="crop-details__timeline-track">
          {crop.timeline.map((step, i) => (
            <div
              key={i}
              className={`crop-details__timeline-step ${step.completed ? 'crop-details__timeline-step--done' : ''} ${step.current ? 'crop-details__timeline-step--current' : ''}`}
            >
              <div className="crop-details__timeline-icon">
                {step.completed ? (
                  <CheckCircle2 size={20} />
                ) : step.current ? (
                  <div className="crop-details__timeline-current" />
                ) : (
                  <Circle size={20} />
                )}
              </div>
              <span className="crop-details__timeline-label">{t(`crops.${step.stage.toLowerCase()}`)}</span>
              {step.current && <span className="crop-details__timeline-badge">{t('crops.current')}</span>}
              {i < crop.timeline.length - 1 && (
                <div className={`crop-details__timeline-connector ${step.completed ? 'crop-details__timeline-connector--done' : ''}`} />
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Growth Factors */}
      <section className="crop-details__factors section">
        <h2 className="crop-details__section-title">{t('crops.growthFactors')}</h2>
        <div className="crop-details__factors-grid">
          <div className="crop-details__factor">
            <ProgressBar value={crop.factors.water} label={t('crops.water')} />
          </div>
          <div className="crop-details__factor">
            <ProgressBar value={crop.factors.nutrition} label={t('crops.nutrition')} />
          </div>
          <div className="crop-details__factor">
            <ProgressBar value={crop.factors.temperature} label={t('crops.temperature')} />
          </div>
          <div className="crop-details__factor">
            <ProgressBar value={crop.factors.diseaseProtection} label={t('crops.diseaseProtection')} />
          </div>
          <div className="crop-details__factor">
            <ProgressBar value={crop.factors.environment} label={t('crops.environmental')} />
          </div>
        </div>
      </section>

      {/* Detailed breakdown */}
        <section className="crop-details__advanced section">
          <h2 className="crop-details__section-title">Detailed Analysis</h2>
          <div className="crop-details__advanced-grid">
            <div className="crop-details__advanced-card">
              <span className="crop-details__advanced-label">Water Stress Index</span>
              <span className="crop-details__advanced-value">0.28</span>
              <span className="crop-details__advanced-note">Low stress — favorable</span>
            </div>
            <div className="crop-details__advanced-card">
              <span className="crop-details__advanced-label">Nutrient Balance</span>
              <span className="crop-details__advanced-value">81%</span>
              <span className="crop-details__advanced-note">NPK ratio: 4:2:3</span>
            </div>
            <div className="crop-details__advanced-card">
              <span className="crop-details__advanced-label">Canopy Coverage</span>
              <span className="crop-details__advanced-value">72%</span>
              <span className="crop-details__advanced-note">Above average for stage</span>
            </div>
            <div className="crop-details__advanced-card">
              <span className="crop-details__advanced-label">Growth Rate</span>
              <span className="crop-details__advanced-value">+2.1%/day</span>
              <span className="crop-details__advanced-note">Within optimal range</span>
            </div>
          </div>
        </section>
    </div>
  );
}
