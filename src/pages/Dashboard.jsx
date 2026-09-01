import { useLanguage } from '../hooks/useLanguage';
import { useInfoLevel } from '../hooks/useInfoLevel';
import { farmData, fields, weatherData, recommendations, activityData } from '../data/mockData';
import { useNavigate } from 'react-router-dom';
import {
  CloudSun, Droplets, AlertTriangle, TrendingUp, MapPin,
  Thermometer, Wind, CloudRain, Eye, ArrowRight, Leaf,
  CheckCircle2, Clock, Activity, Shield, Sprout,
  Wheat, CircleDot, Sun, Cloud, CloudDrizzle,
} from 'lucide-react';
import {
  LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import StatusBadge from '../components/common/StatusBadge';
import './Dashboard.css';

const getGreeting = (t) => {
  const hour = new Date().getHours();
  if (hour < 12) return t('dashboard.greeting');
  if (hour < 17) return t('dashboard.greetingAfternoon');
  return t('dashboard.greetingEvening');
};

const healthTrendData = [
  { day: 'Mon', health: 78 }, { day: 'Tue', health: 80 }, { day: 'Wed', health: 82 },
  { day: 'Thu', health: 81 }, { day: 'Fri', health: 84 }, { day: 'Sat', health: 85 }, { day: 'Sun', health: 87 },
];

const yieldData = [
  { month: 'Apr', actual: 2.8, potential: 3.2 }, { month: 'May', actual: 3.0, potential: 3.5 },
  { month: 'Jun', actual: 3.2, potential: 3.8 }, { month: 'Jul', actual: 3.4, potential: 4.0 },
  { month: 'Aug', actual: 3.6, potential: 4.2 }, { month: 'Sep', actual: 3.8, potential: 4.3 },
];

export default function Dashboard() {
  const { t } = useLanguage();
  const { isSimple, isAdvanced } = useInfoLevel();
  const navigate = useNavigate();

  const criticalActions = isSimple
    ? recommendations.filter(r => r.category === 'critical').slice(0, 1)
    : recommendations.filter(r => r.category === 'critical' || r.category === 'important').slice(0, isAdvanced ? 4 : 3);

  // ===== SIMPLE MODE =====
  if (isSimple) {
    return (
      <div className="page-container dashboard">
        <section className="dashboard__greeting section">
          <h1 className="dashboard__greeting-text">{getGreeting(t)} 👋</h1>
          <p className="dashboard__greeting-sub">{t('dashboard.farmHealthy')}</p>
        </section>

        {/* Simple Farm Health Card */}
        <section className="section">
          <div className="simple-card simple-card--accent">
            <div className="simple-card__row">
              <div>
                <span className="simple-card__big-number">87%</span>
                <span className="simple-card__big-label">Crop Health</span>
              </div>
              <StatusBadge status="healthy" size="md" />
            </div>
          </div>
        </section>

        {/* Simple Status Strips */}
        <section className="section">
          <div className="simple-strips">
            <div className="simple-strip">
              <Leaf size={16} />
              <span className="simple-strip__label">Crop</span>
              <span className="simple-strip__value simple-strip__value--good">Healthy ✓</span>
            </div>
            <div className="simple-strip">
              <Droplets size={16} />
              <span className="simple-strip__label">Water</span>
              <span className="simple-strip__value simple-strip__value--warn">Needs Attention ⚠</span>
            </div>
            <div className="simple-strip">
              <Sprout size={16} />
              <span className="simple-strip__label">Soil</span>
              <span className="simple-strip__value simple-strip__value--good">Good ✓</span>
            </div>
            <div className="simple-strip">
              <TrendingUp size={16} />
              <span className="simple-strip__label">Yield</span>
              <span className="simple-strip__value simple-strip__value--good">On Track ✓</span>
            </div>
          </div>
        </section>

        {/* Simple Weather */}
        <section className="section">
          <div className="simple-card">
            <div className="simple-card__row">
              <CloudSun size={32} style={{ color: 'var(--warning)' }} />
              <div>
                <span className="simple-card__big-number">{weatherData.current.temperature}°C</span>
                <span className="simple-card__big-label">Rain expected today</span>
              </div>
            </div>
          </div>
        </section>

        {/* Simple Today's Action */}
        {criticalActions.length > 0 && (
          <section className="section">
            <div className="simple-card simple-card--alert">
              <h3 className="simple-card__title">Today's Action</h3>
              <p className="simple-card__desc">{criticalActions[0].description}</p>
              <button className="simple-card__btn" onClick={() => navigate('/improve')}>{t('dashboard.viewDetails')} →</button>
            </div>
          </section>
        )}
      </div>
    );
  }

  // ===== ADVANCED MODE =====
  const healthDonutData = [
    { name: 'Health', value: farmData.farmHealth },
    { name: 'Remaining', value: 100 - farmData.farmHealth },
  ];
  const healthyArea = fields.filter(f => f.status === 'healthy').reduce((sum, f) => sum + f.area, 0);
  const totalArea = farmData.totalLand;
  const totalYield = fields.reduce((sum, f) => sum + (f.cropAge / (f.variety === 'Basmati' ? 130 : f.variety === 'Samba Mahsuri' ? 115 : 120) * (f.variety === 'Basmati' ? 4.1 : f.variety === 'Samba Mahsuri' ? 3.5 : f.variety === 'Swarna' ? 3.2 : 3.8)), 0).toFixed(1);
  const potentialYield = fields.reduce((sum, f) => sum + (f.variety === 'Basmati' ? 4.6 : f.variety === 'Samba Mahsuri' ? 4.1 : f.variety === 'Swarna' ? 4.0 : 4.3), 0).toFixed(1);
  const warnings = fields.filter(f => f.status === 'needs-attention' || f.soilMoisture < 40);

  return (
    <div className="page-container dashboard adv-dashboard">
      {/* Row 1: Weather Compact + Health Donut + Farm Area + Varieties + Yield */}
      <div className="adv-top-grid">
        {/* Compact Weather */}
        <div className="adv-card adv-weather-compact">
          <div className="adv-weather-compact__main">
            <CloudSun size={28} className="adv-weather-compact__icon" />
            <div>
              <span className="adv-weather-compact__temp">{weatherData.current.temperature}°</span>
              <span className="adv-weather-compact__cond">{weatherData.current.condition}</span>
            </div>
          </div>
          <div className="adv-weather-compact__row">
            <span className="adv-weather-compact__chip"><Droplets size={12} /> {weatherData.current.rainProbability}%</span>
            <span className="adv-weather-compact__chip"><Wind size={12} /> {weatherData.current.wind} km/h</span>
          </div>
        </div>

        {/* Farm Health Donut */}
        <div className="adv-card adv-health-donut">
          <div className="adv-health-donut__chart">
            <ResponsiveContainer width="100%" height={140}>
              <PieChart>
                <Pie
                  data={healthDonutData}
                  cx="50%" cy="50%"
                  innerRadius={42} outerRadius={58}
                  startAngle={90} endAngle={-270}
                  dataKey="value"
                  stroke="none"
                >
                  <Cell fill="var(--accent)" />
                  <Cell fill="var(--border)" />
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="adv-health-donut__center">
              <span className="adv-health-donut__value">{farmData.farmHealth}</span>
              <span className="adv-health-donut__label">%</span>
            </div>
          </div>
          <div className="adv-health-donut__info">
            <span className="adv-card__label">Farm Health</span>
            <span className="adv-card__badge adv-card__badge--green">Healthy</span>
          </div>
        </div>

        {/* Farm Area */}
        <div className="adv-card adv-farm-area">
          <span className="adv-card__label">Farm Area</span>
          <div className="adv-farm-area__main">
            <span className="adv-farm-area__big">{totalArea}</span>
            <span className="adv-farm-area__unit">ac</span>
          </div>
          <div className="adv-farm-area__bar">
            <div className="adv-farm-area__fill" style={{ width: `${(healthyArea / totalArea) * 100}%` }} />
          </div>
          <span className="adv-farm-area__sub"><span style={{ color: 'var(--accent)' }}>{healthyArea}</span> ac healthy</span>
        </div>

        {/* Active Varieties */}
        <div className="adv-card adv-varieties">
          <span className="adv-card__label">Active Varieties</span>
          <span className="adv-varieties__count">{farmData.activeCrops}</span>
          <div className="adv-varieties__chips">
            {fields.map(f => (
              <span key={f.id} className="adv-varieties__chip">{f.variety || f.crop}</span>
            ))}
          </div>
        </div>

        {/* Expected Yield */}
        <div className="adv-card adv-yield-gauge">
          <span className="adv-card__label">Expected Yield</span>
          <div className="adv-yield-gauge__main">
            <span className="adv-yield-gauge__value">{totalYield}</span>
            <span className="adv-yield-gauge__unit">Ton</span>
          </div>
          <div className="adv-yield-gauge__bar">
            <div className="adv-yield-gauge__fill" style={{ width: `${(parseFloat(totalYield) / parseFloat(potentialYield)) * 100}%` }} />
          </div>
          <span className="adv-yield-gauge__sub">Potential {potentialYield} Ton</span>
        </div>
      </div>

      {/* Row 2: Warnings (only if any) + Performance Metrics */}
      {warnings.length > 0 && (
        <div className="adv-warnings section">
          {warnings.map(f => (
            <div key={f.id} className="adv-warning-chip">
              <AlertTriangle size={14} className="adv-warning-chip__icon" />
              <div>
                <span className="adv-warning-chip__title">{f.soilMoisture < 40 ? 'Low Moisture' : 'Needs Attention'}</span>
                <span className="adv-warning-chip__field">{f.name} · {f.variety || f.crop}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Row 3: Compact Action Cards */}
      <section className="section">
        <div className="adv-actions">
          {criticalActions.map((action) => (
            <div key={action.id} className={`adv-action-chip adv-action-chip--${action.category}`} onClick={() => navigate('/improve')}>
              <div className="adv-action-chip__dot" />
              <div>
                <span className="adv-action-chip__title">{action.title}</span>
                <span className="adv-action-chip__field">{action.field}</span>
              </div>
              <ArrowRight size={14} className="adv-action-chip__arrow" />
            </div>
          ))}
        </div>
      </section>

      {/* Row 4: Charts — Health Trend + Yield Forecast side by side */}
      <div className="adv-charts-grid section">
        <div className="adv-card adv-chart-card">
          <span className="adv-card__label">Health Trend</span>
          <ResponsiveContainer width="100%" height={150}>
            <AreaChart data={healthTrendData}>
              <defs><linearGradient id="advHealthGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--accent)" stopOpacity={0.25} /><stop offset="100%" stopColor="var(--accent)" stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" />
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
              <YAxis domain={[70, 95]} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} width={30} />
              <Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: 11 }} />
              <Area type="monotone" dataKey="health" stroke="var(--accent)" fill="url(#advHealthGrad)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="adv-card adv-chart-card">
          <span className="adv-card__label">Yield Forecast</span>
          <div className="adv-chart-card__stats">
            <span className="adv-chart-card__stat"><span className="adv-chart-card__stat-dot" style={{ background: 'var(--accent)' }} />{totalYield}T actual</span>
            <span className="adv-chart-card__stat"><span className="adv-chart-card__stat-dot" style={{ background: 'var(--text-muted)' }} />{potentialYield}T potential</span>
          </div>
          <ResponsiveContainer width="100%" height={150}>
            <LineChart data={yieldData}>
              <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
              <YAxis domain={[2, 5]} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} width={30} />
              <Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: 11 }} />
              <Line type="monotone" dataKey="actual" stroke="var(--accent)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="potential" stroke="var(--text-muted)" strokeWidth={2} strokeDasharray="5 5" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Row 5: Field Cards — Visual Grid */}
      <section className="section">
        <span className="adv-section-label">Fields</span>
        <div className="adv-fields-grid">
          {fields.map((field) => {
            const progress = Math.round((field.cropAge / (field.variety === 'Basmati' ? 130 : field.variety === 'Samba Mahsuri' ? 115 : 120)) * 100);
            return (
              <div key={field.id} className={`adv-field-card ${field.status === 'needs-attention' ? 'adv-field-card--alert' : ''}`} onClick={() => navigate('/farm')}>
                <div className="adv-field-card__top">
                  <span className="adv-field-card__name">{field.name}</span>
                  <span className="adv-field-card__variety">{field.variety || field.crop}</span>
                </div>
                <div className="adv-field-card__health-ring">
                  <svg viewBox="0 0 44 44" className="adv-field-card__ring-svg">
                    <circle cx="22" cy="22" r="18" fill="none" stroke="var(--border)" strokeWidth="3" />
                    <circle cx="22" cy="22" r="18" fill="none" stroke={field.health >= 80 ? 'var(--accent)' : 'var(--warning)'} strokeWidth="3" strokeDasharray={`${field.health * 1.13} 113`} strokeLinecap="round" transform="rotate(-90 22 22)" />
                  </svg>
                  <span className="adv-field-card__health-val">{field.health}</span>
                </div>
                <div className="adv-field-card__meta">
                  <span className="adv-field-card__meta-item"><Droplets size={11} /> {field.soilMoisture}%</span>
                  <span className="adv-field-card__meta-item"><Clock size={11} /> {field.cropAge}d</span>
                  <span className="adv-field-card__meta-item"><MapPin size={11} /> {field.area}ac</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Row 6: Activity */}
      <section className="section">
        <span className="adv-section-label">Recent Activity</span>
        <div className="adv-activity">
          {activityData.slice(0, 5).map((activity) => (
            <div key={activity.id} className="adv-activity__item">
              <div className="adv-activity__dot" />
              <span className="adv-activity__text">{activity.action}</span>
              <span className="adv-activity__field">{activity.field}</span>
              <span className="adv-activity__time">{activity.time}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
