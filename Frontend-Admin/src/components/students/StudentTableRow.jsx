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
      <td
        style={{
          width: 44,
          textAlign: 'center',
          color: 'var(--muted)',
          fontWeight: 600,
          fontSize: 12.5,
        }}
      >
        {rowNumber}
      </td>
      <td>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <strong style={{ fontFamily: 'var(--font-mono)' }}>{student.nim}</strong>
          <button
            type="button"
            className="copy-btn-inline"
            onClick={() => actions.copy(student.nim, `NIM ${student.nim}`)}
            title="Salin NIM"
          >
            {copiedKey === `NIM ${student.nim}` ? (
              <Check size={12} color="var(--success)" />
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
          {student.email && (
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{student.email}</div>
          )}
        </div>
      </td>
      <td>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <code style={{ fontSize: 12, color: 'var(--ink)', fontFamily: 'var(--font-mono)' }}>
            {student.no_ktp || '-'}
          </code>
          {student.no_ktp && (
            <button
              type="button"
              className="copy-btn-inline"
              onClick={() => actions.copy(student.no_ktp, `NIK ${student.no_ktp}`)}
              title="Salin NIK"
            >
              {copiedKey === `NIK ${student.no_ktp}` ? (
                <Check size={12} color="var(--success)" />
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
        <StatusBadge tone="neutral" style={{ fontSize: 11, fontWeight: 700 }}>
          {student.entry_period_formatted ||
            student.initial_registration ||
            (student.entry_year ? `Angkatan ${student.entry_year}` : '-')}
        </StatusBadge>
      </td>
      <td>
        <span style={{ fontSize: 12.5, fontFamily: 'var(--font-mono)' }}>
          {student.phone_number || '-'}
        </span>
      </td>
      <td style={{ textAlign: 'center' }}>
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
            style={{
              color: Number(student.total_amount || 0) > 0 ? 'var(--brand-strong)' : 'var(--muted)',
            }}
          >
            {student.total_amount_formatted}
          </strong>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
            {student.bill_count} tagihan
          </div>
        </div>
      </td>
      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 6,
          }}
        >
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            style={{ height: 30, padding: '0 8px', gap: 4 }}
            onClick={() => openProfile('profile')}
            title="Lihat Profil 360 Mahasiswa"
          >
            <Eye size={13} color="var(--brand)" />
            <span>Profil 360</span>
          </button>
          {canManage && (
            <>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ height: 30, padding: '0 8px', gap: 4 }}
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
                className="btn btn-danger btn-sm"
                style={{ height: 30, width: 30, padding: 0 }}
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
