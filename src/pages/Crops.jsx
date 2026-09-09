import { useLanguage } from '../hooks/useLanguage';
import { crops } from '../data/mockData';
import { useNavigate } from 'react-router-dom';
import { Leaf, ArrowRight } from 'lucide-react';
import StatusBadge from '../components/common/StatusBadge';
import './Crops.css';

export default function Crops() {
  const { t } = useLanguage();
  const navigate = useNavigate();

  return (
    <div className="page-container crops-page">
      <section className="crops-page__header section">
        <h1 className="crops-page__title">{t('nav.crops')}</h1>
        <p className="crops-page__subtitle">{crops.length} {t('dashboard.activeCrops')}</p>
      </section>

      <div className="crops-page__grid">
          {crops.map((crop) => (
            <div key={crop.id} className="crops-page__card" onClick={() => navigate(`/crops/${crop.id}`)}>
              <div className="crops-page__card-header">
                <div className="crops-page__card-crop">
                  <Leaf size={16} />
                  <span className="crops-page__card-name">{crop.variety || crop.name}</span>
                </div>
                <StatusBadge status={crop.expectedYield >= crop.potentialYield * 0.85 ? 'on-track' : 'needs-attention'} />
              </div>
              <div className="crops-page__card-variety">{crop.variety}</div>
              <div className="crops-page__card-field">{crop.field}</div>
              <div className="crops-page__card-progress">
                <div className="crops-page__card-day">
                  <span className="crops-page__card-day-number">Day {crop.day}</span>
                  <span className="crops-page__card-day-total">/ {crop.totalDays}</span>
                </div>
                <div className="crops-page__card-bar">
                  <div className="crops-page__card-bar-fill" style={{ width: `${(crop.day / crop.totalDays) * 100}%` }} />
                </div>
              </div>
              <div className="crops-page__card-stage">
                <span className="crops-page__card-stage-label">{t('crops.growthStage')}</span>
                <span className="crops-page__card-stage-value">{crop.stage}</span>
              </div>
              <div className="crops-page__card-stage">
                <span className="crops-page__card-stage-label">Est. Cost</span>
                <span className="crops-page__card-stage-value">₹{(crop.estimatedCost / 1000).toFixed(1)}k</span>
              </div>
              <div className="crops-page__card-stage">
                <span className="crops-page__card-stage-label">Exp. Revenue</span>
                <span className="crops-page__card-stage-value">₹{(crop.expectedRevenue / 1000).toFixed(1)}k</span>
              </div>
              <div className="crops-page__card-stage">
                <span className="crops-page__card-stage-label">Exp. Profit</span>
                <span className="crops-page__card-stage-value" style={{ color: 'var(--success)' }}>₹{(crop.expectedProfit / 1000).toFixed(1)}k</span>
              </div>
              <div className="crops-page__card-footer">
                <span>{crop.expectedYield} {t('common.ton')} expected</span>
                <ArrowRight size={14} />
              </div>
            </div>
          ))}
        </div>
    </div>
  );
}
