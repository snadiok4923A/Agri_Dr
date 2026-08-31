import { NavLink } from 'react-router-dom';
import { useLanguage } from '../../hooks/useLanguage';
import { Home, Tractor, Stethoscope, BarChart3, MoreHorizontal } from 'lucide-react';
import './MobileNavigation.css';

const mobileNavItems = [
  { path: '/', icon: Home, labelKey: 'nav.overview' },
  { path: '/farm', icon: Tractor, labelKey: 'nav.myFarm' },
  { path: '/ai-doctor', icon: Stethoscope, labelKey: 'nav.aiDoctor' },
  { path: '/insights', icon: BarChart3, labelKey: 'nav.insights' },
  { path: '/settings', icon: MoreHorizontal, labelKey: 'nav.settings' },
];

export default function MobileNavigation() {
  const { t } = useLanguage();

  return (
    <nav className="mobile-nav">
      {mobileNavItems.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          className={({ isActive }) =>
            `mobile-nav__item ${isActive ? 'mobile-nav__item--active' : ''}`
          }
          end={item.path === '/'}
        >
          <item.icon size={20} />
          <span>{t(item.labelKey)}</span>
        </NavLink>
      ))}
    </nav>
  );
}
