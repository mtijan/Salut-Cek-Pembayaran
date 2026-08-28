import React from 'react';
import { CreditCard, UserCheck, Users, UserX } from 'lucide-react';

export default function StudentsStats({ stats }) {
  const cards = [
    ['Total Mahasiswa', stats.total, Users, 'stat-icon-brand', 'text-ink'],
    ['Mahasiswa Aktif', stats.active, UserCheck, 'stat-icon-success', 'text-success'],
    ['Cuti / Non-Aktif', stats.nonActive, UserX, 'stat-icon-warning', 'text-warning'],
    ['Memiliki Tagihan', stats.withBills, CreditCard, 'stat-icon-info', 'text-info'],
  ];
  return (
    <div className="student-stats-row">
      {cards.map(([label, value, Icon, iconClass, textClass]) => (
        <div className="student-stat-card" key={label}>
          <div className={`student-stat-icon ${iconClass}`}>
            <Icon size={22} />
          </div>
          <div className="student-stat-meta">
            <span className="student-stat-title">{label}</span>
            <strong className={`student-stat-number ${textClass}`}>{value}</strong>
          </div>
        </div>
      ))}
    </div>
  );
}

StudentsStats.displayName = 'StudentsStats';
