import { useLanguage } from '../hooks/useLanguage';
import { analyticsData, activityData, calendarData } from '../data/mockData';
import { Clock } from 'lucide-react';
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import './Insights.css';

export default function Insights() {
  const { t } = useLanguage();


  return (
    <div className="page-container insights-page">
      <section className="insights-page__header section"><h1 className="insights-page__title">{t('nav.insights')}</h1></section>
      <section className="insights-page__metrics section">
        {analyticsData.metrics.map((m, i) => (
          <div key={i} className="insights-page__metric-card">
            <span className="insights-page__metric-label">{m.label}</span>
            <span className="insights-page__metric-value">{m.unit === '₹' ? `₹${m.value.toLocaleString('en-IN')}` : m.value}{m.unit && m.unit !== '₹' && <span className="insights-page__metric-unit">{m.unit}</span>}</span>
            <span className={`insights-page__metric-change insights-page__metric-change--${m.trend}`}>{m.trend === 'up' ? '↗' : '↘'} {Math.abs(m.change)}%</span>
          </div>
        ))}
      </section>
      <div className="insights-page__grid">
        <section className="insights-page__chart-card section">
          <h2 className="insights-page__section-title">{t('insights.cropHealth')}</h2>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={analyticsData.healthTrend}>
              <defs><linearGradient id="insightHealthGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--accent)" stopOpacity={0.15} /><stop offset="100%" stopColor="var(--accent)" stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" />
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'var(--chart-text)' }} axisLine={false} tickLine={false} />
              <YAxis domain={[70, 95]} tick={{ fontSize: 10, fill: 'var(--chart-text)' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: 12 }} />
              <Area type="monotone" dataKey="health" stroke="var(--accent)" fill="url(#insightHealthGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </section>
        <section className="insights-page__chart-card section">
            <h2 className="insights-page__section-title">{t('insights.yield')}</h2>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={analyticsData.yieldTrend}>
                <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'var(--chart-text)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--chart-text)' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: 12 }} />
                <Line type="monotone" dataKey="actual" stroke="var(--accent)" strokeWidth={2} dot={false} name="Actual" />
                <Line type="monotone" dataKey="potential" stroke="var(--text-muted)" strokeWidth={2} strokeDasharray="5 5" dot={false} name="Potential" />
              </LineChart>
            </ResponsiveContainer>
          </section>
      </div>
      <section className="insights-page__activity section">
        <h2 className="insights-page__section-title">{t('insights.recentActivity')}</h2>
        <div className="insights-page__activity-list">
          {activityData.map((a) => (
            <div key={a.id} className="insights-page__activity-item">
              <div className="insights-page__activity-dot" />
              <div className="insights-page__activity-content"><span className="insights-page__activity-action">{a.action}</span><span className="insights-page__activity-field">{a.field}</span></div>
              <span className="insights-page__activity-time"><Clock size={12} />{a.time}</span>
            </div>
          ))}
        </div>
      </section>
      <section className="insights-page__calendar section">
          <h2 className="insights-page__section-title">Crop Calendar</h2>
          <div className="insights-page__calendar-list">
            {calendarData.map((c, i) => (
              <div key={i} className="insights-page__calendar-item">
                <div className="insights-page__calendar-date">{c.date}</div>
                <div className="insights-page__calendar-info"><span className="insights-page__calendar-task">{c.task}</span><span className="insights-page__calendar-field">{c.field}</span></div>
                <span className={`insights-page__calendar-badge insights-page__calendar-badge--${c.type}`}>{c.type}</span>
              </div>
            ))}
          </div>
        </section>
    </div>
  );
}
