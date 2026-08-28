import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function ReportsPagination({ pagination }) {
  if (pagination.totalPages <= 1) return null;

  return (
    <div className="pagination-container-reports">
      <div className="pagination-text">
        Halaman <strong>{pagination.page}</strong> dari <strong>{pagination.totalPages}</strong> (
        {pagination.totalCount} Total Mahasiswa)
      </div>
      <div className="pagination-btn-group">
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

ReportsPagination.displayName = 'ReportsPagination';
