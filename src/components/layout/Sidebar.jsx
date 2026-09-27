import { NavLink, useLocation } from 'react-router-dom';
import { useLanguage } from '../../hooks/useLanguage';
import { useAuth } from '../../hooks/useAuth';
import {
  LayoutDashboard, Tractor, Leaf, TrendingUp,
  BarChart3, Stethoscope,
  Bug, Beaker, Wallet, Store, Settings, User, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { useState } from 'react';
import './Sidebar.css';

// Shared with MobileDrawer so both navigations always stay in sync
export const navItems = [
  { path: '/', icon: LayoutDashboard, labelKey: 'nav.overview' },
  { path: '/farm', icon: Tractor, labelKey: 'nav.myFarm' },
  { path: '/crops', icon: Leaf, labelKey: 'nav.crops' },
  { path: '/improve', icon: TrendingUp, labelKey: 'nav.improve' },
  { path: '/insights', icon: BarChart3, labelKey: 'nav.insights' },
  { path: '/ai-doctor', icon: Stethoscope, labelKey: 'nav.aiDoctor' },
];

export const subItems = [
  { path: '/disease', icon: Bug, labelKey: 'nav.disease' },
  { path: '/fertilizer', icon: Beaker, labelKey: 'nav.fertilizer' },
  { path: '/finance', icon: Wallet, labelKey: 'nav.finance' },
  { path: '/market', icon: Store, labelKey: 'nav.market' },
];

export const bottomItems = [
  { path: '/settings', icon: Settings, labelKey: 'nav.settings' },
];

export default function Sidebar() {
  const { t } = useLanguage();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  // Identity block is driven by the REAL Supabase session only: a user
  // block appears ONLY when authenticated. Skipped/logged-out visitors
  // get a plain sign-in link — never a fabricated profile (spec §4/§6).
  const { user } = useAuth();
  const storedName = localStorage.getItem('krisiveda.profileName') || '';
  const storedRole = localStorage.getItem('krisiveda.profileRole') || '';
  // Only a real account's information is shown: profile name, else the
  // real account's email prefix. No placeholder identity ever appears.
  const displayName =
    user?.name || storedName || (user?.email ? user.email.split('@')[0] : '');
  const displayRole =
    storedRole === 'Business Man'
      ? t('common.profile.businessMan')
      : t('common.profile.farmer');

  return (
    <aside className={`sidebar ${collapsed ? 'sidebar--collapsed' : ''}`}>
      <div className="sidebar__logo">
        <img
          src={`${import.meta.env.BASE_URL}bit.png`}
          alt="Krisiveda"
          className="sidebar__logo-icon"
        />
        {!collapsed && <span className="sidebar__logo-text">Krisiveda</span>}
      </div>

      <nav className="sidebar__nav">
        <div className="sidebar__section">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `sidebar__link ${isActive ? 'sidebar__link--active' : ''}`
              }
              end={item.path === '/'}
              title={collapsed ? t(item.labelKey) : undefined}
            >
              <item.icon size={20} />
              {!collapsed && <span>{t(item.labelKey)}</span>}
            </NavLink>
          ))}
        </div>

        <div className="sidebar__divider" />

        <div className="sidebar__section">
          {!collapsed && <div className="sidebar__section-label">{t('common.tools')}</div>}
          {subItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `sidebar__link sidebar__link--sub ${isActive ? 'sidebar__link--active' : ''}`
              }
              title={collapsed ? t(item.labelKey) : undefined}
            >
              <item.icon size={18} />
              {!collapsed && <span>{t(item.labelKey)}</span>}
            </NavLink>
          ))}
        </div>
      </nav>

      <div className="sidebar__bottom">
        <div className="sidebar__divider" />
        {bottomItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `sidebar__link ${isActive ? 'sidebar__link--active' : ''}`
            }
            title={collapsed ? t(item.labelKey) : undefined}
          >
            <item.icon size={20} />
            {!collapsed && <span>{t(item.labelKey)}</span>}
          </NavLink>
        ))}

        {user ? (
          <div className="sidebar__user">
            <div className="sidebar__avatar">
              <User size={18} />
            </div>
            {!collapsed && (
              <div className="sidebar__user-info">
                <span className="sidebar__user-name">{displayName}</span>
                <span className="sidebar__user-role">{displayRole}</span>
              </div>
            )}
          </div>
        ) : (
          /* LOGGED OUT (incl. "Skip for now") — sign-in link instead of a
             profile; there is no account to show. */
          <NavLink to="/login" className="sidebar__user sidebar__user--signin">
            <div className="sidebar__avatar">
              <User size={18} />
            </div>
            {!collapsed && (
              <div className="sidebar__user-info">
                <span className="sidebar__user-name">{t('nav.login')}</span>
              </div>
            )}
          </NavLink>
        )}
      </div>

      <button
        className="sidebar__toggle"
        onClick={() => setCollapsed(!collapsed)}
        aria-label={collapsed ? t('common.expandSidebar') : t('common.collapseSidebar')}
      >
        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>
    </aside>
  );
}
