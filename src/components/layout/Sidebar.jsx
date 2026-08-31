import { NavLink, useLocation } from 'react-router-dom';
import { useLanguage } from '../../hooks/useLanguage';
import {
  LayoutDashboard, Tractor, Leaf, HeartPulse, TrendingUp,
  BarChart3, Stethoscope, CloudSun, FlaskConical, Droplets,
  Bug, Beaker, Wallet, Store, Settings, User, ChevronLeft, ChevronRight, Sprout,
} from 'lucide-react';
import { useState } from 'react';
import './Sidebar.css';

const navItems = [
  { path: '/', icon: LayoutDashboard, labelKey: 'nav.overview' },
  { path: '/farm', icon: Tractor, labelKey: 'nav.myFarm' },
  { path: '/crops', icon: Leaf, labelKey: 'nav.crops' },
  { path: '/health', icon: HeartPulse, labelKey: 'nav.health' },
  { path: '/improve', icon: TrendingUp, labelKey: 'nav.improve' },
  { path: '/insights', icon: BarChart3, labelKey: 'nav.insights' },
  { path: '/ai-doctor', icon: Stethoscope, labelKey: 'nav.aiDoctor' },
];

const subItems = [
  { path: '/weather', icon: CloudSun, labelKey: 'nav.weather' },
  { path: '/soil', icon: FlaskConical, labelKey: 'nav.soil' },
  { path: '/irrigation', icon: Droplets, labelKey: 'nav.irrigation' },
  { path: '/disease', icon: Bug, labelKey: 'nav.disease' },
  { path: '/fertilizer', icon: Beaker, labelKey: 'nav.fertilizer' },
  { path: '/finance', icon: Wallet, labelKey: 'nav.finance' },
  { path: '/market', icon: Store, labelKey: 'nav.market' },
];

const bottomItems = [
  { path: '/settings', icon: Settings, labelKey: 'nav.settings' },
];

export default function Sidebar() {
  const { t } = useLanguage();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside className={`sidebar ${collapsed ? 'sidebar--collapsed' : ''}`}>
      <div className="sidebar__logo">
        <Sprout size={24} className="sidebar__logo-icon" />
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
          {!collapsed && <div className="sidebar__section-label">Tools</div>}
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

        <div className="sidebar__user">
          <div className="sidebar__avatar">
            <User size={18} />
          </div>
          {!collapsed && (
            <div className="sidebar__user-info">
              <span className="sidebar__user-name">Rajesh Kumar</span>
              <span className="sidebar__user-role">Farmer</span>
            </div>
          )}
        </div>
      </div>

      <button
        className="sidebar__toggle"
        onClick={() => setCollapsed(!collapsed)}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>
    </aside>
  );
}
