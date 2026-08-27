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
  pagination,
  canManage,
  actions,
  navigateTo,
}) {
  return (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 8,
          padding: '9px 14px',
          background: 'var(--brand-surface, #f8fafc)',
          borderRadius: 8,
          border: '1px solid var(--border-color, #e2e8f0)',
          fontSize: 12.5,
          color: 'var(--text-secondary, #475569)',
          marginBottom: 16,
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <FileText size={14} style={{ color: 'var(--brand)' }} />
          <span>
            Menampilkan <strong>{bills.length}</strong> baris dari total{' '}
            <strong>{totalCount.toLocaleString('id-ID')}</strong> tagihan milik{' '}
            <strong>{stats.studentCount.toLocaleString('id-ID')}</strong> mahasiswa
            {hasActiveFilter ? ' (sesuai filter yang diterapkan)' : ' (seluruh data)'}
          </span>
        </span>
        <span style={{ color: 'var(--muted)', fontWeight: 500, fontSize: 12 }}>
          Halaman {pagination.page} dari {pagination.totalPages}
        </span>
      </div>
      {loading ? (
        <div
          style={{
            padding: '60px 20px',
            textAlign: 'center',
            color: 'var(--muted)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <RefreshCw size={28} className="spin" style={{ color: 'var(--brand)' }} />
          <span>Memuat data tagihan...</span>
        </div>
      ) : bills.length === 0 ? (
        <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--muted)' }}>
          <AlertCircle size={36} style={{ color: 'var(--muted-light)', marginBottom: 10 }} />
          <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)', margin: 0 }}>
            Tidak ada data tagihan yang sesuai
          </h3>
          <p style={{ fontSize: 13, margin: '6px 0 0 0' }}>
            Coba sesuaikan kata kunci pencarian atau ubah filter di atas.
          </p>
          {hasActiveFilter && (
            <button
              type="button"
              onClick={actions.resetFilters}
              className="btn btn-secondary"
              style={{ marginTop: 14, fontSize: 13 }}
            >
              Reset Semua Filter
            </button>
          )}
        </div>
      ) : (
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '28%' }}>MAHASISWA</th>
                <th style={{ width: '14%' }}>PERIODE & JENIS</th>
                <th style={{ width: '18%' }}>NOMINAL & TERBAYAR</th>
                <th style={{ width: '13%', textAlign: 'center' }}>STATUS</th>
                <th style={{ width: '12%' }}>JATUH TEMPO</th>
                <th style={{ width: '15%' }}>NOMOR BRIVA</th>
                <th style={{ width: '10%', textAlign: 'right' }}>AKSI</th>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div className="pagination-controls">
            <button
              type="button"
              className="pagination-btn"
              disabled={pagination.page <= 1}
              onClick={() => pagination.setPage((page) => Math.max(1, page - 1))}
            >
              <ChevronLeft size={16} />
            </button>
            <span style={{ fontSize: 13, fontWeight: 600, padding: '0 8px', color: 'var(--ink)' }}>
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
