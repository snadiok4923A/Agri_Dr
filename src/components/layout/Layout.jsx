import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import MobileNavigation from './MobileNavigation';
import MobileDrawer from './MobileDrawer';
import MobilePageTransition from './MobilePageTransition';
import { registerOverlay } from '../../voice/overlayBus';
import { VOICE_OPEN_SIDEBAR_EVENT } from '../../hooks/useVoiceMode';
import './Layout.css';

export default function Layout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  /* Voice integration (§13/§19): "sidebar kholo" opens the drawer, "close"
     closes it via React state — exactly like tapping the UI. */
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

  /* PERF: these handlers are created ONCE. The header is React.memo'd and
     takes both of them as props — inline arrows would be new objects on
     every Layout render (i.e. every drawer toggle), which would punch
     straight through the memo and re-render the whole header for nothing. */
  const closeMenu = useCallback(() => setMobileMenuOpen(false), []);
  const toggleMenu = useCallback(() => setMobileMenuOpen((open) => !open), []);
  const headerProps = useMemo(
    () => ({ onMenuToggle: toggleMenu }),
    [toggleMenu]
  );

  return (
    <div className="layout">
      <Sidebar />
      <div className="layout__main">
        <Header {...headerProps} />
        <main className="layout__content">
          {/* Horizontal page transitions (mobile bottom-nav routes only;
              >1024px renders children untouched). NOT keyed here —
              AnimatePresence inside keys by pathname and owns the
              enter/exit lifecycle, which is what keeps rapid taps safe. */}
          <MobilePageTransition>
          {/* Lazy route chunks suspend HERE: the sidebar, header and mobile
              nav stay mounted while a page chunk loads, so navigating never
              flashes an empty shell or remounts the app frame (§22). The
              fallback is intentionally empty — chunks resolve in a frame or
              two and the previous page area simply stays blank instead of
              showing a spinner that would flicker. */}
          <Suspense fallback={null}>
            <Outlet />
          </Suspense>
          </MobilePageTransition>
        </main>
      </div>
      <MobileNavigation />
      <MobileDrawer open={mobileMenuOpen} onClose={closeMenu} />
    </div>
  );
}
