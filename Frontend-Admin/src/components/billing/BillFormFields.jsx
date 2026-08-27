import React from 'react';
import { Check, Copy, AlertCircle, RefreshCw, Save } from 'lucide-react';

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
 * Kolom kanan BillEditPage: form fields lengkap dan action buttons.
 * Props: semua field form state, handlers, dan data tampilan.
 */
export default function BillFormFields({
  isCreate,
  formData,
  setFormData,
  formError,
  periods,
  students,
  loadedStudent,
  totalAmountNum,
  paidAmountNum,
  remainingAmountNum,
  copiedKey,
  onCopyBriva,
  saving,
  onSubmit,
  onCancel,
  handleStudentSelect,
  handleStatusChange,
  handleAmountChange,
  handlePaidAmountChange,
  canManage,
}) {
  const studentData = loadedStudent || {};

  return (
    <div className="bill-form-main-card">
      <form onSubmit={onSubmit}>
        {/* Form Header */}
        <div className="bill-form-top-bar">
          <div>
            <h3
              style={{
                fontSize: '17px',
                fontWeight: 700,
                margin: 0,
                color: 'var(--text-main, #111827)',
              }}
            >
              {isCreate ? 'Formulir Tagihan Baru' : 'Formulir Edit Data Tagihan'}
            </h3>
            <p
              style={{ fontSize: '13px', color: 'var(--text-muted, #6b7280)', margin: '4px 0 0 0' }}
            >
              Lengkapi seluruh informasi tagihan dengan teliti untuk sinkronisasi sistem keuangan.
            </p>
          </div>
          <span className={`bill-form-mode-badge ${isCreate ? 'create' : 'edit'}`}>
            {isCreate ? 'Mode Buat Baru' : 'Mode Perbarui'}
          </span>
        </div>

        {/* Error Alert */}
        {formError && (
          <div
            className="alert-box alert-danger"
            style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}
          >
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{formError}</span>
          </div>
        )}

        <div className="bill-fields-grid">
          {/* Student Picker (Create) or Read-Only (Edit) */}
          <div className="bill-field-full-col">
            <label className="bill-field-label">
              Mahasiswa Terkait <span className="bill-req-star">*</span>
            </label>
            {isCreate ? (
              <select
                className="form-control"
                value={formData.student_id}
                onChange={handleStudentSelect}
                required
              >
                <option value="">-- Pilih Mahasiswa Penerima Tagihan --</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nim} - {s.full_name} ({s.study_program_name || 'Umum'})
                  </option>
                ))}
              </select>
            ) : (
              <div className="bill-readonly-card">
                <div>
                  <div
                    style={{
                      fontWeight: 600,
                      color: 'var(--text-main, #0f172a)',
                      fontSize: '14px',
                    }}
                  >
                    {studentData.full_name || formData.full_name}
                  </div>
                  <div
                    style={{
                      fontSize: '12px',
                      color: 'var(--text-muted, #64748b)',
                      marginTop: '2px',
                    }}
                  >
                    NIM:{' '}
                    <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                      {studentData.nim || formData.nim}
                    </span>{' '}
                    &bull; {studentData.study_program_name || 'Program Studi'}
                  </div>
                </div>
                <span className="bill-readonly-badge">
                  Terkunci (Read-Only)
                </span>
              </div>
            )}
          </div>

          {/* Bill Type */}
          <div>
            <label className="bill-field-label">
              Jenis Tagihan <span className="bill-req-star">*</span>
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <select
                className="form-control"
                value={formData.bill_type_mode}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, bill_type_mode: e.target.value }))
                }
                style={{ flex: 1 }}
              >
                <option value="UKT">UKT (Uang Kuliah Tunggal)</option>
                <option value="WISUDA">WISUDA</option>
                <option value="PRAKTIKUM">PRAKTIKUM</option>
                <option value="REGISTRASI">REGISTRASI AWAL</option>
                <option value="Custom">Custom / Lainnya</option>
              </select>
              {formData.bill_type_mode === 'Custom' && (
                <input
                  type="text"
                  className="form-control"
                  placeholder="Nama jenis tagihan..."
                  value={formData.custom_bill_type}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, custom_bill_type: e.target.value }))
                  }
                  required
                  style={{ flex: 1 }}
                />
              )}
            </div>
          </div>

          {/* Academic Period */}
          <div>
            <label className="bill-field-label">
              Periode Tagihan <span className="bill-req-star">*</span>
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <select
                className="form-control"
                value={formData.period_mode === 'custom' ? 'custom' : formData.period}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === 'custom') {
                    setFormData((prev) => ({ ...prev, period_mode: 'custom' }));
                  } else {
                    setFormData((prev) => ({ ...prev, period_mode: 'master', period: val }));
                  }
                }}
                style={{ flex: 1 }}
              >
                {periods.map((p) => (
                  <option key={p.id} value={p.code}>
                    {p.name} ({p.code})
                  </option>
                ))}
                <option value="custom">+ Entri Periode Kustom</option>
              </select>
              {formData.period_mode === 'custom' && (
                <input
                  type="text"
                  className="form-control"
                  placeholder="Contoh: 2026.1 atau 20261"
                  value={formData.custom_period}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, custom_period: e.target.value }))
                  }
                  required
                  style={{ flex: 1 }}
                />
              )}
            </div>
          </div>

          {/* Total Amount */}
          <div>
            <label className="bill-field-label">
              Total Nominal Tagihan (Rp) <span className="bill-req-star">*</span>
            </label>
            <div className="bill-currency-input-container">
              <span className="bill-currency-prefix-tag">Rp</span>
              <input
                type="number"
                className="form-control bill-currency-field"
                value={formData.amount}
                onChange={handleAmountChange}
                placeholder="Contoh: 1500000"
                min="1"
                required
              />
            </div>
          </div>

          {/* BRIVA */}
          <div>
            <label className="bill-field-label">
              Nomor Rekening BRIVA <span className="bill-req-star">*</span>
            </label>
            <div style={{ display: 'flex', gap: '6px' }}>
              <input
                type="text"
                className="form-control"
                value={formData.briva}
                onChange={(e) => setFormData((prev) => ({ ...prev, briva: e.target.value }))}
                placeholder="Contoh: 178100012345"
                required
                style={{
                  flex: 1,
                  fontFamily: 'monospace',
                  fontWeight: 600,
                }}
              />
              {formData.briva && (
                <button
                  type="button"
                  onClick={() => onCopyBriva(formData.briva, 'BRIVA')}
                  className="btn btn-secondary"
                  style={{ padding: '0 12px', borderRadius: '8px' }}
                  title="Salin BRIVA"
                >
                  {copiedKey === 'BRIVA' ? (
                    <Check size={15} style={{ color: 'var(--brand-primary, #059669)' }} />
                  ) : (
                    <Copy size={15} />
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Due Date */}
          <div>
            <label className="bill-field-label">
              Batas Pembayaran / Jatuh Tempo
            </label>
            <input
              type="date"
              className="form-control"
              value={formData.due_date}
              onChange={(e) => setFormData((prev) => ({ ...prev, due_date: e.target.value }))}
            />
          </div>

          {/* Status */}
          <div>
            <label className="bill-field-label">
              Status Pembayaran <span className="bill-req-star">*</span>
            </label>
            <select
              className="form-control"
              value={formData.status}
              onChange={(e) => handleStatusChange(e.target.value)}
              style={{ fontWeight: 600 }}
            >
              <option value="unpaid">Belum Lunas (Unpaid)</option>
              <option value="partial">Bayar Sebagian (Partial)</option>
              <option value="paid">Lunas (Paid)</option>
            </select>
          </div>

          {/* Paid Amount */}
          <div>
            <label className="bill-field-label">
              Nominal Sudah Terbayar (Rp)
            </label>
            <div className="bill-currency-input-container">
              <span className="bill-currency-prefix-tag">Rp</span>
              <input
                type="number"
                className="form-control bill-currency-field"
                value={formData.paid_amount}
                onChange={handlePaidAmountChange}
                disabled={formData.status === 'unpaid' || formData.status === 'paid'}
                placeholder="0"
                min="0"
                max={totalAmountNum}
                style={{
                  background:
                    formData.status === 'unpaid' || formData.status === 'paid'
                      ? 'var(--bg-secondary, #f3f4f6)'
                      : '#ffffff',
                }}
              />
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted, #6b7280)', marginTop: '4px' }}>
              {formData.status === 'partial'
                ? 'Masukkan nominal cicilan yang sudah dibayarkan mahasiswa'
                : formData.status === 'paid'
                  ? 'Otomatis bernilai penuh sesuai total tagihan'
                  : 'Bernilai 0 saat status Belum Lunas'}
            </div>
          </div>

          {/* Live Calculation Preview */}
          <div
            className={`bill-live-calc-box ${
              formData.status === 'paid'
                ? 'paid'
                : formData.status === 'partial'
                  ? 'partial'
                  : 'unpaid'
            }`}
          >
            <div>
              <div
                style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--text-muted, #64748b)',
                }}
              >
                Kalkulasi Sisa Tagihan Real-Time
              </div>
              <div
                style={{
                  fontSize: '14px',
                  fontWeight: 700,
                  color: 'var(--text-main, #0f172a)',
                  marginTop: '2px',
                }}
              >
                {formatRupiah(totalAmountNum)} - {formatRupiah(paidAmountNum)} ={' '}
                <span style={{ color: remainingAmountNum > 0 ? '#b45309' : '#15803d' }}>
                  {formatRupiah(remainingAmountNum)}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted, #64748b)' }}>
                Status Akhir:
              </span>
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

          {/* Instructions */}
          <div className="bill-field-full-col">
            <label className="bill-field-label">
              Petunjuk Pembayaran / Catatan
            </label>
            <textarea
              className="form-control"
              rows={3}
              value={formData.instructions}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, instructions: e.target.value }))
              }
              placeholder="Petunjuk cara pembayaran untuk mahasiswa..."
              style={{
                width: '100%',
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="bill-form-actions-row">
          <button
            type="button"
            onClick={onCancel}
            className="btn btn-secondary"
            disabled={saving}
          >
            Batal
          </button>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={saving || !canManage}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            {saving ? (
              <>
                <RefreshCw size={16} className="spin" />
                <span>Menyimpan...</span>
              </>
            ) : (
              <>
                <Save size={16} />
                <span>{isCreate ? 'Buat Tagihan Mahasiswa' : 'Simpan Perubahan Tagihan'}</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

BillFormFields.displayName = 'BillFormFields';
