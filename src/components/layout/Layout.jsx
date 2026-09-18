import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import MobileNavigation from './MobileNavigation';
import MobileDrawer from './MobileDrawer';
import { registerOverlay } from '../../voice/overlayBus';
import { VOICE_OPEN_SIDEBAR_EVENT } from '../../hooks/useVoiceMode';
import './Layout.css';

export default function Layout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Voice integration (§13/§19): "sidebar kholo" opens the drawer, "close"
  // closes it via React state — exactly like tapping the UI.
  useEffect(() => {
    const openSidebar = () => setMobileMenuOpen(true);
    window.addEventListener(VOICE_OPEN_SIDEBAR_EVENT, openSidebar);
    const unregister = registerOverlay({
      isOpen: () => document.querySelector('.mobile-drawer--open') !== null,
      close: () => setMobileMenuOpen(false),
    });
    return () => {
      window.removeEventListener(VOICE_OPEN_SIDEBAR_EVENT, openSidebar);
      unregister();
    };
  }, []);

  return (
    <div className="layout">
      <Sidebar />
      <div className="layout__main">
        <Header onMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)} />
        <main className="layout__content">
          <Outlet />
        </main>
      </div>
      <MobileNavigation />
      <MobileDrawer
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
      />
    </div>
  );
}
