import { useLanguage } from '../hooks/useLanguage';
import { irrigationData } from '../data/mockData';
import { Droplets, TrendingDown } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import StatusBadge from '../components/common/StatusBadge';
import ProgressBar from '../components/common/ProgressBar';
import './Irrigation.css';

export default function Irrigation() {
  const { t } = useLanguage();

  if (true) {
    return (
      <div className="page-container irrigation-page">
        <section className="irrigation-page__header section"><h1 className="irrigation-page__title">{t('nav.irrigation')}</h1></section>
        <section className="irrigation-page__summary section">
          <div className="irrigation-page__usage-card">
            <div className="irrigation-page__usage-icon"><Droplets size={20} /></div>
            <div>
              <span className="irrigation-page__usage-value">{irrigationData.thisWeek.toLocaleString()} {t('irrigation.liters')}</span>
              <span className="irrigation-page__usage-label">{t('irrigation.thisWeek')}</span>
            </div>
          </div>
          <div className="irrigation-page__change-card"><TrendingDown size={16} /><span>{Math.abs(irrigationData.change)}% {t('irrigation.lower')}</span></div>
        </section>
        <section className="irrigation-page__fields section">
          <h2 className="irrigation-page__section-title">{t('irrigation.fieldMoisture')}</h2>
          <div className="irrigation-page__field-list">
            {irrigationData.fields.map((field) => (
              <div key={field.fieldId} className="irrigation-page__field-row">
                <div className="irrigation-page__field-info"><span className="irrigation-page__field-name">{field.name}</span><StatusBadge status={field.status} /></div>
                <div className="irrigation-page__field-moisture">
                  <ProgressBar value={field.moisture} height={8} showValue={false} />
                  <span className="irrigation-page__field-value">{field.moisture}%</span>
                </div>
              </div>
            ))}
          </div>
        </section>
        <section className="irrigation-page__chart section">
          <h2 className="irrigation-page__section-title">Weekly Usage</h2>
          <div className="irrigation-page__chart-container">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={irrigationData.weeklyUsage}>
                <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'var(--chart-text)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--chart-text)' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: 12 }} />
                <Bar dataKey="liters" fill="var(--accent)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
    );
  }
}
