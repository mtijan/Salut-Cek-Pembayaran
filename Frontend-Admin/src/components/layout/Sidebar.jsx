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
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', kicker: 'Ringkasan Sistem', icon: LayoutDashboard },
  { id: 'students', label: 'Data Mahasiswa', kicker: 'Data Akademik', icon: Users },
  { id: 'bills', label: 'Tagihan Mahasiswa', kicker: 'Manajemen Keuangan', icon: Receipt },
  { id: 'reports', label: 'Rekap Keuangan', kicker: 'Laporan & Evaluasi', icon: FileSpreadsheet },
  { id: 'files', label: 'Data File Import', kicker: 'Riwayat Import', icon: Layers },
  { id: 'upload', label: 'Upload File', kicker: 'Upload Excel', icon: UploadCloud },
  { id: 'master', label: 'Master Data', kicker: 'Master Data Akademik', icon: Database },
];

export default function Sidebar({ activeView, setActiveView, isOpen, onClose }) {
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
            background: 'rgba(0,0,0,0.4)',
            zIndex: 35,
          }}
          onClick={onClose}
        />
      )}

      <aside className={`app-sidebar ${isOpen ? 'is-open' : ''}`}>
        <div className="sidebar-header">
          <img src="/Logo%20Salut.jpeg" alt="Logo SALUT Awwabin" className="sidebar-logo" />
          <div>
            <div className="sidebar-brand-title">SALUT Awwabin</div>
            <div className="sidebar-brand-subtitle">Sistem Akademik & Tagihan</div>
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
                className={`nav-item ${isActive ? 'is-active' : ''}`}
                onClick={() => handleNavClick(item.id)}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <button type="button" className="logout-btn" onClick={logout}>
            <LogOut size={16} />
            <span>Keluar Sistem</span>
          </button>
        </div>
      </aside>
    </>
  );
}
