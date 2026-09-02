import { useLanguage } from '../hooks/useLanguage';
import { soilData } from '../data/mockData';
import ProgressBar from '../components/common/ProgressBar';
import './Soil.css';

export default function Soil() {
  const { t } = useLanguage();
  const s = soilData.overall;

  return (
    <div className="page-container soil-page">
      <section className="soil-page__header section"><h1 className="soil-page__title">{t('nav.soil')}</h1></section>
      <section className="soil-page__overview section">
        <div className="soil-page__ph">
          <span className="soil-page__ph-label">{t('soil.ph')}</span>
          <span className="soil-page__ph-value">{s.ph}</span>
          <span className="soil-page__ph-status">{t('soil.soilStatus')}: {s.status}</span>
        </div>
        <div className="soil-page__issue">
          <span className="soil-page__issue-label">{t('soil.potentialIssue')}</span>
          <span className="soil-page__issue-text">{s.issue}</span>
        </div>
      </section>
      <section className="soil-page__nutrients section">
        <h2 className="soil-page__section-title">Nutrient Levels</h2>
        <div className="soil-page__nutrient-grid">
          <div className="soil-page__nutrient-card"><ProgressBar value={82} label={t('soil.nitrogen')} /><span className="soil-page__nutrient-value">82%</span></div>
          <div className="soil-page__nutrient-card"><ProgressBar value={67} label={t('soil.phosphorus')} /><span className="soil-page__nutrient-value">67%</span></div>
          <div className="soil-page__nutrient-card"><ProgressBar value={89} label={t('soil.potassium')} /><span className="soil-page__nutrient-value">89%</span></div>
          <div className="soil-page__nutrient-card"><ProgressBar value={62} label={t('soil.organicMatter')} /><span className="soil-page__nutrient-value">3.1%</span></div>
          <div className="soil-page__nutrient-card"><ProgressBar value={68} label={t('soil.moisture')} /><span className="soil-page__nutrient-value">68%</span></div>
        </div>
      </section>
      <section className="soil-page__details section">
          <h2 className="soil-page__section-title">Per-Field Soil Data</h2>
          <div className="soil-page__field-grid">
            {Object.entries(soilData.fields).map(([id, soil]) => (
              <div key={id} className="soil-page__field-card">
                <h3 className="soil-page__field-name">{id.replace('field-', 'Field ').toUpperCase()}</h3>
                <div className="soil-page__field-data">
                  <span>pH: {soil.ph}</span><span>N: {soil.nitrogen}%</span><span>P: {soil.phosphorus}%</span>
                  <span>K: {soil.potassium}%</span><span>OM: {soil.organicMatter}%</span><span>Moisture: {soil.moisture}%</span>
                </div>
              </div>
            ))}
          </div>
        </section>
    </div>
  );
}
