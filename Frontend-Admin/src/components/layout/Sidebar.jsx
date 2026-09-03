import React from 'react';
import { LogOut } from 'lucide-react';
import { NAV_ITEMS } from '../../config/navigation';
import { useAuth } from '../../context/AuthContext';
import { APP_VERSION } from '../../version';
import logoSalut from '../../assets/logo-salut.jpeg';

export default function Sidebar({
  activeView,
  setActiveView,
  isOpen,
  onClose,
  isCollapsed = false,
}) {
  const { logout, can } = useAuth();

  const handleNavClick = (id) => {
    setActiveView(id);
    if (onClose) onClose();
  };

  const visibleNavItems = NAV_ITEMS.filter((item) => !item.permission || can(item.permission));

  return (
    <>
      {isOpen && <div className="sidebar-backdrop" onClick={onClose} />}

      <aside
        className={`app-sidebar ${isOpen ? 'is-open' : ''} ${isCollapsed ? 'is-collapsed' : ''}`}
      >
        <div className="sidebar-header">
          <div className="sidebar-brand-group">
            <img src={logoSalut} alt="Logo SALUT Awwabin" className="sidebar-logo" />
            {!isCollapsed && (
              <div className="sidebar-brand-text">
                <div className="sidebar-brand-title">SALUTKU</div>
                <div className="sidebar-brand-subtitle">
                  Sistem Administrasi &amp; Keuangan
                  <br />
                  SALUT Awwabin
                </div>
              </div>
            )}
          </div>
        </div>

        <nav className="sidebar-nav">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className={`nav-item ${isActive ? 'is-active' : ''} ${isCollapsed ? 'nav-item-collapsed' : ''}`}
                onClick={() => handleNavClick(item.id)}
                title={isCollapsed ? item.label : undefined}
              >
                <Icon size={18} />
                {!isCollapsed && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          {!isCollapsed && <div className="sidebar-app-version">Versi {APP_VERSION}</div>}

          <button
            type="button"
            className={`logout-btn ${isCollapsed ? 'logout-btn-collapsed' : ''}`}
            onClick={logout}
            title={isCollapsed ? 'Keluar Sistem' : undefined}
          >
            <LogOut size={16} />
            {!isCollapsed && <span>Keluar Sistem</span>}
          </button>
        </div>
      </aside>
    </>
  );
}

Sidebar.displayName = 'Sidebar';
