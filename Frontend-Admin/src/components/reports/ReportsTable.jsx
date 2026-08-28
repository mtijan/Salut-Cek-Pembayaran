import React from 'react';
import { Check, Copy, FileText, User } from 'lucide-react';
import StatusBadge from '../common/StatusBadge';
import ReportsPagination from './ReportsPagination';

export default function ReportsTable({
  loading,
  students,
  hasActiveFilter,
  copiedKey,
  pagination,
  actions,
  navigateTo,
}) {
  if (loading) {
    return (
      <div className="table-loading-container">
        <div className="loading-spinner-circle" />
        <p className="loading-state-text">Memuat data rekapitulasi keuangan...</p>
      </div>
    );
  }

  if (pagination.totalCount === 0) {
    return (
      <div className="table-empty-container">
        <FileText size={48} className="empty-state-icon" />
        <p className="empty-state-title">Tidak ada data rekapitulasi keuangan</p>
        <p className="empty-state-desc">
          {hasActiveFilter
            ? 'Tidak ditemukan data keuangan yang sesuai dengan kriteria filter.'
            : 'Belum ada data tagihan atau mahasiswa di sistem.'}
        </p>
        {hasActiveFilter && (
          <button
            type="button"
            className="btn btn-secondary btn-sm mt-3"
            onClick={actions.resetFilters}
          >
            Reset Semua Filter
          </button>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="table-responsive">
        <table className="data-table">
          <thead>
            <tr>
              <th className="th-no">No</th>
              <th>Mahasiswa</th>
              <th>Program Studi</th>
              <th>Angkatan</th>
              <th className="text-center">Tagihan</th>
              <th className="text-right">Total Terbit</th>
              <th className="text-right">Total Terbayar</th>
              <th className="text-right">Sisa Piutang</th>
              <th className="text-center">Status Realisasi</th>
              <th className="th-action">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {students.map((student, index) => {
              const rowNumber = (pagination.page - 1) * pagination.pageSize + index + 1;
              const isPaid = student.status === 'paid';
              const isPartial = student.status === 'partial';
              return (
                <tr key={student.student_id || index}>
                  <td className="cell-row-num">{rowNumber}</td>
                  <td>
                    <div className="student-name-cell">{student.full_name}</div>
                    <div className="student-meta-row">
                      <span>
                        NIM: <strong className="mono-font">{student.nim}</strong>
                      </span>
                      {student.nim && student.nim !== '-' && (
                        <button
                          type="button"
                          className="copy-btn-inline"
                          onClick={() => actions.copy(student.nim, `NIM ${student.full_name}`)}
                          title="Salin NIM"
                        >
                          {copiedKey === `NIM ${student.full_name}` ? (
                            <Check size={11} color="var(--success)" />
                          ) : (
                            <Copy size={11} />
                          )}
                        </button>
                      )}
                      {student.phone_number && student.phone_number !== '-' && (
                        <>
                          <span>&bull;</span>
                          <span>
                            WA: <strong className="mono-font">{student.phone_number}</strong>
                          </span>
                          <button
                            type="button"
                            className="copy-btn-inline"
                            onClick={() =>
                              actions.copy(student.phone_number, `WA ${student.full_name}`)
                            }
                            title="Salin No. WhatsApp"
                          >
                            {copiedKey === `WA ${student.full_name}` ? (
                              <Check size={11} color="var(--success)" />
                            ) : (
                              <Copy size={11} />
                            )}
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                  <td>
                    <div className="cell-prodi">{student.program_study}</div>
                  </td>
                  <td>
                    <span className="badge badge-neutral badge-sm">{student.entry_period}</span>
                  </td>
                  <td className="text-center font-semibold">{student.total_bills}</td>
                  <td className="text-right font-semibold">{student.billed_amount_formatted}</td>
                  <td className="text-right font-bold text-success">
                    {student.paid_amount_formatted}
                  </td>
                  <td
                    className={`text-right font-bold ${student.outstanding_amount > 0 ? 'text-danger' : 'text-muted'}`}
                  >
                    {student.outstanding_amount_formatted}
                  </td>
                  <td className="text-center">
                    <StatusBadge
                      tone={isPaid ? 'success' : isPartial ? 'warning' : 'danger'}
                      className="badge-compact"
                    >
                      {isPaid
                        ? 'LUNAS'
                        : isPartial
                          ? `SEBAGIAN (${student.percentage_paid}%)`
                          : 'BELUM BAYAR'}
                    </StatusBadge>
                  </td>
                  <td className="text-center">
                    <div className="table-action-cell">
                      {navigateTo && student.student_id && (
                        <button
                          type="button"
                          className="btn-icon"
                          onClick={() =>
                            navigateTo('student-profile', {
                              studentId: student.student_id,
                              initialTab: 'bills',
                            })
                          }
                          title="Buka Profil & Tagihan Mahasiswa"
                        >
                          <User size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ReportsPagination pagination={pagination} />
    </>
  );
}

ReportsTable.displayName = 'ReportsTable';
