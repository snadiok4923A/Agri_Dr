import { useLanguage } from '../hooks/useLanguage';
import { useInfoLevel } from '../hooks/useInfoLevel';
import { farmData, fields, weatherData, recommendations, activityData } from '../data/mockData';
import { useNavigate } from 'react-router-dom';
import {
  CloudSun, Droplets, AlertTriangle, TrendingUp, MapPin,
  Thermometer, Wind, CloudRain, Eye, ArrowRight, Leaf,
  CheckCircle2, Clock, Activity, Shield, Sprout,
} from 'lucide-react';
import {
  LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
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
  const { isSimple, isStandard, isAdvanced } = useInfoLevel();
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

  // ===== STANDARD MODE =====
  if (isStandard) {
    return (
      <div className="page-container dashboard">
        <section className="dashboard__greeting section">
          <h1 className="dashboard__greeting-text">{getGreeting(t)} 👋</h1>
          <p className="dashboard__greeting-sub">{t('dashboard.farmHealthy')}</p>
        </section>

        <section className="dashboard__stats section">
          {[
            { icon: MapPin, value: `${farmData.totalLand} ${t('dashboard.acres')}`, label: t('dashboard.totalLand') },
            { icon: Leaf, value: farmData.activeCrops, label: t('dashboard.activeCrops') },
            { icon: Activity, value: `${farmData.farmHealth}/100`, label: t('dashboard.farmHealth') },
            { icon: TrendingUp, value: `${farmData.expectedYield} ${t('dashboard.tons')}`, label: t('dashboard.expectedYield') },
          ].map((s, i) => (
            <div key={i} className="dashboard__stat-card">
              <div className="dashboard__stat-icon"><s.icon size={18} /></div>
              <div className="dashboard__stat-info">
                <span className="dashboard__stat-value">{s.value}</span>
                <span className="dashboard__stat-label">{s.label}</span>
              </div>
            </div>
          ))}
        </section>

        <section className="dashboard__actions section">
          <h2 className="dashboard__section-title">{t('dashboard.todaysActions')}</h2>
          <p className="dashboard__section-subtitle">{criticalActions.length} {t('dashboard.thingsNeedAttention')}</p>
          <div className="dashboard__action-list">
            {criticalActions.map((action) => (
              <div key={action.id} className="dashboard__action-card">
                <div className="dashboard__action-priority"><StatusBadge status={action.category === 'critical' ? 'critical' : 'needs-attention'} /></div>
                <div className="dashboard__action-content">
                  <h3 className="dashboard__action-title">{action.title}</h3>
                  <p className="dashboard__action-desc">{action.description}</p>
                </div>
                <button className="dashboard__action-btn" onClick={() => navigate('/improve')}>{t('dashboard.viewDetails')} <ArrowRight size={14} /></button>
              </div>
            ))}
          </div>
        </section>

        <div className="dashboard__grid">
          <section className="dashboard__weather section">
            <h2 className="dashboard__section-title">{t('dashboard.weatherForecast')}</h2>
            <div className="dashboard__weather-main">
              <div className="dashboard__weather-current">
                <CloudSun size={48} className="dashboard__weather-icon" />
                <div>
                  <span className="dashboard__weather-temp">{weatherData.current.temperature}°C</span>
                  <span className="dashboard__weather-condition">{weatherData.current.condition}</span>
                </div>
              </div>
              <div className="dashboard__weather-details">
                <div className="dashboard__weather-detail"><Droplets size={14} /><span>{weatherData.current.rainProbability}%</span></div>
                <div className="dashboard__weather-detail"><Thermometer size={14} /><span>{weatherData.current.humidity}%</span></div>
                <div className="dashboard__weather-detail"><Wind size={14} /><span>{weatherData.current.wind} km/h</span></div>
              </div>
            </div>
            <div className="dashboard__weather-impact"><AlertTriangle size={14} /><span>{weatherData.farmImpact.message}</span></div>
          </section>

          <section className="dashboard__trend section">
            <h2 className="dashboard__section-title">Health Trend</h2>
            <div className="dashboard__trend-chart">
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={healthTrendData}>
                  <defs><linearGradient id="healthGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--accent)" stopOpacity={0.2} /><stop offset="100%" stopColor="var(--accent)" stopOpacity={0} /></linearGradient></defs>
                  <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'var(--chart-text)' }} axisLine={false} tickLine={false} />
                  <YAxis domain={[70, 95]} tick={{ fontSize: 11, fill: 'var(--chart-text)' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: 12 }} />
                  <Area type="monotone" dataKey="health" stroke="var(--accent)" fill="url(#healthGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>

        <section className="dashboard__fields section">
          <h2 className="dashboard__section-title">{t('dashboard.fieldsOverview')}</h2>
          <div className="dashboard__fields-grid">
            {fields.map((field) => (
              <div key={field.id} className={`dashboard__field-card ${field.status === 'needs-attention' ? 'dashboard__field-card--alert' : ''}`} onClick={() => navigate('/farm')}>
                <div className="dashboard__field-header">
                  <span className="dashboard__field-name">{field.name}</span>
                  <StatusBadge status={field.status} />
                </div>
                <div className="dashboard__field-crop"><Leaf size={14} /><span>{field.crop}</span></div>
                <div className="dashboard__field-health">
                  <div className="dashboard__field-health-bar">
                    <div className="dashboard__field-health-fill" style={{ width: `${field.health}%`, background: field.health >= 80 ? 'var(--accent)' : 'var(--warning)' }} />
                  </div>
                  <span className="dashboard__field-health-value">{field.health}%</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="dashboard__activity section">
          <h2 className="dashboard__section-title">{t('insights.recentActivity')}</h2>
          <div className="dashboard__activity-list">
            {activityData.slice(0, 4).map((activity) => (
              <div key={activity.id} className="dashboard__activity-item">
                <div className="dashboard__activity-dot" />
                <div className="dashboard__activity-content">
                  <span className="dashboard__activity-action">{activity.action}</span>
                  <span className="dashboard__activity-field">{activity.field}</span>
                </div>
                <span className="dashboard__activity-time"><Clock size={12} />{activity.time}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    );
  }

  // ===== ADVANCED MODE =====
  return (
    <div className="page-container dashboard">
      <section className="dashboard__greeting section">
        <h1 className="dashboard__greeting-text">{getGreeting(t)} 👋</h1>
        <p className="dashboard__greeting-sub">{t('dashboard.farmHealthy')}</p>
      </section>

      <section className="dashboard__stats section">
        {[
          { icon: MapPin, value: `${farmData.totalLand} ${t('dashboard.acres')}`, label: t('dashboard.totalLand') },
          { icon: Leaf, value: farmData.activeCrops, label: t('dashboard.activeCrops') },
          { icon: Activity, value: `${farmData.farmHealth}/100`, label: t('dashboard.farmHealth') },
          { icon: TrendingUp, value: `${farmData.expectedYield} ${t('dashboard.tons')}`, label: t('dashboard.expectedYield') },
        ].map((s, i) => (
          <div key={i} className="dashboard__stat-card">
            <div className="dashboard__stat-icon"><s.icon size={18} /></div>
            <div className="dashboard__stat-info">
              <span className="dashboard__stat-value">{s.value}</span>
              <span className="dashboard__stat-label">{s.label}</span>
            </div>
          </div>
        ))}
      </section>

      {/* Advanced: Farm Performance Breakdown */}
      <section className="section">
        <div className="adv-performance">
          <h2 className="dashboard__section-title">Farm Performance</h2>
          <div className="adv-performance__grid">
            {[
              { label: 'Crop Health', value: 87 }, { label: 'Growth', value: 84 },
              { label: 'Water', value: 72 }, { label: 'Nutrition', value: 81 },
              { label: 'Disease Risk', value: 92 }, { label: 'Environment', value: 91 },
            ].map((item, i) => (
              <div key={i} className="adv-performance__item">
                <span className="adv-performance__label">{item.label}</span>
                <div className="adv-performance__bar">
                  <div className="adv-performance__fill" style={{ width: `${item.value}%`, background: item.value >= 80 ? 'var(--accent)' : item.value >= 60 ? 'var(--warning)' : 'var(--danger)' }} />
                </div>
                <span className="adv-performance__value">{item.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="dashboard__actions section">
        <h2 className="dashboard__section-title">{t('dashboard.todaysActions')}</h2>
        <p className="dashboard__section-subtitle">{criticalActions.length} {t('dashboard.thingsNeedAttention')}</p>
        <div className="dashboard__action-list">
          {criticalActions.map((action) => (
            <div key={action.id} className="dashboard__action-card">
              <div className="dashboard__action-priority"><StatusBadge status={action.category === 'critical' ? 'critical' : 'needs-attention'} /></div>
              <div className="dashboard__action-content">
                <h3 className="dashboard__action-title">{action.title}</h3>
                <p className="dashboard__action-desc">{action.description}</p>
              </div>
              <button className="dashboard__action-btn" onClick={() => navigate('/improve')}>{t('dashboard.viewDetails')} <ArrowRight size={14} /></button>
            </div>
          ))}
        </div>
      </section>

      <div className="dashboard__grid">
        <section className="dashboard__weather section">
          <h2 className="dashboard__section-title">{t('dashboard.weatherForecast')}</h2>
          <div className="dashboard__weather-main">
            <div className="dashboard__weather-current">
              <CloudSun size={48} className="dashboard__weather-icon" />
              <div>
                <span className="dashboard__weather-temp">{weatherData.current.temperature}°C</span>
                <span className="dashboard__weather-condition">{weatherData.current.condition}</span>
              </div>
            </div>
            <div className="dashboard__weather-details">
              <div className="dashboard__weather-detail"><Droplets size={14} /><span>{weatherData.current.rainProbability}%</span></div>
              <div className="dashboard__weather-detail"><Thermometer size={14} /><span>{weatherData.current.humidity}%</span></div>
              <div className="dashboard__weather-detail"><Wind size={14} /><span>{weatherData.current.wind} km/h</span></div>
            </div>
          </div>
          <div className="dashboard__weather-impact"><AlertTriangle size={14} /><span>{weatherData.farmImpact.message}</span></div>
          <div className="dashboard__forecast-mini">
            {weatherData.forecast.map((day, i) => (
              <div key={i} className="dashboard__forecast-day">
                <span className="dashboard__forecast-name">{day.day.slice(0, 3)}</span>
                <CloudSun size={16} />
                <span className="dashboard__forecast-temp">{day.high}°</span>
                <span className="dashboard__forecast-rain">{day.rain}%</span>
              </div>
            ))}
          </div>
        </section>

        <section className="dashboard__trend section">
          <h2 className="dashboard__section-title">Health Trend</h2>
          <div className="dashboard__trend-chart">
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={healthTrendData}>
                <defs><linearGradient id="healthGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--accent)" stopOpacity={0.2} /><stop offset="100%" stopColor="var(--accent)" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'var(--chart-text)' }} axisLine={false} tickLine={false} />
                <YAxis domain={[70, 95]} tick={{ fontSize: 11, fill: 'var(--chart-text)' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: 12 }} />
                <Area type="monotone" dataKey="health" stroke="var(--accent)" fill="url(#healthGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      {/* Advanced: Yield Forecast */}
      <section className="section">
        <div className="adv-yield">
          <h2 className="dashboard__section-title">Yield Forecast</h2>
          <div className="adv-yield__grid">
            <div className="adv-yield__stat">
              <span className="adv-yield__label">Current Yield</span>
              <span className="adv-yield__value">3.8 Ton</span>
            </div>
            <div className="adv-yield__stat">
              <span className="adv-yield__label">Potential Yield</span>
              <span className="adv-yield__value adv-yield__value--accent">4.3 Ton</span>
            </div>
            <div className="adv-yield__stat">
              <span className="adv-yield__label">Yield Gap</span>
              <span className="adv-yield__value adv-yield__value--warn">0.5 Ton</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={yieldData}>
              <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'var(--chart-text)' }} axisLine={false} tickLine={false} />
              <YAxis domain={[2, 5]} tick={{ fontSize: 10, fill: 'var(--chart-text)' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: 12 }} />
              <Line type="monotone" dataKey="actual" stroke="var(--accent)" strokeWidth={2} dot={false} name="Actual" />
              <Line type="monotone" dataKey="potential" stroke="var(--text-muted)" strokeWidth={2} strokeDasharray="5 5" dot={false} name="Potential" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="dashboard__fields section">
        <h2 className="dashboard__section-title">{t('dashboard.fieldsOverview')}</h2>
        <div className="dashboard__fields-grid">
          {fields.map((field) => (
            <div key={field.id} className={`dashboard__field-card ${field.status === 'needs-attention' ? 'dashboard__field-card--alert' : ''}`} onClick={() => navigate('/farm')}>
              <div className="dashboard__field-header">
                <span className="dashboard__field-name">{field.name}</span>
                <StatusBadge status={field.status} />
              </div>
              <div className="dashboard__field-crop"><Leaf size={14} /><span>{field.crop}</span></div>
              <div className="dashboard__field-health">
                <div className="dashboard__field-health-bar">
                  <div className="dashboard__field-health-fill" style={{ width: `${field.health}%`, background: field.health >= 80 ? 'var(--accent)' : 'var(--warning)' }} />
                </div>
                <span className="dashboard__field-health-value">{field.health}%</span>
              </div>
              <div className="dashboard__field-meta">
                <span>{field.area} ac</span><span>{field.cropAge} days</span><span>{field.soilMoisture}% moisture</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="dashboard__activity section">
        <h2 className="dashboard__section-title">{t('insights.recentActivity')}</h2>
        <div className="dashboard__activity-list">
          {activityData.map((activity) => (
            <div key={activity.id} className="dashboard__activity-item">
              <div className="dashboard__activity-dot" />
              <div className="dashboard__activity-content">
                <span className="dashboard__activity-action">{activity.action}</span>
                <span className="dashboard__activity-field">{activity.field}</span>
              </div>
              <span className="dashboard__activity-time"><Clock size={12} />{activity.time}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
