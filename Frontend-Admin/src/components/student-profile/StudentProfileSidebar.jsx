import React from 'react';
import { Check, Copy, ExternalLink, Mail } from 'lucide-react';
import { formatRupiah } from '../../utils/currency';

function statusBadgeClass(status) {
  if (status === 'aktif') return 'badge-success';
  if (status === 'cuti') return 'badge-warning';
  return 'badge-danger';
}

export function StudentProfileSidebar({ copiedKey, onCopy, student, summary }) {
  const totalAmount = Number(summary.total_amount || 0);
  const totalPaid = Number(summary.total_paid || 0);
  const totalOutstanding = Number(summary.total_outstanding || 0);
  const percentPaid =
    totalAmount > 0 ? Math.min(100, Math.round((totalPaid / totalAmount) * 100)) : 0;
  const cleanPhone = (student.phone_number || '').replace(/[^0-9]/g, '');
  const waPhone = cleanPhone.startsWith('0') ? `62${cleanPhone.slice(1)}` : cleanPhone;

  return (
    <div className="profile-left-col">
      <div className="panel-card profile-id-card">
        <div className="profile-avatar-wrapper">
          <div className="profile-avatar-circle">
            <span className="profile-avatar-initials">
              {(student.full_name || 'M').slice(0, 2).toUpperCase()}
            </span>
          </div>
          <span
            className={`status-indicator ${student.academic_status === 'aktif' ? 'is-active' : 'is-inactive'}`}
          />
        </div>

        <h1 className="profile-full-name">{student.full_name || '-'}</h1>
        <div className="profile-role-tag">Customer / Mahasiswa</div>
        <div className="profile-org-label">SALUT AWWABIN SEPATAN TANGERANG</div>
        <div className="profile-badge-row">
          <span className={`badge ${statusBadgeClass(student.academic_status)}`}>
            {student.academic_status ? student.academic_status.toUpperCase() : 'AKTIF'}
          </span>
          <span className="badge badge-neutral">
            {student.study_program_name || student.program_study || 'Program Studi'}
          </span>
        </div>
        <div className="profile-divider" />

        <div className="profile-quick-items">
          <div className="quick-item">
            <span className="quick-label">NIM</span>
            <div className="quick-val-row">
              <span className="quick-val mono-font">{student.nim || '-'}</span>
              {student.nim && (
                <button
                  type="button"
                  className="copy-btn-inline"
                  onClick={() => onCopy(student.nim, 'NIM')}
                  title="Salin NIM"
                >
                  {copiedKey === 'NIM' ? (
                    <Check size={13} color="var(--success)" />
                  ) : (
                    <Copy size={13} />
                  )}
                </button>
              )}
            </div>
          </div>
          <div className="quick-item">
            <span className="quick-label">No. Telepon / WA</span>
            <div className="quick-val-row">
              <span className="quick-val">{student.phone_number || '-'}</span>
              {waPhone && (
                <a
                  href={`https://wa.me/${waPhone}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="copy-btn-inline"
                  title="Chat via WhatsApp"
                  style={{ color: '#16a34a' }}
                >
                  <ExternalLink size={13} />
                </a>
              )}
            </div>
          </div>
          <div className="quick-item">
            <span className="quick-label">Email</span>
            <div className="quick-val-row">
              <span className="quick-val text-truncate" title={student.email}>
                {student.email || '-'}
              </span>
              {student.email && (
                <a
                  href={`mailto:${student.email}`}
                  className="copy-btn-inline"
                  title="Kirim Email"
                  style={{ color: 'var(--brand)' }}
                >
                  <Mail size={13} />
                </a>
              )}
            </div>
          </div>
          <div className="quick-item">
            <span className="quick-label">Alamat</span>
            <span className="quick-val" style={{ fontSize: 12.5, lineHeight: 1.4 }}>
              {student.address || '-'}
            </span>
          </div>
        </div>
      </div>

      <div className="panel-card profile-fin-card">
        <div className="card-sub-title">Ringkasan Keuangan Mahasiswa</div>
        <div className="fin-stat-hero">
          <div className="fin-stat-total">
            <span className="label">Total Tagihan</span>
            <span className="val">{formatRupiah(totalAmount)}</span>
          </div>
          <div className="fin-progress-bar">
            <div
              className="fin-progress-fill"
              style={{
                width: `${percentPaid}%`,
                background:
                  percentPaid === 100
                    ? 'var(--success)'
                    : percentPaid > 0
                      ? 'var(--warning)'
                      : 'var(--danger)',
              }}
            />
          </div>
          <div className="fin-stat-row">
            <div>
              <span className="label">Terbayar</span>
              <span className="val-paid">
                {formatRupiah(totalPaid)} ({percentPaid}%)
              </span>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span className="label">Sisa Tunggakan</span>
              <span className="val-out">{formatRupiah(totalOutstanding)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
