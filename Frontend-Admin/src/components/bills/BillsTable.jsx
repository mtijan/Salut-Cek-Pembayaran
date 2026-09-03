import React from 'react';
import { AlertCircle, ChevronLeft, ChevronRight, FileText, RefreshCw } from 'lucide-react';
import BillTableRow from './BillTableRow';

export default function BillsTable({
  bills,
  loading,
  totalCount,
  stats,
  copiedKey,
  hasActiveFilter,
  selectedActivation,
  pagination,
  canManage,
  actions,
  navigateTo,
}) {
  return (
    <>
      <div className="bills-summary-banner">
        <span className="flex-row-gap-6">
          <FileText size={14} className="icon-primary" />
          <span>
            Menampilkan <strong>{bills.length}</strong> baris dari total{' '}
            <strong>{totalCount.toLocaleString('id-ID')}</strong> tagihan milik{' '}
            <strong>{stats.studentCount.toLocaleString('id-ID')}</strong> mahasiswa
            {hasActiveFilter
              ? ' (sesuai filter yang diterapkan)'
              : selectedActivation === 'active'
                ? ' (tagihan aktif)'
                : ' (seluruh data)'}
          </span>
        </span>
        <span className="cell-xs text-muted font-semibold">
          Halaman {pagination.page} dari {pagination.totalPages}
        </span>
      </div>
      {loading ? (
        <div className="table-loading-container">
          <RefreshCw size={28} className="spin icon-primary" />
          <span>Memuat data tagihan...</span>
        </div>
      ) : bills.length === 0 ? (
        <div className="table-empty-container">
          <AlertCircle size={36} className="empty-state-icon" />
          <h3 className="empty-state-title">Tidak ada data tagihan yang sesuai</h3>
          <p className="empty-state-desc">
            Coba sesuaikan kata kunci pencarian atau ubah filter di atas.
          </p>
          {hasActiveFilter && (
            <button type="button" onClick={actions.resetFilters} className="btn btn-secondary mt-3">
              Reset Semua Filter
            </button>
          )}
        </div>
      ) : (
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>MAHASISWA</th>
                <th>PERIODE</th>
                <th>JENIS TAGIHAN</th>
                <th className="text-center">AKTIVASI</th>
                <th>NOMINAL &amp; TERBAYAR</th>
                <th className="text-center">STATUS</th>
                <th>JATUH TEMPO</th>
                <th>NOMOR BRIVA</th>
                <th className="text-right">AKSI</th>
              </tr>
            </thead>
            <tbody>
              {bills.map((bill) => (
                <BillTableRow
                  key={bill.id}
                  bill={bill}
                  copiedKey={copiedKey}
                  canManage={canManage}
                  actions={actions}
                  navigateTo={navigateTo}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="pagination-wrap">
        <div className="pagination-info">
          Menampilkan <strong>{(pagination.page - 1) * pagination.pageSize + 1}</strong> s.d.{' '}
          <strong>{Math.min(pagination.page * pagination.pageSize, totalCount)}</strong> dari{' '}
          <strong>{totalCount}</strong> tagihan
        </div>
        <div className="flex-row-gap-8">
          <div className="pagination-controls">
            <button
              type="button"
              className="pagination-btn"
              disabled={pagination.page <= 1}
              onClick={() => pagination.setPage((page) => Math.max(1, page - 1))}
            >
              <ChevronLeft size={16} />
            </button>
            <span className="pagination-page-label">
              {pagination.page} / {pagination.totalPages}
            </span>
            <button
              type="button"
              className="pagination-btn"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() =>
                pagination.setPage((page) => Math.min(pagination.totalPages, page + 1))
              }
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

BillsTable.displayName = 'BillsTable';
