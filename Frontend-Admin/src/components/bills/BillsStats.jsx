import React from 'react';
import { CheckCircle2, Clock, CreditCard, FileText } from 'lucide-react';
import { formatRupiah } from '../../utils/currency';

export default function BillsStats({ stats, selectedStatus, hasActiveFilter, actions }) {
  return (
    <div className="student-stats-row">
      <div
        className={`student-stat-card clickable-card ${!selectedStatus ? 'is-active' : ''}`}
        onClick={actions.selectAllStatus}
        title="Klik untuk menampilkan seluruh tagihan"
      >
        <div className="student-stat-icon stat-icon-brand">
          <FileText size={22} />
        </div>
        <div className="student-stat-meta">
          <span className="student-stat-title">Total Tagihan</span>
          <strong className="student-stat-number">
            {stats.totalCount.toLocaleString('id-ID')}
          </strong>
          <span className="stat-subtext">
            {stats.studentCount > 0
              ? `Dari ${stats.studentCount.toLocaleString('id-ID')} mahasiswa`
              : 'Tidak ada data'}
          </span>
        </div>
      </div>
      <div
        className={`student-stat-card clickable-card ${selectedStatus === 'paid' ? 'is-active' : ''}`}
        onClick={actions.togglePaidStatus}
        title="Klik untuk filter tagihan lunas"
      >
        <div className="student-stat-icon stat-icon-success">
          <CheckCircle2 size={22} />
        </div>
        <div className="student-stat-meta">
          <span className="student-stat-title">Total Terbayar</span>
          <strong className="student-stat-number text-success">
            {formatRupiah(stats.totalPaid)}
          </strong>
          <span className="stat-subtext">
            {stats.paidCount.toLocaleString('id-ID')} tagihan lunas
          </span>
        </div>
      </div>
      <div
        className={`student-stat-card clickable-card ${selectedStatus === 'partial' || selectedStatus === 'unpaid' ? 'is-active' : ''}`}
        onClick={actions.cycleOutstandingStatus}
        title="Klik untuk beralih filter Cicilan / Belum Lunas"
      >
        <div className="student-stat-icon stat-icon-warning">
          <Clock size={22} />
        </div>
        <div className="student-stat-meta">
          <span className="student-stat-title">Sisa Tunggakan</span>
          <strong
            className={`student-stat-number ${stats.totalRemaining > 0 ? 'text-warning' : 'text-success'}`}
          >
            {formatRupiah(stats.totalRemaining)}
          </strong>
          <span className="stat-subtext">
            {(stats.unpaidCount + stats.partialCount).toLocaleString('id-ID')} tagihan belum lunas
          </span>
        </div>
      </div>
      <div className="student-stat-card">
        <div className="student-stat-icon stat-icon-info">
          <CreditCard size={22} />
        </div>
        <div className="student-stat-meta">
          <span className="student-stat-title">Total Nominal Piutang</span>
          <strong className="student-stat-number text-info">
            {formatRupiah(stats.totalNominal)}
          </strong>
          <span className="stat-subtext">
            {hasActiveFilter ? 'Akumulasi sesuai filter aktif' : 'Akumulasi seluruh tagihan'}
          </span>
        </div>
      </div>
    </div>
  );
}

BillsStats.displayName = 'BillsStats';
