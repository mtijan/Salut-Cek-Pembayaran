import React from 'react';
import { PanelLeftClose, PanelLeftOpen, User } from 'lucide-react';
import { NAV_ITEMS } from '../../config/navigation';
import { useAuth } from '../../context/AuthContext';

const VIEW_TITLES = {
  'student-profile': { label: 'Profil 360 Mahasiswa', kicker: 'Data Akademik & Biodata' },
  'bill-payment': { label: 'Pencatatan Pembayaran', kicker: 'Manajemen Keuangan & Kasir' },
  'bill-edit': { label: 'Kelola Tagihan Mahasiswa', kicker: 'Manajemen Data Finansial' },
};

export default function Header({
  activeView,
  onToggleSidebar,
  isCollapsed = false,
  onToggleCollapse,
}) {
  const { admin } = useAuth();
  const currentNav =
    VIEW_TITLES[activeView] || NAV_ITEMS.find((n) => n.id === activeView) || NAV_ITEMS[0];

  const handleToggle = () => {
    if (window.innerWidth <= 768) {
      if (onToggleSidebar) onToggleSidebar();
    } else {
      if (onToggleCollapse) onToggleCollapse();
    }
  };

  return (
    <header className="app-header">
      <div className="header-left-group">
        <button
          type="button"
          onClick={handleToggle}
          className="header-sidebar-toggle"
          aria-label={isCollapsed ? 'Perbesar Menu Sidebar' : 'Kecilkan Menu Sidebar'}
          title={
            isCollapsed ? 'Perbesar Menu Sidebar (Expand)' : 'Kecilkan Menu Sidebar (Collapse)'
          }
        >
          {isCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>

        <div className="header-title-area">
          <p>{currentNav.kicker}</p>
          <h1>{currentNav.label}</h1>
        </div>
      </div>

      <div className="header-user-area">
        <div className="user-badge">
          <User size={16} className="text-brand" />
          <span>{admin?.email || 'admin@salut.local'}</span>
          <span className={`role-tag ${admin?.role || 'admin'}`}>
            {admin?.role === 'super_admin'
              ? 'Super Admin'
              : admin?.role === 'viewer'
                ? 'Viewer'
                : 'Admin'}
          </span>
        </div>
      </div>
    </header>
  );
}

Header.displayName = 'Header';
