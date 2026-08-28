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
      <div className="skeleton-list-container">
        {[1, 2, 3, 4, 5, 6].map((item) => (
          <div key={item} className="skeleton-box skeleton-row w-full" />
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
              <th className="col-w-44-center">No.</th>
              <th className="col-w-130">NIM</th>
              <th>Nama Mahasiswa</th>
              <th className="col-w-170">No KTP / NIK</th>
              <th>Program Studi</th>
              <th className="col-w-130">Periode Masuk</th>
              <th className="col-w-130">Kontak</th>
              <th className="col-w-100-center">Status</th>
              <th className="col-w-140">Tagihan</th>
              <th className="col-w-150-right">Aksi</th>
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
        <div className="flex-row-gap-8">
          <div className="pagination-page-size-wrap">
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
            <span className="pagination-page-label">
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

StudentsTable.displayName = 'StudentsTable';
