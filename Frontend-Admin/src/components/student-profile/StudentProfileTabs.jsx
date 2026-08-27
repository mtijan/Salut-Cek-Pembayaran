import React from 'react';
import { Building2, Clock, CreditCard, Edit3, User } from 'lucide-react';

const BASE_TABS = [
  { id: 'profile', label: 'Profil Biodata', Icon: User },
  { id: 'stats', label: 'Statistik & Ringkasan', Icon: Building2 },
  { id: 'billing', label: 'Billing & Tagihan', Icon: CreditCard },
  { id: 'history', label: 'Riwayat Transaksi', Icon: Clock },
];

export function StudentProfileTabs({
  activeTab,
  billCount,
  canManageStudents,
  historyCount,
  onChange,
}) {
  const tabs = canManageStudents
    ? [...BASE_TABS, { id: 'edit', label: 'Edit Biodata', Icon: Edit3 }]
    : BASE_TABS;

  return (
    <div className="profile-tabs-nav">
      {tabs.map(({ id, label, Icon }) => {
        const count = id === 'billing' ? billCount : id === 'history' ? historyCount : null;
        return (
          <button
            key={id}
            type="button"
            className={`profile-tab-btn ${activeTab === id ? 'is-active' : ''}`}
            onClick={() => onChange(id)}
          >
            <Icon size={16} />
            <span>
              {label}
              {count !== null ? ` (${count})` : ''}
            </span>
          </button>
        );
      })}
    </div>
  );
}
