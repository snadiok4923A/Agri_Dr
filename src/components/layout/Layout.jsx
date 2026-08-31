import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import MobileNavigation from './MobileNavigation';
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
      {mobileMenuOpen && (
        <div className="layout__overlay" onClick={() => setMobileMenuOpen(false)} />
      )}
    </div>
  );
}
