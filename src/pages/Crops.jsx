import { useLanguage } from '../hooks/useLanguage';
import { useInfoLevel } from '../hooks/useInfoLevel';
import { crops } from '../data/mockData';
import { useNavigate } from 'react-router-dom';
import { Leaf, ArrowRight } from 'lucide-react';
import StatusBadge from '../components/common/StatusBadge';
import './Crops.css';

export default function Crops() {
  const { t } = useLanguage();
  const { isSimple, isStandard, isAdvanced } = useInfoLevel();
  const navigate = useNavigate();

  return (
    <div className="page-container crops-page">
      <section className="crops-page__header section">
        <h1 className="crops-page__title">{t('nav.crops')}</h1>
        <p className="crops-page__subtitle">{crops.length} {t('dashboard.activeCrops')}</p>
      </section>

      {isSimple ? (
        /* SIMPLE: Clean list format */
        <div className="crops-page__simple-list">
          {crops.map((crop) => (
            <div key={crop.id} className="crops-page__simple-row" onClick={() => navigate(`/crops/${crop.id}`)}>
              <div className="crops-page__simple-left">
                <Leaf size={16} style={{ color: 'var(--accent)' }} />
                <div>
                  <span className="crops-page__simple-name">{crop.name}</span>
                  <span className="crops-page__simple-field">{crop.field} • {crop.stage}</span>
                </div>
              </div>
              <div className="crops-page__simple-right">
                <span className="crops-page__simple-health" style={{ color: crop.health >= 80 ? 'var(--accent)' : 'var(--warning)' }}>{crop.health}%</span>
                <StatusBadge status={crop.health >= 80 ? 'healthy' : 'needs-attention'} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* STANDARD & ADVANCED: Card grid */
        <div className="crops-page__grid">
          {crops.map((crop) => (
            <div key={crop.id} className="crops-page__card" onClick={() => navigate(`/crops/${crop.id}`)}>
              <div className="crops-page__card-header">
                <div className="crops-page__card-crop">
                  <Leaf size={16} />
                  <span className="crops-page__card-name">{crop.name}</span>
                </div>
                <StatusBadge status={crop.health >= 80 ? 'healthy' : 'needs-attention'} />
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
              <div className="crops-page__card-health">
                <span className="crops-page__card-health-label">{t('crops.cropHealth')}</span>
                <span className={`crops-page__card-health-value ${crop.health >= 80 ? 'crops-page__card-health-value--good' : 'crops-page__card-health-value--warn'}`}>{crop.health}%</span>
              </div>
              {isAdvanced && (
                <>
                  <div className="crops-page__card-stage">
                    <span className="crops-page__card-stage-label">Expected Yield</span>
                    <span className="crops-page__card-stage-value">{crop.expectedYield} Ton</span>
                  </div>
                  <div className="crops-page__card-stage">
                    <span className="crops-page__card-stage-label">Potential Yield</span>
                    <span className="crops-page__card-stage-value" style={{ color: 'var(--accent)' }}>{crop.potentialYield} Ton</span>
                  </div>
                </>
              )}
              <div className="crops-page__card-footer">
                <span>{crop.expectedYield} {t('common.ton')} expected</span>
                <ArrowRight size={14} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
