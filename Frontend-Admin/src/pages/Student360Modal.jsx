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
        className="modal-dialog large"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        style={{ overflow: 'hidden', padding: 0 }}
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
                    className="copy-btn-inline"
                    onClick={() => modal.handleCopy(student.nim, 'NIM')}
                    title="Salin NIM"
                    style={{ color: '#dcfce7' }}
                  >
                    {modal.copiedKey === 'NIM' ? <Check size={13} /> : <Copy size={13} />}
                  </button>
                )}
                <span style={{ opacity: 0.5 }}>&bull;</span>
                <span>{student?.study_program_name || student?.program_study || '-'}</span>
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              className={`badge ${student?.academic_status === 'aktif' ? 'badge-success' : student?.academic_status === 'cuti' ? 'badge-warning' : 'badge-danger'}`}
              style={{ fontSize: 12, padding: '4px 10px' }}
            >
              {student?.academic_status || 'aktif'}
            </span>
            <button
              type="button"
              className="modal-close-btn"
              onClick={onClose}
              aria-label="Tutup"
              style={{ color: '#ffffff', background: 'rgba(255,255,255,0.15)' }}
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

        <div className="modal-body" style={{ maxHeight: 'calc(80vh - 170px)', overflowY: 'auto' }}>
          {modal.loading ? (
            <div style={{ padding: 40, textAlign: 'center' }}>
              <div
                className="skeleton-box skeleton-row"
                style={{ width: '100%', marginBottom: 12 }}
              />
              <div
                className="skeleton-box skeleton-row"
                style={{ width: '80%', marginBottom: 12 }}
              />
              <div className="skeleton-box skeleton-row" style={{ width: '60%' }} />
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

        <div className="modal-footer" style={{ background: '#f8fafc' }}>
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
