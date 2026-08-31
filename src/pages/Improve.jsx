import { useLanguage } from '../hooks/useLanguage';
import { useInfoLevel } from '../hooks/useInfoLevel';
import { crops, recommendations } from '../data/mockData';
import { Droplets, FlaskConical, Bug, Sprout, ArrowRight } from 'lucide-react';
import StatusBadge from '../components/common/StatusBadge';
import './Improve.css';

const improvements = [
  { id: 1, title: 'Better Water Management', impact: 'high', icon: Droplets, benefit: '+0.2 Ton potential', color: 'var(--info)' },
  { id: 2, title: 'Nutrient Optimization', impact: 'medium', icon: FlaskConical, benefit: '+0.15 Ton potential', color: 'var(--accent)' },
  { id: 3, title: 'Disease Prevention', impact: 'high', icon: Bug, benefit: '+0.1 Ton potential', color: 'var(--warning)' },
  { id: 4, title: 'Growth Monitoring', impact: 'medium', icon: Sprout, benefit: '+0.05 Ton potential', color: 'var(--accent)' },
];

export default function Improve() {
  const { t } = useLanguage();
  const { isSimple, isAdvanced } = useInfoLevel();
  const mainCrop = crops[0];

  if (isSimple) {
    return (
      <div className="page-container improve-page">
        <section className="improve-page__header section"><h1 className="improve-page__title">{t('nav.improve')}</h1></section>
        <section className="section">
          <div className="simple-card">
            <span className="simple-card__big-number">3.8 → 4.3 Ton</span>
            <span className="simple-card__big-label">Potential yield improvement</span>
          </div>
        </section>
        <section className="section">
          <div className="simple-card simple-card--alert"><h3 className="simple-card__title">Improve Irrigation</h3><p className="simple-card__desc">High Priority — +0.2 Ton potential</p></div>
        </section>
        <section className="section">
          <div className="simple-card"><h3 className="simple-card__title">Nutrient Balance</h3><p className="simple-card__desc">Medium Priority — +0.15 Ton potential</p></div>
        </section>
      </div>
    );
  }

  return (
    <div className="page-container improve-page">
      <section className="improve-page__header section"><h1 className="improve-page__title">{t('nav.improve')}</h1><p className="improve-page__subtitle">Maximize your farm's potential</p></section>
      <section className="improve-page__yield section">
        <div className="improve-page__yield-card">
          <div className="improve-page__yield-item"><span className="improve-page__yield-label">{t('improve.currentYield')}</span><span className="improve-page__yield-value">{mainCrop.expectedYield} {t('common.ton')}</span></div>
          <div className="improve-page__yield-gap">
            <div className="improve-page__yield-gap-bar"><div className="improve-page__yield-gap-fill" style={{ width: `${(mainCrop.expectedYield / mainCrop.potentialYield) * 100}%` }} /></div>
            <span className="improve-page__yield-gap-text">{t('improve.yieldGap')}: {(mainCrop.potentialYield - mainCrop.expectedYield).toFixed(1)} {t('common.ton')}</span>
          </div>
          <div className="improve-page__yield-item improve-page__yield-item--potential"><span className="improve-page__yield-label">{t('improve.potentialYield')}</span><span className="improve-page__yield-value">{mainCrop.potentialYield} {t('common.ton')}</span></div>
        </div>
      </section>
      <section className="improve-page__list section">
        <h2 className="improve-page__section-title">{t('improve.improveYield')}</h2>
        <div className="improve-page__improvement-grid">
          {improvements.map((imp) => (
            <div key={imp.id} className="improve-page__improvement-card">
              <div className="improve-page__improvement-icon" style={{ background: `${imp.color}20`, color: imp.color }}><imp.icon size={20} /></div>
              <div className="improve-page__improvement-content">
                <h3 className="improve-page__improvement-title">{imp.title}</h3>
                <div className="improve-page__improvement-meta">
                  <StatusBadge status={imp.impact === 'high' ? 'critical' : 'needs-attention'} />
                  <span className="improve-page__improvement-benefit">{imp.benefit}</span>
                </div>
              </div>
              <ArrowRight size={16} className="improve-page__improvement-arrow" />
            </div>
          ))}
        </div>
      </section>
      {isAdvanced && (
        <section className="improve-page__recommendations section">
          <h2 className="improve-page__section-title">Active Recommendations</h2>
          <div className="improve-page__rec-list">
            {recommendations.slice(0, 3).map((rec) => (
              <div key={rec.id} className="improve-page__rec-card">
                <div className="improve-page__rec-header"><StatusBadge status={rec.category === 'critical' ? 'critical' : rec.category === 'important' ? 'needs-attention' : 'optimal'} /><span className="improve-page__rec-field">{rec.field}</span></div>
                <h3 className="improve-page__rec-title">{rec.title}</h3>
                <p className="improve-page__rec-desc">{rec.description}</p>
                <div className="improve-page__rec-footer"><span className="improve-page__rec-benefit">Benefit: {rec.benefit}</span></div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
