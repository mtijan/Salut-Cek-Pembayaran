import React from 'react';
import { BookOpen, Check, Clock, Copy, CreditCard, X } from 'lucide-react';
import { Student360Bio } from '../components/student-360/Student360Bio';
import { Student360Financial } from '../components/student-360/Student360Financial';
import { Student360History } from '../components/student-360/Student360History';
import { useStudent360 } from '../hooks/useStudent360';

const TABS = [
  { id: 'bio', label: 'Biodata & Akademik', Icon: BookOpen },
  { id: 'financial', label: 'Tagihan & BRIVA', Icon: CreditCard },
  { id: 'history', label: 'Riwayat Pembayaran', Icon: Clock },
];

export default function Student360Modal({ studentId, isOpen, onClose }) {
  const modal = useStudent360({ isOpen, onClose, studentId });
  if (!isOpen) return null;

  const student = modal.data?.student;
  const summary = modal.data?.summary;
  const bills = modal.data?.bills || [];
  const totalAmount = Number(summary?.total_amount || 0);
  const totalPaid = Number(summary?.total_paid || 0);
  const percentPaid =
    totalAmount > 0 ? Math.min(100, Math.round((totalPaid / totalAmount) * 100)) : 0;

  const copySummary = () => {
    const text = `NIM: ${student?.nim}\nNama: ${student?.full_name}\nNIK: ${student?.no_ktp || '-'}\nProdi: ${student?.study_program_name || student?.program_study || '-'}\nKontak: ${student?.phone_number || '-'}\nTotal Tagihan: ${summary?.total_amount_formatted || 'Rp 0'}`;
    modal.handleCopy(text, 'Ringkasan Data');
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-dialog large modal-dialog-clean"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="modal-hero-banner">
          <div className="modal-hero-left">
            <div className="modal-hero-meta">
              <h2>{student?.full_name || 'Detail Mahasiswa'}</h2>
              <p>
                <span>
                  NIM: <strong>{student?.nim || '-'}</strong>
                </span>
                {student?.nim && (
                  <button
                    type="button"
                    className="copy-btn-inline copy-btn-white-trans"
                    onClick={() => modal.handleCopy(student.nim, 'NIM')}
                    title="Salin NIM"
                  >
                    {modal.copiedKey === 'NIM' ? <Check size={13} /> : <Copy size={13} />}
                  </button>
                )}
                <span className="opacity-50">&bull;</span>
                <span>{student?.study_program_name || student?.program_study || '-'}</span>
              </p>
            </div>
          </div>
          <div className="flex-row-gap-8">
            <span
              className={`badge badge-hero-status ${student?.academic_status === 'aktif' ? 'badge-success' : student?.academic_status === 'cuti' ? 'badge-warning' : 'badge-danger'}`}
            >
              {student?.academic_status || 'aktif'}
            </span>
            <button
              type="button"
              className="modal-close-btn modal-close-white"
              onClick={onClose}
              aria-label="Tutup"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="modal-tabs-header">
          {TABS.map(({ id, label, Icon }) => {
            const count =
              id === 'financial'
                ? bills.length
                : id === 'history'
                  ? modal.paymentHistory.length
                  : null;
            return (
              <button
                key={id}
                type="button"
                className={`modal-tab-button ${modal.activeTab === id ? 'is-active' : ''}`}
                onClick={() => modal.setActiveTab(id)}
              >
                <Icon size={16} />
                <span>
                  {label}
                  {count !== null ? ` (${count})` : ''}
                </span>
              </button>
            );
          })}
        </div>

        <div className="modal-body modal-body-360">
          {modal.loading ? (
            <div className="skeleton-360-container">
              <div className="skeleton-box skeleton-row w-full mb-3" />
              <div className="skeleton-box skeleton-row w-80 mb-3" />
              <div className="skeleton-box skeleton-row w-60" />
            </div>
          ) : (
            <>
              {modal.activeTab === 'bio' && (
                <Student360Bio
                  copiedKey={modal.copiedKey}
                  onCopy={modal.handleCopy}
                  student={student}
                />
              )}
              {modal.activeTab === 'financial' && (
                <Student360Financial
                  bills={bills}
                  copiedKey={modal.copiedKey}
                  onCopy={modal.handleCopy}
                  percentPaid={percentPaid}
                  summary={summary}
                />
              )}
              {modal.activeTab === 'history' && (
                <Student360History
                  history={modal.paymentHistory}
                  loading={modal.historyLoading}
                  onFetch={modal.fetchPaymentHistory}
                  pagination={modal.historyPagination}
                />
              )}
            </>
          )}
        </div>

        <div className="modal-footer modal-footer-bg">
          <button type="button" className="btn btn-secondary btn-sm" onClick={copySummary}>
            <Copy size={14} />
            <span>Salin Profil Singkat</span>
          </button>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}

Student360Modal.displayName = 'Student360Modal';
