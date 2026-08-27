import React from 'react';
import { CheckCircle2, Clock, CreditCard, FileText } from 'lucide-react';
import { formatRupiah } from '../../utils/currency';

export default function BillsStats({ stats, selectedStatus, hasActiveFilter, actions }) {
  return (
    <div className="student-stats-row">
      <div
        className={`student-stat-card ${!selectedStatus ? 'is-active' : ''}`}
        onClick={actions.selectAllStatus}
        style={{ cursor: 'pointer' }}
        title="Klik untuk menampilkan seluruh tagihan"
      >
        <div
          className="student-stat-icon"
          style={{ background: 'var(--brand-surface)', color: 'var(--brand)' }}
        >
          <FileText size={22} />
        </div>
        <div className="student-stat-meta">
          <span className="student-stat-title">Total Tagihan</span>
          <strong className="student-stat-number">
            {stats.totalCount.toLocaleString('id-ID')}
          </strong>
          <span style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>
            {stats.studentCount > 0
              ? `Dari ${stats.studentCount.toLocaleString('id-ID')} mahasiswa`
              : 'Tidak ada data'}
          </span>
        </div>
      </div>
      <div
        className={`student-stat-card ${selectedStatus === 'paid' ? 'is-active' : ''}`}
        onClick={actions.togglePaidStatus}
        style={{ cursor: 'pointer' }}
        title="Klik untuk filter tagihan lunas"
      >
        <div
          className="student-stat-icon"
          style={{ background: 'var(--success-bg)', color: 'var(--success)' }}
        >
          <CheckCircle2 size={22} />
        </div>
        <div className="student-stat-meta">
          <span className="student-stat-title">Total Terbayar</span>
          <strong className="student-stat-number" style={{ color: 'var(--success)' }}>
            {formatRupiah(stats.totalPaid)}
          </strong>
          <span style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>
            {stats.paidCount.toLocaleString('id-ID')} tagihan lunas
          </span>
        </div>
      </div>
      <div
        className={`student-stat-card ${selectedStatus === 'partial' || selectedStatus === 'unpaid' ? 'is-active' : ''}`}
        onClick={actions.cycleOutstandingStatus}
        style={{ cursor: 'pointer' }}
        title="Klik untuk beralih filter Cicilan / Belum Lunas"
      >
        <div
          className="student-stat-icon"
          style={{ background: 'var(--warning-bg)', color: 'var(--warning)' }}
        >
          <Clock size={22} />
        </div>
        <div className="student-stat-meta">
          <span className="student-stat-title">Sisa Tunggakan</span>
          <strong
            className="student-stat-number"
            style={{ color: stats.totalRemaining > 0 ? 'var(--warning)' : 'var(--success)' }}
          >
            {formatRupiah(stats.totalRemaining)}
          </strong>
          <span style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>
            {(stats.unpaidCount + stats.partialCount).toLocaleString('id-ID')} tagihan belum lunas
          </span>
        </div>
      </div>
      <div className="student-stat-card">
        <div
          className="student-stat-icon"
          style={{ background: 'var(--info-bg)', color: 'var(--info)' }}
        >
          <CreditCard size={22} />
        </div>
        <div className="student-stat-meta">
          <span className="student-stat-title">Total Nominal Piutang</span>
          <strong className="student-stat-number" style={{ color: 'var(--info)' }}>
            {formatRupiah(stats.totalNominal)}
          </strong>
          <span style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>
            {hasActiveFilter ? 'Akumulasi sesuai filter aktif' : 'Akumulasi seluruh tagihan'}
          </span>
        </div>
      </div>
    </div>
  );
}
