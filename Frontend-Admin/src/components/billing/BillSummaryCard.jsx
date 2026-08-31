import React from 'react';
import {
  Check,
  Copy,
  CreditCard,
  GraduationCap,
  ShieldCheck,
  FileSpreadsheet,
} from 'lucide-react';
import { formatRupiah } from '../../utils/currency';

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
      <div className="panel-card bill-id-card">
        <div className="bill-id-header">
          <div className="bill-avatar-badge">
            {(formData.full_name || 'M').charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="bill-student-name-heading text-truncate">
              {formData.full_name || (isCreate ? 'Pilih Mahasiswa' : 'Nama Mahasiswa')}
            </h3>
            <div className="bill-nim-subrow">
              <span className="bill-nim-text mono-font">{formData.nim || '-'}</span>
              {formData.nim && (
                <button
                  type="button"
                  onClick={() => onCopyNim(formData.nim, 'NIM')}
                  className="copy-btn-inline"
                  title="Salin NIM"
                >
                  {copiedKey === 'NIM' ? (
                    <Check size={12} color="var(--success)" />
                  ) : (
                    <Copy size={12} />
                  )}
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="bill-info-list">
          <div className="bill-info-item">
            <span className="bill-info-label">
              <GraduationCap size={13} className="info-icon-inline" />
              Program Studi
            </span>
            <span className="bill-info-value">
              {studentData.study_program_name || studentData.prodi_name || '-'}
            </span>
          </div>
          <div className="bill-info-item">
            <span className="bill-info-label">
              <ShieldCheck size={13} className="info-icon-inline" />
              Status Akademik
            </span>
            <span
              className={`badge badge-sm ${studentData.academic_status === 'aktif' ? 'badge-success' : 'badge-warning'}`}
            >
              {studentData.academic_status || 'Aktif'}
            </span>
          </div>
          <div className="bill-info-item">
            <span className="bill-info-label">
              <FileSpreadsheet size={13} className="info-icon-inline" />
              Sumber Entri
            </span>
            <span className="bill-info-value mono-font cell-xs">
              {billData.source_file || (isCreate ? 'Manual Admin' : 'Manual')}
            </span>
          </div>
        </div>
      </div>

      {/* Financial Summary Card */}
      <div className="panel-card bill-calc-summary-card">
        <h4 className="bill-calc-title">
          <CreditCard size={16} className="text-brand" />
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
          <div className="bill-progress-wrap">
            <div className="bill-progress-header">
              <span>Progres Pelunasan</span>
              <span className="font-bold">{percentPaid}%</span>
            </div>
            <div className="bill-progress-track">
              <div
                className={`bill-progress-fill ${formData.status === 'paid' ? 'paid' : 'partial'}`}
                style={{ width: `${clampedPercent}%` }}
              />
            </div>
          </div>

          <div className="bill-status-footer-row">
            <span className="text-muted">Status Saat Ini</span>
            <span
              className={`badge badge-sm ${
                formData.status === 'paid'
                  ? 'badge-success'
                  : formData.status === 'partial'
                    ? 'badge-warning'
                    : 'badge-danger'
              }`}
            >
              {formData.status === 'paid'
                ? 'LUNAS (PAID)'
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
