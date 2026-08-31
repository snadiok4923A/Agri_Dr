import { useLanguage } from '../hooks/useLanguage';
import { useInfoLevel } from '../hooks/useInfoLevel';
import { useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import ProgressRing from '../components/common/ProgressRing';
import ProgressBar from '../components/common/ProgressBar';
import './Health.css';

const healthData = { overall: 87, growth: 84, water: 72, nutrition: 81, diseaseRisk: 8, environment: 91 };
const trends = {
  '7d': [{ day: '1', health: 81 }, { day: '2', health: 82 }, { day: '3', health: 83 }, { day: '4', health: 82 }, { day: '5', health: 84 }, { day: '6', health: 86 }, { day: '7', health: 87 }],
  '14d': Array.from({ length: 14 }, (_, i) => ({ day: `${i + 1}`, health: 78 + Math.floor(i * 0.6) + Math.floor(Math.random() * 2) })),
  '30d': Array.from({ length: 30 }, (_, i) => ({ day: `${i + 1}`, health: 72 + Math.floor(i * 0.5) + Math.floor(Math.random() * 3) })),
};

export default function Health() {
  const { t } = useLanguage();
  const { isSimple, isAdvanced } = useInfoLevel();
  const [period, setPeriod] = useState('7d');

  if (isSimple) {
    return (
      <div className="page-container health-page">
        <section className="health-page__header section"><h1 className="health-page__title">{t('health.overallHealth')}</h1></section>
        <section className="section">
          <div className="simple-card simple-card--accent">
            <div className="simple-card__row">
              <div><span className="simple-card__big-number">87%</span><span className="simple-card__big-label">Crop Health</span></div>
              <ProgressRing value={87} size={80} strokeWidth={6} />
            </div>
          </div>
        </section>
        <section className="section">
          <div className="simple-strips">
            <div className="simple-strip"><span className="simple-strip__label">Status</span><span className="simple-strip__value simple-strip__value--good">Healthy ✓</span></div>
            <div className="simple-strip"><span className="simple-strip__label">Water</span><span className="simple-strip__value simple-strip__value--warn">72%</span></div>
            <div className="simple-strip"><span className="simple-strip__label">Soil</span><span className="simple-strip__value simple-strip__value--good">Good ✓</span></div>
            <div className="simple-strip"><span className="simple-strip__label">Disease</span><span className="simple-strip__value simple-strip__value--good">Low Risk ✓</span></div>
          </div>
        </section>
        <section className="section">
          <div className="simple-card">
            <h3 className="simple-card__title">Recommendation</h3>
            <p className="simple-card__desc">Check irrigation in Field B. Moisture is slightly low.</p>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="page-container health-page">
      <section className="health-page__header section"><h1 className="health-page__title">{t('health.overallHealth')}</h1></section>
      <section className="health-page__score section">
        <div className="health-page__score-main">
          <ProgressRing value={healthData.overall} size={160} strokeWidth={10} />
          <div className="health-page__score-info">
            <span className="health-page__score-status">{t('common.healthy')}</span>
            <span className="health-page__score-label">{t('health.overallHealth')}</span>
            <span className="health-page__score-trend health-page__score-trend--up">↗ Improving</span>
          </div>
        </div>
        <div className="health-page__breakdown">
          <div className="health-page__breakdown-item"><ProgressBar value={healthData.growth} label={t('health.growth')} /></div>
          <div className="health-page__breakdown-item"><ProgressBar value={healthData.water} label={t('health.waterStress')} /></div>
          <div className="health-page__breakdown-item"><ProgressBar value={healthData.nutrition} label={t('health.nutrition')} /></div>
          <div className="health-page__breakdown-item"><ProgressBar value={100 - healthData.diseaseRisk} label={t('health.diseaseRisk')} /></div>
          {isAdvanced && <div className="health-page__breakdown-item"><ProgressBar value={healthData.environment} label={t('health.environment')} /></div>}
        </div>
      </section>
      <section className="health-page__trend section">
        <div className="health-page__trend-header">
          <h2 className="health-page__section-title">Health Trend</h2>
          <div className="health-page__period-selector">
            <button className={period === '7d' ? 'active' : ''} onClick={() => setPeriod('7d')}>{t('health.sevenDay')}</button>
            <button className={period === '14d' ? 'active' : ''} onClick={() => setPeriod('14d')}>{t('health.fourteenDay')}</button>
            {isAdvanced && <button className={period === '30d' ? 'active' : ''} onClick={() => setPeriod('30d')}>{t('health.thirtyDay')}</button>}
          </div>
        </div>
        <div className="health-page__chart">
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={trends[period]}>
              <defs><linearGradient id="healthTrendGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--accent)" stopOpacity={0.15} /><stop offset="100%" stopColor="var(--accent)" stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'var(--chart-text)' }} axisLine={false} tickLine={false} />
              <YAxis domain={[60, 100]} tick={{ fontSize: 11, fill: 'var(--chart-text)' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: 12 }} />
              <Area type="monotone" dataKey="health" stroke="var(--accent)" fill="url(#healthTrendGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>
      {isAdvanced && (
        <section className="health-page__fields section">
          <h2 className="health-page__section-title">Field Health Comparison</h2>
          <div className="health-page__fields-grid">
            {[{ name: 'Field A', crop: 'Rice', health: 87 }, { name: 'Field B', crop: 'Rice', health: 74 }, { name: 'Field C', crop: 'Potato', health: 91 }, { name: 'Field D', crop: 'Vegetables', health: 82 }].map((f) => (
              <div key={f.name} className="health-page__field-item">
                <div className="health-page__field-info"><span className="health-page__field-name">{f.name}</span><span className="health-page__field-crop">{f.crop}</span></div>
                <ProgressRing value={f.health} size={56} strokeWidth={4} />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
