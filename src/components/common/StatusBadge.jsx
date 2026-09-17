import './StatusBadge.css';

/* Status labels resolve through the i18n system (common.* keys) —
 * pass t() from useLanguage so badges follow the selected language. */
export default function StatusBadge({ status, size = 'sm', className = '', t }) {
  const labelKey = {
    healthy: 'common.healthy',
    'needs-attention': 'common.needsAttention',
    critical: 'common.critical',
    optimal: 'common.healthy',
    moderate: 'improve.medium',
    low: 'common.important',
    high: 'common.critical',
    completed: 'fertilizer.history',
    upcoming: 'fertilizer.upcoming',
    monitor: 'common.important',
  }[status];

  return (
    <span className={`status-badge status-badge--${status} status-badge--${size} ${className}`}>
      <span className="status-badge__dot" />
      {labelKey && t ? t(labelKey) : status}
    </span>
  );
}
