import './MetricCard.css';

export default function MetricCard({
  label,
  value,
  unit,
  change,
  icon: Icon,
  accent = false,
  className = '',
}) {
  const isPositive = change > 0;
  const showChange = change !== undefined && change !== null;

  return (
    <div className={`metric-card ${accent ? 'metric-card--accent' : ''} ${className}`}>
      <div className="metric-card__top">
        {Icon && (
          <div className="metric-card__icon">
            <Icon size={18} />
          </div>
        )}
        <span className="metric-card__label">{label}</span>
      </div>
      <div className="metric-card__value">
        <span className="metric-card__number">{value}</span>
        {unit && <span className="metric-card__unit">{unit}</span>}
      </div>
      {showChange && (
        <div className={`metric-card__change ${isPositive ? 'metric-card__change--up' : 'metric-card__change--down'}`}>
          <span>{isPositive ? '↗' : '↘'} {Math.abs(change)}%</span>
        </div>
      )}
    </div>
  );
}
