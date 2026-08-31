import './ProgressRing.css';

export default function ProgressRing({
  value = 0,
  size = 80,
  strokeWidth = 6,
  color,
  label,
  showValue = true,
  className = '',
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  const getStrokeColor = () => {
    if (color) return color;
    if (value >= 80) return 'var(--accent)';
    if (value >= 60) return 'var(--warning)';
    return 'var(--danger)';
  };

  return (
    <div className={`progress-ring ${className}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--border)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={getStrokeColor()}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className="progress-ring__circle"
        />
      </svg>
      {showValue && (
        <div className="progress-ring__value">
          <span className="progress-ring__number">{Math.round(value)}</span>
          {label && <span className="progress-ring__label">{label}</span>}
        </div>
      )}
    </div>
  );
}
