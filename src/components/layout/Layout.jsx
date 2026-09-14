import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import MobileNavigation from './MobileNavigation';
import MobileDrawer from './MobileDrawer';
import './Layout.css';

export default function Layout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
