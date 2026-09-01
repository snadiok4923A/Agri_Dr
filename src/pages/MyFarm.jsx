import { useLanguage } from '../hooks/useLanguage';
import { useInfoLevel } from '../hooks/useInfoLevel';
import { farmData, fields } from '../data/mockData';
import { useNavigate } from 'react-router-dom';
import { MapPin, Leaf, TrendingUp, BarChart3, Droplets, ChevronRight } from 'lucide-react';
import StatusBadge from '../components/common/StatusBadge';
import './MyFarm.css';

export default function MyFarm() {
  const { t } = useLanguage();
  const { isSimple, isAdvanced } = useInfoLevel();
  const navigate = useNavigate();

  return (
    <div className="page-container myfarm">
      <section className="myfarm__header section">
        <h1 className="myfarm__title">{t('nav.myFarm')}</h1>
        <p className="myfarm__subtitle">{t('farm.selectField')}</p>
      </section>

      {/* Stats: All modes */}
      <section className="myfarm__stats section">
        <div className="myfarm__stat">
          <div className="myfarm__stat-icon" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}><MapPin size={20} /></div>
          <div className="myfarm__stat-content">
            <span className="myfarm__stat-value">{farmData.totalLand} {isSimple ? 'Ac' : t('dashboard.acres')}</span>
            <span className="myfarm__stat-label">{t('farm.totalLand')}</span>
          </div>
        </div>
        <div className="myfarm__stat">
          <div className="myfarm__stat-icon" style={{ background: 'var(--success-soft)', color: 'var(--success)' }}><Leaf size={20} /></div>
          <div className="myfarm__stat-content">
            <span className="myfarm__stat-value">{farmData.activeCrops}</span>
            <span className="myfarm__stat-label">{t('farm.activeCrops')}</span>
          </div>
        </div>
        {!isSimple && (
          <>
            <div className="myfarm__stat">
              <div className="myfarm__stat-icon" style={{ background: 'var(--info-soft)', color: 'var(--info)' }}><TrendingUp size={20} /></div>
              <div className="myfarm__stat-content">
                <span className="myfarm__stat-value">{farmData.expectedYield} {t('common.ton')}</span>
                <span className="myfarm__stat-label">{t('farm.expectedProduction')}</span>
              </div>
            </div>
            <div className="myfarm__stat">
              <div className="myfarm__stat-icon" style={{ background: 'var(--warning-soft)', color: 'var(--warning)' }}><BarChart3 size={20} /></div>
              <div className="myfarm__stat-content">
                <span className="myfarm__stat-value">{farmData.farmHealth}<span className="myfarm__stat-unit">/100</span></span>
                <span className="myfarm__stat-label">{t('farm.farmPerformance')}</span>
              </div>
            </div>
          </>
        )}
      </section>

      {/* Farm Map: Advanced only */}
      {!isSimple && (
        <section className="myfarm__map section">
          <div className="myfarm__map-container">
            <div className="myfarm__map-grid">
              {fields.map((field) => (
                <div key={field.id} className={`myfarm__map-field myfarm__map-field--${field.status}`} style={{ gridColumn: field.coordinates.x > 40 ? '2' : '1', gridRow: field.coordinates.y > 40 ? '2' : '1' }} onClick={() => navigate('/crops')}>
                  <div className="myfarm__map-field-inner">
                    <span className="myfarm__map-field-name">{field.name}</span>
                    <span className="myfarm__map-field-crop">{field.variety || field.crop}</span>
                    <span className="myfarm__map-field-health">{field.health}%</span>
                  </div>
                  <div className="myfarm__map-field-area">{field.area} ac</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Field List: All modes */}
      <section className="myfarm__fields section">
        <h2 className="myfarm__section-title">{t('farm.fieldList')}</h2>
        <div className="myfarm__field-list">
          {fields.map((field) => (
            <div key={field.id} className="myfarm__field-row" onClick={() => navigate('/crops')}>
              <div className="myfarm__field-row-left">
                <div className="myfarm__field-row-color" style={{ background: field.health >= 80 ? 'var(--accent)' : 'var(--warning)' }} />
                <div>
                  <span className="myfarm__field-row-name">{field.name}</span>
                  <span className="myfarm__field-row-crop">{field.variety || field.crop} {!isSimple && `• ${field.area} ${t('dashboard.acres')}`}</span>
                </div>
              </div>
              <div className="myfarm__field-row-center">
                <StatusBadge status={field.status} />
              </div>
              <div className="myfarm__field-row-right">
                <div className="myfarm__field-row-health">
                  <div className="myfarm__field-row-bar">
                    <div className="myfarm__field-row-fill" style={{ width: `${field.health}%`, background: field.health >= 80 ? 'var(--accent)' : 'var(--warning)' }} />
                  </div>
                  <span>{field.health}%</span>
                </div>
                {isAdvanced && (
                  <div className="myfarm__field-row-details">
                    <span><Droplets size={12} /> {field.soilMoisture}%</span>
                    <span>{field.cropAge} {t('farm.days')}</span>
                  </div>
                )}
                <ChevronRight size={16} className="myfarm__field-row-arrow" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
