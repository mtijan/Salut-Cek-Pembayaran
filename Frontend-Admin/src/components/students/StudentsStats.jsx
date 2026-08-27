import React from 'react';
import { CreditCard, UserCheck, Users, UserX } from 'lucide-react';

export default function StudentsStats({ stats }) {
  const cards = [
    ['Total Mahasiswa', stats.total, Users, 'var(--brand-surface)', 'var(--brand)'],
    ['Mahasiswa Aktif', stats.active, UserCheck, 'var(--success-bg)', 'var(--success)'],
    ['Cuti / Non-Aktif', stats.nonActive, UserX, 'var(--warning-bg)', 'var(--warning)'],
    ['Memiliki Tagihan', stats.withBills, CreditCard, 'var(--info-bg)', 'var(--info)'],
  ];
  return (
    <div className="student-stats-row">
      {cards.map(([label, value, Icon, background, color]) => (
        <div className="student-stat-card" key={label}>
          <div className="student-stat-icon" style={{ background, color }}>
            <Icon size={22} />
          </div>
          <div className="student-stat-meta">
            <span className="student-stat-title">{label}</span>
            <strong
              className="student-stat-number"
              style={label === 'Total Mahasiswa' ? undefined : { color }}
            >
              {value}
            </strong>
          </div>
        </div>
      ))}
    </div>
  );
}
