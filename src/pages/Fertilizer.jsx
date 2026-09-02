import { useLanguage } from '../hooks/useLanguage';
import { fertilizerData } from '../data/mockData';
import { Beaker, Clock } from 'lucide-react';
import StatusBadge from '../components/common/StatusBadge';
import './Fertilizer.css';

export default function Fertilizer() {
  const { t } = useLanguage();
  return (
    <div className="page-container fertilizer-page">
      <section className="fertilizer-page__header section"><h1 className="fertilizer-page__title">{t('nav.fertilizer')}</h1></section>
      <section className="fertilizer-page__upcoming section">
        <h2 className="fertilizer-page__section-title">{t('fertilizer.nextApplication')}</h2>
        <div className="fertilizer-page__upcoming-list">
          {fertilizerData.nextApplications.map((app, i) => (
            <div key={i} className="fertilizer-page__upcoming-card">
              <div className="fertilizer-page__upcoming-icon"><Beaker size={18} /></div>
              <div className="fertilizer-page__upcoming-info">
                <span className="fertilizer-page__upcoming-product">{app.product}</span>
                <span className="fertilizer-page__upcoming-detail">{app.field} — {app.crop}</span>
              </div>
              <div className="fertilizer-page__upcoming-amount">
                <span className="fertilizer-page__upcoming-qty">{app.amount}</span>
                <span className="fertilizer-page__upcoming-due"><Clock size={12} />{t('fertilizer.due')}: {app.due}</span>
              </div>
              <StatusBadge status={app.priority === 'high' ? 'critical' : 'needs-attention'} />
            </div>
          ))}
        </div>
      </section>
      <section className="fertilizer-page__history section">
        <h2 className="fertilizer-page__section-title">{t('fertilizer.history')}</h2>
        <div className="fertilizer-page__history-list">
          {fertilizerData.history.map((item, i) => (
            <div key={i} className="fertilizer-page__history-row">
              <div className="fertilizer-page__history-date">{item.date}</div>
              <div className="fertilizer-page__history-info">
                <span className="fertilizer-page__history-product">{item.product}</span>
                <span className="fertilizer-page__history-detail">{item.field} — {item.amount}</span>
              </div>
              <StatusBadge status={item.status} />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
