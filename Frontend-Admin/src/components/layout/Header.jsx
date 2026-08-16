import React from 'react';
import { Menu, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { NAV_ITEMS } from './Sidebar';

export default function Header({ activeView, onToggleSidebar }) {
  const { admin } = useAuth();
  const currentNav = NAV_ITEMS.find((n) => n.id === activeView) || NAV_ITEMS[0];

  return (
    <header className="app-header">
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <button
          type="button"
          onClick={onToggleSidebar}
          style={{
            display: 'inline-flex',
            padding: 8,
            border: '1px solid var(--line)',
            background: '#ffffff',
            borderRadius: 'var(--radius-md)',
            cursor: 'pointer',
          }}
          className="md:hidden"
          aria-label="Buka Menu"
        >
          <Menu size={20} />
        </button>

        <div className="header-title-area">
          <p>{currentNav.kicker}</p>
          <h1>{currentNav.label}</h1>
        </div>
      </div>

      <div className="header-user-area">
        <div className="user-badge">
          <User size={16} color="var(--brand)" />
          <span>{admin?.email || 'admin@salut.local'}</span>
          <span className={`role-tag ${admin?.role || 'admin'}`}>
            {admin?.role === 'super_admin' ? 'Super Admin' : admin?.role === 'viewer' ? 'Viewer' : 'Admin'}
          </span>
        </div>
      </div>
    </header>
  );
}
