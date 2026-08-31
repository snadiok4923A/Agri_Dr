import { ChevronRight } from 'lucide-react';
import './SectionHeader.css';

export default function SectionHeader({ title, subtitle, action, actionLabel, icon: Icon }) {
  return (
    <div className="section-header">
      <div className="section-header__left">
        {Icon && (
          <div className="section-header__icon">
            <Icon size={18} />
          </div>
        )}
        <div>
          <h2 className="section-header__title">{title}</h2>
          {subtitle && <p className="section-header__subtitle">{subtitle}</p>}
        </div>
      </div>
      {action && (
        <button className="section-header__action" onClick={action}>
          {actionLabel}
          <ChevronRight size={14} />
        </button>
      )}
    </div>
  );
}
