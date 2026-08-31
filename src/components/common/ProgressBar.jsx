import './ProgressBar.css';

export default function ProgressBar({
  value = 0,
  max = 100,
  height = 8,
  color,
  label,
  showValue = true,
  className = '',
}) {
  const percentage = Math.min((value / max) * 100, 100);

  const getColor = () => {
    if (color) return color;
    if (percentage >= 80) return 'var(--accent)';
    if (percentage >= 60) return 'var(--warning)';
    return 'var(--danger)';
  };

  return (
    <div className={`progress-bar ${className}`}>
      {(label || showValue) && (
        <div className="progress-bar__header">
          {label && <span className="progress-bar__label">{label}</span>}
          {showValue && <span className="progress-bar__value">{Math.round(percentage)}%</span>}
        </div>
      )}
      <div className="progress-bar__track" style={{ height }}>
        <div
          className="progress-bar__fill"
          style={{ width: `${percentage}%`, background: getColor() }}
        />
      </div>
    </div>
  );
}
