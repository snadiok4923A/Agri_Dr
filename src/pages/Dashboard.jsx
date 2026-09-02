import { useLanguage } from '../hooks/useLanguage';
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
  const navigate = useNavigate();

  const criticalActions = recommendations.filter(r => r.category === 'critical' || r.category === 'important').slice(0, 4);

  const healthyArea = fields.filter(f => f.status === 'healthy').reduce((sum, f) => sum + f.area, 0);
  const totalArea = farmData.totalLand;
  const totalYield = fields.reduce((sum, f) => sum + (f.cropAge / (f.variety === 'Basmati' ? 130 : f.variety === 'Samba Mahsuri' ? 115 : 120) * (f.variety === 'Basmati' ? 4.1 : f.variety === 'Samba Mahsuri' ? 3.5 : f.variety === 'Swarna' ? 3.2 : 3.8)), 0).toFixed(1);
  const potentialYield = fields.reduce((sum, f) => sum + (f.variety === 'Basmati' ? 4.6 : f.variety === 'Samba Mahsuri' ? 4.1 : f.variety === 'Swarna' ? 4.0 : 4.3), 0).toFixed(1);
  const warnings = fields.filter(f => f.status === 'needs-attention' || f.soilMoisture < 40);

  return (
    <div className="page-container dashboard adv-dashboard">
      {/* Greeting */}
      <div className="adv-greeting">
        <h1 className="adv-greeting__text">{getGreeting(t)}</h1>
      </div>

      {/* Row 1: Farm Area + Expected Yield + Weather */}
      <div className="adv-top-grid adv-top-grid--3">
        {/* Farm Area Donut */}
        {(() => {
          const areaDonutData = [
            { name: 'Healthy', value: healthyArea },
            { name: 'Remaining', value: totalArea - healthyArea },
          ];
          return (
            <div className="adv-card adv-donut-card">
              <span className="adv-card__label adv-card__label--center">Farm Area</span>
              <div className="adv-donut-card__chart">
                <ResponsiveContainer width="100%" height={150}>
                  <PieChart>
                    <Pie
                      data={areaDonutData}
                      cx="50%" cy="50%"
                      innerRadius={44} outerRadius={60}
                      startAngle={90} endAngle={-270}
                      dataKey="value"
                      stroke="none"
                    >
                      <Cell fill="#4ade80" />
                      <Cell fill="var(--border)" />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="adv-donut-card__center">
                  <span className="adv-donut-card__value">{totalArea}</span>
                  <span className="adv-donut-card__unit">ac</span>
                </div>
              </div>
              <span className="adv-donut-card__sub adv-donut-card__sub--green"><span className="adv-donut-card__sub-value">{healthyArea}</span> ac healthy</span>
            </div>
          );
        })()}

        {/* Expected Yield Donut */}
        {(() => {
          const yieldPct = Math.round((parseFloat(totalYield) / parseFloat(potentialYield)) * 100);
          const yieldDonutData = [
            { name: 'Expected', value: yieldPct },
            { name: 'Remaining', value: 100 - yieldPct },
          ];
          return (
            <div className="adv-card adv-donut-card">
              <span className="adv-card__label adv-card__label--center">Expected Yield</span>
              <div className="adv-donut-card__chart">
                <ResponsiveContainer width="100%" height={150}>
                  <PieChart>
                    <Pie
                      data={yieldDonutData}
                      cx="50%" cy="50%"
                      innerRadius={44} outerRadius={60}
                      startAngle={90} endAngle={-270}
                      dataKey="value"
                      stroke="none"
                    >
                      <Cell fill="var(--accent)" />
                      <Cell fill="var(--border)" />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="adv-donut-card__center">
                  <span className="adv-donut-card__value">{totalYield}</span>
                  <span className="adv-donut-card__unit">Ton</span>
                </div>
              </div>
              <span className="adv-donut-card__sub adv-donut-card__sub--accent">Potential {potentialYield} Ton</span>
            </div>
          );
        })()}

        {/* Compact Weather */}
        <div className="adv-card adv-weather-compact">
          <div className="adv-weather-compact__main">
            <CloudSun size={24} className="adv-weather-compact__icon" />
            <div>
              <span className="adv-weather-compact__temp">{weatherData.current.temperature}°</span>
              <span className="adv-weather-compact__cond">{weatherData.current.condition}</span>
            </div>
          </div>
          <div className="adv-weather-compact__row">
            <span className="adv-weather-compact__chip"><Droplets size={11} /> {weatherData.current.humidity}%</span>
            <span className="adv-weather-compact__chip"><Wind size={11} /> {weatherData.current.wind} km/h</span>
          </div>
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

      {/* Row 5: Activity */}
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
