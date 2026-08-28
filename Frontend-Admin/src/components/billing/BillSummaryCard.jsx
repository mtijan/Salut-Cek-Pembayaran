import React from 'react';
import { Check, Copy, CreditCard } from 'lucide-react';

const formatRupiah = (val) => {
  const num = Number(val) || 0;
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
};

/**
 * Kolom kiri BillEditPage.
 * Menampilkan identitas mahasiswa dan ringkasan saldo tagihan.
 * Props: formData, loadedStudent, loadedBill, isCreate, copiedKey, onCopyNim
 */
export default function BillSummaryCard({
  formData,
  loadedStudent,
  loadedBill,
  isCreate,
  copiedKey,
  onCopyNim,
}) {
  const studentData = loadedStudent || {};
  const billData = loadedBill || {};

  const totalAmountNum = Number(formData.amount) || 0;
  const paidAmountNum = Number(formData.paid_amount) || 0;
  const remainingAmountNum = Math.max(0, totalAmountNum - paidAmountNum);
  const percentPaid = totalAmountNum > 0 ? Math.round((paidAmountNum / totalAmountNum) * 100) : 0;
  const clampedPercent = Math.min(100, Math.max(0, percentPaid));

  return (
    <div className="bill-summary-col">
      {/* Student Identity Card */}
      <div className="bill-id-card">
        <div className="bill-id-header">
          <div className="bill-avatar-badge">
            {(formData.full_name || 'M').charAt(0).toUpperCase()}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h3 className="bill-student-name-heading">
              {formData.full_name || (isCreate ? 'Pilih Mahasiswa' : 'Nama Mahasiswa')}
            </h3>
            <div className="bill-nim-subrow">
              <span className="bill-nim-text">{formData.nim || '-'}</span>
              {formData.nim && (
                <button
                  type="button"
                  onClick={() => onCopyNim(formData.nim, 'NIM')}
                  className="bill-copy-btn-inline"
                  title="Salin NIM"
                >
                  {copiedKey === 'NIM' ? (
                    <Check size={13} style={{ color: 'var(--brand-primary, #059669)' }} />
                  ) : (
                    <Copy size={13} />
                  )}
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="bill-info-list">
          <div className="bill-info-item">
            <span className="bill-info-label">Program Studi</span>
            <span className="bill-info-value">
              {studentData.study_program_name || studentData.prodi_name || '-'}
            </span>
          </div>
          <div className="bill-info-item">
            <span className="bill-info-label">Status Akademik</span>
            <span
              className={`bill-academic-badge ${studentData.academic_status === 'aktif' ? 'aktif' : 'nonaktif'}`}
            >
              {studentData.academic_status || 'Aktif'}
            </span>
          </div>
          <div className="bill-info-item">
            <span className="bill-info-label">Sumber Entri</span>
            <span className="bill-info-value">
              {billData.source_file || (isCreate ? 'Manual Admin' : 'Manual')}
            </span>
          </div>
        </div>
      </div>

      {/* Financial Summary Card */}
      <div className="bill-calc-summary-card">
        <h4 className="bill-calc-title">
          <CreditCard size={16} style={{ color: 'var(--brand-primary, #059669)' }} />
          <span>Ringkasan Saldo Tagihan</span>
        </h4>

        <div className="bill-calc-stack">
          <div className="bill-calc-total-box">
            <div className="bill-calc-total-label">Total Tagihan</div>
            <div className="bill-calc-total-val">{formatRupiah(totalAmountNum)}</div>
          </div>

          <div className="bill-calc-split-grid">
            <div className="bill-calc-paid-box">
              <div className="bill-calc-paid-label">Terbayar</div>
              <div className="bill-calc-paid-val">{formatRupiah(paidAmountNum)}</div>
            </div>

            <div
              className={`bill-calc-remaining-box ${remainingAmountNum > 0 ? 'has-balance' : 'no-balance'}`}
            >
              <div className="bill-calc-remaining-label">Sisa Tagihan</div>
              <div className="bill-calc-remaining-val">{formatRupiah(remainingAmountNum)}</div>
            </div>
          </div>

          {/* Progress Bar */}
          <div>
            <div className="bill-progress-header">
              <span>Progres Pelunasan</span>
              <span style={{ fontWeight: 600 }}>{percentPaid}%</span>
            </div>
            <div className="bill-progress-track">
              <div
                className="bill-progress-fill"
                style={{
                  width: `${clampedPercent}%`,
                  background: formData.status === 'paid' ? '#10b981' : '#f59e0b',
                }}
              />
            </div>
          </div>

          <div className="bill-status-footer-row">
            <span style={{ color: 'var(--text-muted, #64748b)' }}>Status Saat Ini</span>
            <span
              className={`bill-status-pill ${
                formData.status === 'paid'
                  ? 'paid'
                  : formData.status === 'partial'
                    ? 'partial'
                    : 'unpaid'
              }`}
            >
              {formData.status === 'paid'
                ? 'LUNAS'
                : formData.status === 'partial'
                  ? 'BAYAR SEBAGIAN'
                  : 'BELUM LUNAS'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

BillSummaryCard.displayName = 'BillSummaryCard';
