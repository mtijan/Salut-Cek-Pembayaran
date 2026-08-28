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
        <div
          style={{
            width: 32,
            height: 32,
            border: '3px solid var(--line)',
            borderTopColor: 'var(--brand)',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }}
        />
        <p style={{ fontSize: 13, fontWeight: 600 }}>Memuat data rekapitulasi keuangan...</p>
      </div>
    );
  }

  if (pagination.totalCount === 0) {
    return (
      <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--muted)' }}>
        <FileText size={48} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
        <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>
          Tidak ada data rekapitulasi keuangan
        </p>
        <p style={{ fontSize: 13, marginTop: 4 }}>
          {hasActiveFilter
            ? 'Tidak ditemukan data keuangan yang sesuai dengan kriteria filter.'
            : 'Belum ada data tagihan atau mahasiswa di sistem.'}
        </p>
        {hasActiveFilter && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={actions.resetFilters}
            style={{ marginTop: 12 }}
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
              <th style={{ width: 40, textAlign: 'center' }}>No</th>
              <th>Mahasiswa</th>
              <th>Program Studi</th>
              <th>Angkatan</th>
              <th style={{ textAlign: 'center' }}>Tagihan</th>
              <th style={{ textAlign: 'right' }}>Total Terbit</th>
              <th style={{ textAlign: 'right' }}>Total Terbayar</th>
              <th style={{ textAlign: 'right' }}>Sisa Piutang</th>
              <th style={{ textAlign: 'center' }}>Status Realisasi</th>
              <th style={{ width: 80, textAlign: 'center' }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {students.map((student, index) => {
              const rowNumber = (pagination.page - 1) * pagination.pageSize + index + 1;
              const isPaid = student.status === 'paid';
              const isPartial = student.status === 'partial';
              return (
                <tr key={student.student_id || index}>
                  <td style={{ textAlign: 'center', fontSize: 12, color: 'var(--muted)' }}>
                    {rowNumber}
                  </td>
                  <td>
                    <div style={{ fontWeight: 700, color: 'var(--ink)', fontSize: 13.5 }}>
                      {student.full_name}
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: 6,
                        fontSize: 12,
                        color: 'var(--muted)',
                        marginTop: 2,
                      }}
                    >
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
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
                      {student.program_study}
                    </div>
                  </td>
                  <td>
                    <span className="badge badge-neutral" style={{ fontSize: 11.5 }}>
                      {student.entry_period}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center', fontWeight: 600, fontSize: 13 }}>
                    {student.total_bills}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>
                    {student.billed_amount_formatted}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--success)' }}>
                    {student.paid_amount_formatted}
                  </td>
                  <td
                    style={{
                      textAlign: 'right',
                      fontWeight: 700,
                      color: student.outstanding_amount > 0 ? 'var(--danger)' : 'var(--muted)',
                    }}
                  >
                    {student.outstanding_amount_formatted}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <StatusBadge
                      tone={isPaid ? 'success' : isPartial ? 'warning' : 'danger'}
                      style={{ fontSize: 11.5, padding: '3px 8px' }}
                    >
                      {isPaid
                        ? 'LUNAS'
                        : isPartial
                          ? `SEBAGIAN (${student.percentage_paid}%)`
                          : 'BELUM BAYAR'}
                    </StatusBadge>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <div style={{ display: 'inline-flex', gap: 4 }}>
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
