import { useLanguage } from '../hooks/useLanguage';
import { diseaseData } from '../data/mockData';
import { Bug, Shield, Search } from 'lucide-react';
import StatusBadge from '../components/common/StatusBadge';
import './Disease.css';

export default function Disease() {
  const { t } = useLanguage();


  return (
    <div className="page-container disease-page">
      <section className="disease-page__header section"><h1 className="disease-page__title">{t('nav.disease')}</h1></section>
      <div className="disease-page__grid">
        {diseaseData.map((disease) => (
          <div key={disease.id} className={`disease-page__card disease-page__card--${disease.severity}`}>
            <div className="disease-page__card-header">
              <div className="disease-page__card-title"><Bug size={18} /><span>{disease.name}</span></div>
              <StatusBadge status={disease.severity} />
            </div>
            <div className="disease-page__card-meta"><span>{disease.field} • {disease.crop}</span><span>{disease.detected}</span></div>
            <div className="disease-page__card-risk">
              <span className="disease-page__risk-label">{t('disease.risk')}</span>
              <div className="disease-page__risk-bar"><div className="disease-page__risk-fill" style={{ width: `${disease.risk}%`, background: disease.risk > 60 ? 'var(--danger)' : disease.risk > 30 ? 'var(--warning)' : 'var(--accent)' }} /></div>
              <span className="disease-page__risk-value">{disease.risk}%</span>
            </div>
            <div className="disease-page__card-section"><h4>{t('disease.symptoms')}</h4><p>{disease.symptoms}</p></div>
            <div className="disease-page__card-section"><h4>{t('disease.possibleCause')}</h4><p>{disease.cause}</p></div>
            <div className="disease-page__card-section disease-page__card-section--action"><h4><Shield size={14} /> {t('disease.recommendedAction')}</h4><p>{disease.recommendedAction}</p></div>
            <div className="disease-page__card-section"><h4><Search size={14} /> {t('disease.prevention')}</h4><p>{disease.prevention}</p></div>
          </div>
        ))}
      </div>
    </div>
  );
}
