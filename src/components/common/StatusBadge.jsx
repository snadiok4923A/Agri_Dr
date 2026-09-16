import './StatusBadge.css';

export default function StatusBadge({ status, size = 'sm', className = '' }) {
  const labels = {
    healthy: 'Healthy',
    'needs-attention': 'Needs Attention',
    critical: 'Critical',
    optimal: 'Optimal',
    moderate: 'Moderate',
    low: 'Low',
    high: 'High',
    completed: 'Completed',
    upcoming: 'Upcoming',
    monitor: 'Monitor',
  };

  return (
    <span className={`status-badge status-badge--${status} status-badge--${size} ${className}`}>
      <span className="status-badge__dot" />
      {labels[status] || status}
    </span>
  );
}
