import React from 'react';
import { CheckCircle2, Clock, FileText, TrendingUp } from 'lucide-react';

const formatRupiah = (value) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);

export default function ReportsStats({ stats, selectedStatus, actions }) {
  return (
    <div className="student-stats-row">
      <div
        className={`student-stat-card ${!selectedStatus ? 'is-active' : ''}`}
        onClick={actions.selectAllStatus}
        style={{ cursor: 'pointer' }}
        title="Klik untuk menampilkan seluruh data"
      >
        <div
          className="student-stat-icon"
          style={{ background: 'var(--brand-surface)', color: 'var(--brand)' }}
        >
          <FileText size={22} />
        </div>
        <div className="student-stat-meta">
          <span className="student-stat-title">Total Tagihan Terbit</span>
          <strong className="student-stat-number">{formatRupiah(stats.totalBilled)}</strong>
        </div>
      </div>

      <div
        className={`student-stat-card ${selectedStatus === 'paid' ? 'is-active' : ''}`}
        onClick={actions.togglePaidStatus}
        style={{ cursor: 'pointer' }}
        title="Klik untuk memfilter status Lunas"
      >
        <div
          className="student-stat-icon"
          style={{ background: 'var(--success-bg)', color: 'var(--success)' }}
        >
          <CheckCircle2 size={22} />
        </div>
        <div className="student-stat-meta">
          <span className="student-stat-title">Total Terbayar (Lunas)</span>
          <strong className="student-stat-number" style={{ color: 'var(--success)' }}>
            {formatRupiah(stats.totalPaid)}
          </strong>
        </div>
      </div>

      <div
        className={`student-stat-card ${selectedStatus === 'partial' || selectedStatus === 'unpaid' ? 'is-active' : ''}`}
        onClick={actions.cycleOutstandingStatus}
        style={{ cursor: 'pointer' }}
        title="Klik untuk beralih filter Belum Lunas / Sebagian"
      >
        <div
          className="student-stat-icon"
          style={{ background: 'var(--warning-bg)', color: 'var(--warning)' }}
        >
          <Clock size={22} />
        </div>
        <div className="student-stat-meta">
          <span className="student-stat-title">Sisa Piutang / Tunggakan</span>
          <strong
            className="student-stat-number"
            style={{ color: stats.totalOutstanding > 0 ? 'var(--danger)' : 'var(--success)' }}
          >
            {formatRupiah(stats.totalOutstanding)}
          </strong>
        </div>
      </div>

      <div className="student-stat-card">
        <div
          className="student-stat-icon"
          style={{ background: 'var(--info-bg)', color: 'var(--info)' }}
        >
          <TrendingUp size={22} />
        </div>
        <div className="student-stat-meta">
          <span className="student-stat-title">Tingkat Realisasi</span>
          <strong className="student-stat-number" style={{ color: 'var(--info)' }}>
            {stats.percentagePaid}%
          </strong>
        </div>
      </div>
    </div>
  );
}
