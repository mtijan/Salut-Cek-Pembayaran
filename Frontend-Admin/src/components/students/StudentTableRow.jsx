import React from 'react';
import { Check, Copy, Edit2, Eye, Trash2 } from 'lucide-react';
import StatusBadge from '../common/StatusBadge';

export default function StudentTableRow({
  student,
  rowNumber,
  copiedKey,
  canManage,
  actions,
  navigateTo,
}) {
  const openProfile = (initialTab) =>
    navigateTo
      ? navigateTo('student-profile', {
          studentId: student.id,
          ...(initialTab ? { initialTab } : {}),
        })
      : actions.setSelected360Id(student.id);
  return (
    <tr>
      <td className="table-cell-row-num">{rowNumber}</td>
      <td>
        <div className="flex-row-gap-6">
          <strong className="font-mono-600">{student.nim}</strong>
          <button
            type="button"
            className="copy-btn-inline"
            onClick={() => actions.copy(student.nim, `NIM ${student.nim}`)}
            title="Salin NIM"
          >
            {copiedKey === `NIM ${student.nim}` ? (
              <Check size={12} className="text-success" />
            ) : (
              <Copy size={12} />
            )}
          </button>
        </div>
      </td>
      <td>
        <div>
          <button
            type="button"
            className="table-link-btn"
            onClick={() => openProfile()}
            title="Buka Halaman Profil 360 Mahasiswa"
          >
            {student.full_name}
          </button>
          {student.email && <div className="cell-email">{student.email}</div>}
        </div>
      </td>
      <td>
        <div className="flex-row-gap-6">
          <code className="cell-ktp">{student.no_ktp || '-'}</code>
          {student.no_ktp && (
            <button
              type="button"
              className="copy-btn-inline"
              onClick={() => actions.copy(student.no_ktp, `NIK ${student.no_ktp}`)}
              title="Salin NIK"
            >
              {copiedKey === `NIK ${student.no_ktp}` ? (
                <Check size={12} className="text-success" />
              ) : (
                <Copy size={12} />
              )}
            </button>
          )}
        </div>
      </td>
      <td>
        <span>{student.study_program_name || student.program_study || '-'}</span>
      </td>
      <td>
        <StatusBadge tone="neutral" className="badge-entry-period">
          {student.entry_period_formatted ||
            student.initial_registration ||
            (student.entry_year ? `Angkatan ${student.entry_year}` : '-')}
        </StatusBadge>
      </td>
      <td>
        <span className="cell-phone">{student.phone_number || '-'}</span>
      </td>
      <td className="text-center">
        <StatusBadge
          tone={
            student.academic_status === 'aktif'
              ? 'success'
              : student.academic_status === 'cuti'
                ? 'warning'
                : 'danger'
          }
        >
          {student.academic_status || 'aktif'}
        </StatusBadge>
      </td>
      <td>
        <div>
          <strong
            className={Number(student.total_amount || 0) > 0 ? 'text-brand-strong' : 'text-muted'}
          >
            {student.total_amount_formatted}
          </strong>
          <div className="cell-email">{student.bill_count} tagihan</div>
        </div>
      </td>
      <td className="text-right whitespace-nowrap">
        <div className="table-action-cell">
          <button
            type="button"
            className="btn btn-secondary btn-sm btn-action-pay"
            onClick={() => openProfile('profile')}
            title="Lihat Profil 360 Mahasiswa"
          >
            <Eye size={13} className="icon-primary" />
            <span>Profil 360</span>
          </button>
          {canManage && (
            <>
              <button
                type="button"
                className="btn btn-secondary btn-sm btn-action-pay"
                onClick={() =>
                  navigateTo
                    ? navigateTo('student-profile', { studentId: student.id, initialTab: 'edit' })
                    : actions.openEdit(student)
                }
                title="Edit Data Mahasiswa"
              >
                <Edit2 size={13} />
                <span>Edit</span>
              </button>
              <button
                type="button"
                className="btn btn-danger btn-sm btn-action-icon"
                onClick={() => actions.setDeleteTarget(student)}
                title="Hapus Mahasiswa"
              >
                <Trash2 size={13} />
              </button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

StudentTableRow.displayName = 'StudentTableRow';
