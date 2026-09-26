import { NavLink } from 'react-router-dom';
import { useLanguage } from '../../hooks/useLanguage';
import { pageTransitionState } from './MobilePageTransition';
import { Home, Tractor, Stethoscope, TrendingUp, BarChart3 } from 'lucide-react';
import './MobileNavigation.css';

// Exported so MobileDrawer can exclude these paths from the slide-out menu
export const mobileNavItems = [
  { path: '/', icon: Home, labelKey: 'nav.overview' },
  { path: '/farm', icon: Tractor, labelKey: 'nav.myFarm' },
  { path: '/ai-doctor', icon: Stethoscope, labelKey: 'nav.aiDoctor' },
  { path: '/improve', icon: TrendingUp, labelKey: 'nav.improve' },
  { path: '/insights', icon: BarChart3, labelKey: 'nav.insights' },
];

export default function MobileNavigation() {
  const { t } = useLanguage();

  const handleClick = (e) => {
    /* Rapid-tap guard (spec §12, strategy A): while a transition is in
       flight, hold the tap so transitions can never stack. React Router
       only navigates when this handler lets the event proceed. */
    if (pageTransitionState.active) {
      e.preventDefault();
    }
  };

  return (
    <nav className="mobile-nav">
      {mobileNavItems.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          onClick={handleClick}
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
