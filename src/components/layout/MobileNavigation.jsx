import { NavLink, useLocation } from 'react-router-dom';
import { useLanguage } from '../../hooks/useLanguage';
import { pageTransitionState } from './MobilePageTransition';
import { resolveSectionForPath } from '../../lib/activeSection';
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
  /* Active state is DERIVED from the current route (single source of
     truth, spec §1): the URL decides the green item, never click order
     or stored state. NavLink's per-link isActive is deliberately NOT
     used for the highlight — it can't match nested/detail pages
     (/crops/parcel-1, /disease, /market …), which is exactly why the
     active state used to disappear or land on the wrong tab. On such
     pages the parent SECTION stays active (spec §7). */
  const location = useLocation();
  const activeSection = resolveSectionForPath(location.pathname);

  const handleClick = (e, targetPath) => {
    /* Rapid-tap guard (spec §12, last-tap-wins): while a transition is in
       flight, a tap is HELD (prevented) and remembered — MobilePageTransition
       navigates to the LAST queued tap the moment the lock releases. The
       active item never doubles or goes stale: the URL is the only truth. */
    if (pageTransitionState.active) {
      e.preventDefault();
      pageTransitionState.pending = targetPath;
    }
  };

  return (
    <nav className="mobile-nav">
      {mobileNavItems.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          onClick={(e) => handleClick(e, item.path)}
          className={() =>
            `mobile-nav__item ${
              activeSection === item.path ? 'mobile-nav__item--active' : ''
            }`
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
