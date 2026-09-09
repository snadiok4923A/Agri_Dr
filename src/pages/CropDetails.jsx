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
          <span className="crop-details__stat-label">Estimated Cost</span>
          <span className="crop-details__stat-value">₹{(crop.estimatedCost / 1000).toFixed(1)}k</span>
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

      {/* Financial Estimates */}
      <section className="crop-details__factors section">
        <h2 className="crop-details__section-title">Financial Estimates</h2>
        <div className="crop-details__factors-grid">
          <div className="crop-details__factor">
            <ProgressBar value={Math.round((crop.estimatedCost / crop.expectedRevenue) * 100)} label="Cost vs Revenue" />
          </div>
          <div className="crop-details__factor">
            <ProgressBar value={Math.round((crop.expectedYield / crop.potentialYield) * 100)} label="Yield Achievement" />
          </div>
        </div>
      </section>

      {/* Detailed breakdown */}
        <section className="crop-details__advanced section">
          <h2 className="crop-details__section-title">Detailed Analysis</h2>
          <div className="crop-details__advanced-grid">
            <div className="crop-details__advanced-card">
              <span className="crop-details__advanced-label">Expected Revenue</span>
              <span className="crop-details__advanced-value">₹{(crop.expectedRevenue / 1000).toFixed(1)}k</span>
              <span className="crop-details__advanced-note">Based on current market price</span>
            </div>
            <div className="crop-details__advanced-card">
              <span className="crop-details__advanced-label">Expected Profit</span>
              <span className="crop-details__advanced-value" style={{ color: 'var(--success)' }}>₹{(crop.expectedProfit / 1000).toFixed(1)}k</span>
              <span className="crop-details__advanced-note">Margin: {Math.round((crop.expectedProfit / crop.expectedRevenue) * 100)}%</span>
            </div>
            <div className="crop-details__advanced-card">
              <span className="crop-details__advanced-label">Potential Yield</span>
              <span className="crop-details__advanced-value">{crop.potentialYield} Ton</span>
              <span className="crop-details__advanced-note">Optimal conditions</span>
            </div>
            <div className="crop-details__advanced-card">
              <span className="crop-details__advanced-label">Yield Gap</span>
              <span className="crop-details__advanced-value">{(crop.potentialYield - crop.expectedYield).toFixed(1)} Ton</span>
              <span className="crop-details__advanced-note">Opportunity for improvement</span>
            </div>
          </div>
        </section>
    </div>
  );
}
