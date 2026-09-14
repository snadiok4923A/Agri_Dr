import { NavLink } from 'react-router-dom';
import { useLanguage } from '../../hooks/useLanguage';
import { X } from 'lucide-react';
import { Sprout } from 'lucide-react';
import { navItems, subItems, bottomItems } from './Sidebar';
import { mobileNavItems } from './MobileNavigation';
import './MobileDrawer.css';

/**
 * Left-side slide-out navigation drawer (≤1024px).
 * Shows everything EXCEPT the five items already reachable from the
 * mobile bottom navigation bar (Overview, My Farm, AI Doctor, Improve
 * Yield, Insights) — so no destination is listed twice on mobile.
 */
const bottomNavPaths = new Set(mobileNavItems.map((item) => item.path));

export default function MobileDrawer({ open, onClose }) {
    const { t } = useLanguage();

    const drawerNavItems = navItems.filter((item) => !bottomNavPaths.has(item.path));

    const linkClass = ({ isActive }) =>
        `mobile-drawer__link ${isActive ? 'mobile-drawer__link--active' : ''}`;

    const subLinkClass = ({ isActive }) =>
        `mobile-drawer__link mobile-drawer__link--sub ${isActive ? 'mobile-drawer__link--active' : ''}`;

    return (
        <>
            <div
                className={`mobile-drawer__overlay ${open ? 'mobile-drawer__overlay--open' : ''}`}
                onClick={onClose}
                aria-hidden="true"
            />
            <aside
                className={`mobile-drawer ${open ? 'mobile-drawer--open' : ''}`}
                role="dialog"
                aria-modal="true"
                aria-label="Navigation"
            >
                <div className="mobile-drawer__logo">
                    <Sprout size={22} className="mobile-drawer__logo-icon" />
                    <span className="mobile-drawer__logo-text">Krisiveda</span>
                    <button
                        className="mobile-drawer__close"
                        onClick={onClose}
                        aria-label="Close menu"
                    >
                        <X size={18} />
                    </button>
                </div>

                <nav className="mobile-drawer__nav">
                    <div className="mobile-drawer__section">
                        {drawerNavItems.map((item) => (
                            <NavLink
                                key={item.path}
                                to={item.path}
                                className={linkClass}
                                end={item.path === '/'}
                                onClick={onClose}
                            >
                                <item.icon size={20} />
                                <span>{t(item.labelKey)}</span>
                            </NavLink>
                        ))}
                    </div>

                    <div className="mobile-drawer__divider" />

                    <div className="mobile-drawer__section">
                        <div className="mobile-drawer__section-label">Tools</div>
                        {subItems.map((item) => (
                            <NavLink
                                key={item.path}
                                to={item.path}
                                className={subLinkClass}
                                onClick={onClose}
                            >
                                <item.icon size={18} />
                                <span>{t(item.labelKey)}</span>
                            </NavLink>
                        ))}
                    </div>

                    <div className="mobile-drawer__divider" />

                    <div className="mobile-drawer__section">
                        {bottomItems.map((item) => (
                            <NavLink
                                key={item.path}
                                to={item.path}
                                className={linkClass}
                                onClick={onClose}
                            >
                                <item.icon size={20} />
                                <span>{t(item.labelKey)}</span>
                            </NavLink>
                        ))}
                    </div>
                </nav>
            </aside>
        </>
    );
}
