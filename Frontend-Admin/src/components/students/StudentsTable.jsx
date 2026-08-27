import React from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  RefreshCw,
  Users,
} from 'lucide-react';
import StudentTableRow from './StudentTableRow';

export default function StudentsTable({
  students,
  paginatedStudents,
  loading,
  copiedKey,
  pagination,
  canManage,
  actions,
  navigateTo,
}) {
  if (loading)
    return (
      <div style={{ padding: '24px 12px' }}>
        {[1, 2, 3, 4, 5, 6].map((item) => (
          <div key={item} className="skeleton-box skeleton-row" style={{ width: '100%' }} />
        ))}
      </div>
    );
  if (students.length === 0)
    return (
      <div className="empty-state-card">
        <div className="empty-state-icon">
          <Users size={32} />
        </div>
        <h3 className="empty-state-title">Tidak Ada Data Mahasiswa</h3>
        <p className="empty-state-text">
          Tidak ditemukan data mahasiswa yang sesuai dengan filter atau kata kunci pencarian Anda.
        </p>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={actions.resetSearchFilters}
        >
          <RefreshCw size={14} />
          <span>Reset Filter Pencarian</span>
        </button>
      </div>
    );
  return (
    <>
      <div className="table-responsive">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: 44, textAlign: 'center' }}>No.</th>
              <th style={{ width: 130 }}>NIM</th>
              <th>Nama Mahasiswa</th>
              <th style={{ width: 170 }}>No KTP / NIK</th>
              <th>Program Studi</th>
              <th style={{ width: 130 }}>Periode Masuk</th>
              <th style={{ width: 130 }}>Kontak</th>
              <th style={{ width: 100, textAlign: 'center' }}>Status</th>
              <th style={{ width: 140 }}>Tagihan</th>
              <th style={{ width: 150, textAlign: 'right' }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {paginatedStudents.map((student, index) => (
              <StudentTableRow
                key={student.id}
                student={student}
                rowNumber={(pagination.currentPage - 1) * pagination.pageSize + index + 1}
                copiedKey={copiedKey}
                canManage={canManage}
                actions={actions}
                navigateTo={navigateTo}
              />
            ))}
          </tbody>
        </table>
      </div>
      <div className="pagination-wrap">
        <div className="pagination-info">
          Menampilkan <strong>{(pagination.currentPage - 1) * pagination.pageSize + 1}</strong> s.d.{' '}
          <strong>{Math.min(pagination.currentPage * pagination.pageSize, students.length)}</strong>{' '}
          dari <strong>{students.length}</strong> data mahasiswa
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 13,
              color: 'var(--muted)',
            }}
          >
            <span>Tampilkan:</span>
            <select
              className="pagination-select"
              value={pagination.pageSize}
              onChange={(event) => actions.setPageSize(Number(event.target.value))}
            >
              <option value={15}>15 per halaman</option>
              <option value={25}>25 per halaman</option>
              <option value={50}>50 per halaman</option>
              <option value={100}>100 per halaman</option>
            </select>
          </div>
          <div className="pagination-controls">
            <button
              type="button"
              className="pagination-btn"
              disabled={pagination.currentPage === 1}
              onClick={() => pagination.setCurrentPage(1)}
              title="Halaman Pertama"
            >
              <ChevronsLeft size={16} />
            </button>
            <button
              type="button"
              className="pagination-btn"
              disabled={pagination.currentPage === 1}
              onClick={() => pagination.setCurrentPage((page) => Math.max(1, page - 1))}
              title="Halaman Sebelumnya"
            >
              <ChevronLeft size={16} />
            </button>
            <span style={{ fontSize: 13, fontWeight: 700, padding: '0 8px', color: 'var(--ink)' }}>
              Halaman {pagination.currentPage} / {pagination.totalPages}
            </span>
            <button
              type="button"
              className="pagination-btn"
              disabled={pagination.currentPage === pagination.totalPages}
              onClick={() =>
                pagination.setCurrentPage((page) => Math.min(pagination.totalPages, page + 1))
              }
              title="Halaman Berikutnya"
            >
              <ChevronRight size={16} />
            </button>
            <button
              type="button"
              className="pagination-btn"
              disabled={pagination.currentPage === pagination.totalPages}
              onClick={() => pagination.setCurrentPage(pagination.totalPages)}
              title="Halaman Terakhir"
            >
              <ChevronsRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
