import React from 'react';
import {
  LayoutDashboard,
  Users,
  Receipt,
  FileSpreadsheet,
  UploadCloud,
  Layers,
  Database,
  LogOut,
  ChevronLeft,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { APP_VERSION } from '../../version';

export const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', kicker: 'Ringkasan Sistem', icon: LayoutDashboard },
  { id: 'students', label: 'Data Mahasiswa', kicker: 'Data Akademik', icon: Users },
  { id: 'bills', label: 'Tagihan Mahasiswa', kicker: 'Manajemen Keuangan', icon: Receipt },
  { id: 'reports', label: 'Rekap Keuangan', kicker: 'Laporan & Evaluasi', icon: FileSpreadsheet },
  { id: 'files', label: 'Data File Import', kicker: 'Riwayat Import', icon: Layers },
  { id: 'upload', label: 'Upload File', kicker: 'Upload Excel', icon: UploadCloud },
  { id: 'master', label: 'Master Data', kicker: 'Master Data Akademik', icon: Database },
];

export default function Sidebar({
  activeView,
  setActiveView,
  isOpen,
  onClose,
  isCollapsed = false,
  onToggleCollapse,
}) {
  const { logout } = useAuth();

  const handleNavClick = (id) => {
    setActiveView(id);
    if (onClose) onClose();
  };

  return (
    <>
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            zIndex: 35,
          }}
          onClick={onClose}
        />
      )}

      <aside className={`app-sidebar ${isOpen ? 'is-open' : ''} ${isCollapsed ? 'is-collapsed' : ''}`}>
        {/* Floating edge toggle on the right border line */}
        {onToggleCollapse && (
          <button
            type="button"
            className="sidebar-edge-toggle-btn"
            onClick={onToggleCollapse}
            title={isCollapsed ? 'Perbesar Menu Sidebar' : 'Kecilkan Menu Sidebar'}
            aria-label={isCollapsed ? 'Perbesar Menu Sidebar' : 'Kecilkan Menu Sidebar'}
          >
            {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        )}

        <div className="sidebar-header">
          <div className="sidebar-brand-group">
            <img src="/Logo%20Salut.jpeg" alt="Logo SALUT Awwabin" className="sidebar-logo" />
            {!isCollapsed && (
              <div className="sidebar-brand-text">
                <div className="sidebar-brand-title">SALUT Awwabin</div>
                <div className="sidebar-brand-subtitle">Sistem Akademik & Tagihan</div>
              </div>
            )}
          </div>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map((item) => {
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
          {onToggleCollapse && (
            <button
              type="button"
              className={`sidebar-footer-toggle-btn ${isCollapsed ? 'footer-toggle-collapsed' : ''}`}
              onClick={onToggleCollapse}
              title={isCollapsed ? 'Perbesar Menu Sidebar' : 'Kecilkan Menu Sidebar'}
            >
              {isCollapsed ? (
                <PanelLeftOpen size={16} />
              ) : (
                <>
                  <PanelLeftClose size={16} />
                  <span>Kecilkan Menu</span>
                </>
              )}
            </button>
          )}

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
