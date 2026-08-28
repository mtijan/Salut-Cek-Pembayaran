import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function ReportsPagination({ pagination }) {
  if (pagination.totalPages <= 1) return null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
        marginTop: 18,
        paddingTop: 14,
        borderTop: '1px solid var(--line)',
      }}
    >
      <div style={{ fontSize: 13, color: 'var(--muted)' }}>
        Halaman <strong>{pagination.page}</strong> dari <strong>{pagination.totalPages}</strong> (
        {pagination.totalCount} Total Mahasiswa)
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={pagination.page <= 1}
          onClick={() => pagination.setPage((currentPage) => Math.max(1, currentPage - 1))}
        >
          <ChevronLeft size={14} />
          <span>Sebelumnya</span>
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={pagination.page >= pagination.totalPages}
          onClick={() =>
            pagination.setPage((currentPage) => Math.min(pagination.totalPages, currentPage + 1))
          }
        >
          <span>Berikutnya</span>
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}
