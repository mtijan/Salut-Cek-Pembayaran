import React, { useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  FileText,
  GraduationCap,
  Power,
  PowerOff,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { billsApi } from '../../services/billsApi';
import { formatRupiah } from '../../utils/currency';
import {
  buildActivationScope,
  validateActivationScope,
} from '../../features/billing/model/billActivationModel';

const BULK_REASON_PRESETS = [
  'Penutupan Periode Lama',
  'Penerbitan Tagihan Semester Baru',
  'Koreksi Administrasi Tagihan',
  'Pengaktifan Kembali Tagihan Periode Berjalan',
];

const INDIVIDUAL_REASON_PRESETS = [
  'Pengajuan Cuti Akademik Mahasiswa',
  'Koreksi Tagihan Ganda / Salah Input',
  'Penyesuaian Biaya Kuliah',
  'Pengaktifan Kembali Tagihan Mahasiswa',
];

export default function BillActivationForm({
  targetBill = null,
  fixedPeriod = '',
  initialProdi = '',
  initialIsActive = false,
  periods = [],
  prodis = [],
  presentation = 'modal',
  onApplied,
  onCancel,
}) {
  const isIndividual = Boolean(targetBill);
  const isCurrentlyActive = targetBill
    ? targetBill.is_active === true || targetBill.is_active === 1
    : null;

  const [period, setPeriod] = useState(targetBill?.period || fixedPeriod || '');
  const [studyProgramId, setStudyProgramId] = useState(initialProdi || '');
  const [isActive, setIsActive] = useState(targetBill ? !isCurrentlyActive : initialIsActive);
  const [confirmAllPrograms, setConfirmAllPrograms] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const isPage = presentation === 'page';
  const desiredLabel = isActive ? 'Aktifkan Kembali' : 'Nonaktifkan';
  const presets = isIndividual ? INDIVIDUAL_REASON_PRESETS : BULK_REASON_PRESETS;

  const scopePayload = buildActivationScope({
    period,
    studyProgramId,
    isActive,
    confirmAllPrograms,
  });

  const selectedPeriodObj = periods.find((p) => p.code === period);
  const selectedProdiObj = prodis.find((p) => p.id === studyProgramId);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (!isIndividual) {
      const validationError = validateActivationScope(scopePayload);
      if (validationError) {
        setError(validationError);
        return;
      }
    }

    if (!reason.trim()) {
      setError('Alasan perubahan aktivasi wajib diisi untuk pencatatan audit log.');
      return;
    }

    setLoading(true);
    try {
      const result = isIndividual
        ? await billsApi.updateActivation(targetBill.id, {
            is_active: isActive,
            reason: reason.trim(),
          })
        : await billsApi.bulkUpdateActivation({
            ...scopePayload,
            reason: reason.trim(),
          });
      await onApplied?.(result, isActive);
      onCancel?.();
    } catch (requestError) {
      setError(requestError.message || 'Gagal memperbarui status aktivasi tagihan.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      className={`activation-unified-form ${isPage ? 'activation-form-page-mode' : 'activation-form-modal-mode'}`}
      onSubmit={handleSubmit}
    >
      <div className={isPage ? 'activation-page-body' : 'activation-modal-body'}>
        {isIndividual ? (
          /* ================= INDIVIDUAL BILL VIEW ================= */
          <div className="activation-individual-section">
            <div
              className={`activation-status-hero-card ${isCurrentlyActive ? 'hero-card-active' : 'hero-card-inactive'}`}
            >
              <div className="hero-card-icon-wrap">
                {isCurrentlyActive ? (
                  <CheckCircle2 size={24} className="hero-icon-active" />
                ) : (
                  <AlertTriangle size={24} className="hero-icon-inactive" />
                )}
              </div>
              <div className="hero-card-text">
                <span className="hero-card-badge">
                  {isCurrentlyActive ? 'Status Saat Ini: Aktif' : 'Status Saat Ini: Nonaktif'}
                </span>
                <p className="hero-card-desc">
                  Tindakan ini akan <strong>{desiredLabel.toLowerCase()}</strong> tagihan mahasiswa
                  ini.
                  {isActive
                    ? ' Tagihan akan kembali muncul di pencarian publik dan dapat menerima pembayaran.'
                    : ' Tagihan akan disembunyikan dari publik dan tidak dapat menerima pembayaran baru.'}
                </p>
              </div>
            </div>

            <div className="activation-bill-detail-card">
              <div className="bill-detail-header-row">
                <div className="bill-detail-avatar">
                  {(targetBill.student_name || targetBill.full_name || 'M').charAt(0).toUpperCase()}
                </div>
                <div>
                  <h4 className="bill-detail-student-name">
                    {targetBill.student_name || targetBill.full_name || '-'}
                  </h4>
                  <div className="bill-detail-submeta">
                    <span className="font-mono-600">
                      NIM: {targetBill.student_nim || targetBill.nim || '-'}
                    </span>
                    {targetBill.study_program_name && (
                      <span>&bull; {targetBill.study_program_name}</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="bill-detail-grid-3">
                <div className="detail-stat-box">
                  <span className="detail-stat-label">Periode &amp; Jenis</span>
                  <strong className="detail-stat-val">{targetBill.period || '-'}</strong>
                  <span className="detail-stat-sub">{targetBill.bill_type || 'UKT'}</span>
                </div>
                <div className="detail-stat-box">
                  <span className="detail-stat-label">Nominal Tagihan</span>
                  <strong className="detail-stat-val text-brand-dark">
                    {targetBill.amount_formatted || formatRupiah(targetBill.amount)}
                  </strong>
                  <span className="detail-stat-sub">BRIVA: {targetBill.briva || '-'}</span>
                </div>
                <div className="detail-stat-box">
                  <span className="detail-stat-label">Status Pembayaran</span>
                  <div>
                    <span
                      className={`badge mt-1 ${
                        targetBill.status === 'paid'
                          ? 'badge-success'
                          : targetBill.status === 'partial'
                            ? 'badge-warning'
                            : 'badge-danger'
                      }`}
                    >
                      {targetBill.status === 'paid'
                        ? 'Lunas'
                        : targetBill.status === 'partial'
                          ? 'Sebagian'
                          : 'Belum Bayar'}
                    </span>
                  </div>
                  {targetBill.paid_amount > 0 && (
                    <span className="detail-stat-sub">
                      Terbayar:{' '}
                      {targetBill.paid_amount_formatted || formatRupiah(targetBill.paid_amount)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* ================= BULK ACTIVATION VIEW ================= */
          <div className="activation-bulk-sections">
            {/* STEP 1: SCOPE TARGET */}
            <div className="activation-step-block">
              <div className="step-block-header">
                <div className="step-number-badge">1</div>
                <div className="step-title-col">
                  <h3 className="step-block-title">Target Tagihan</h3>
                  <p className="step-block-desc">
                    Tentukan periode akademik dan cakupan program studi sasaran.
                  </p>
                </div>
              </div>

              <div className="activation-fields-grid">
                <div className="form-group-modern">
                  <label className="modern-field-label">
                    <Calendar size={14} className="text-brand" />
                    <span>Periode Tagihan</span>
                    <span className="text-danger">*</span>
                  </label>
                  <div className="modern-select-wrap">
                    <select
                      className="modern-select-input"
                      aria-label="Periode Tagihan"
                      value={period}
                      disabled={Boolean(fixedPeriod)}
                      onChange={(event) => {
                        setPeriod(event.target.value);
                        setError('');
                      }}
                    >
                      <option value="">Pilih periode akademik...</option>
                      {periods.map((item) => (
                        <option key={item.id} value={item.code}>
                          {item.name} ({item.code})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-group-modern">
                  <label className="modern-field-label">
                    <GraduationCap size={14} className="text-brand" />
                    <span>Program Studi</span>
                  </label>
                  <div className="modern-select-wrap">
                    <select
                      className="modern-select-input"
                      aria-label="Program Studi"
                      value={studyProgramId}
                      onChange={(event) => {
                        setStudyProgramId(event.target.value);
                        setConfirmAllPrograms(false);
                        setError('');
                      }}
                    >
                      <option value="">Semua Program Studi (Seluruh Mahasiswa)</option>
                      {prodis.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Confirmation Callout for All Programs */}
              {!studyProgramId && (
                <div className="all-programs-warning-card">
                  <div className="warning-card-left">
                    <ShieldAlert size={20} className="warning-card-icon" />
                  </div>
                  <div className="warning-card-content">
                    <div className="warning-card-title">Cakupan Seluruh Program Studi</div>
                    <p className="warning-card-desc">
                      Aksi ini akan dieksekusi untuk <strong>seluruh mahasiswa</strong> pada periode
                      terpilih tanpa batasan program studi.
                    </p>
                    <label className="warning-checkbox-row">
                      <input
                        type="checkbox"
                        className="custom-checkbox-input"
                        checked={confirmAllPrograms}
                        onChange={(event) => {
                          setConfirmAllPrograms(event.target.checked);
                          setError('');
                        }}
                      />
                      <span className="warning-checkbox-text">
                        Saya mengonfirmasi bahwa aksi ini mencakup seluruh program studi.
                      </span>
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* STEP 2: ACTION SELECTION */}
            <div className="activation-step-block">
              <div className="step-block-header">
                <div className="step-number-badge">2</div>
                <div className="step-title-col">
                  <h3 className="step-block-title">Tindakan Aktivasi</h3>
                  <p className="step-block-desc">
                    Pilih status operasional yang ingin diterapkan pada seluruh tagihan target.
                  </p>
                </div>
              </div>

              <div className="action-cards-grid">
                {/* Deactivate Option */}
                <div
                  className={`action-option-card card-deactivate ${!isActive ? 'is-selected-action' : ''}`}
                  onClick={() => setIsActive(false)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setIsActive(false)}
                >
                  <div className="option-card-header">
                    <div className="option-card-icon icon-deactivate">
                      <PowerOff size={18} />
                    </div>
                    <div className="option-radio-dot">
                      {!isActive && <div className="radio-dot-inner dot-deactivate" />}
                    </div>
                  </div>
                  <div className="option-card-body">
                    <h4 className="option-card-title text-danger">Nonaktifkan Tagihan</h4>
                    <p className="option-card-desc">
                      Sembunyikan dari lookup publik dan tutup penerimaan pembayaran baru di kasir.
                    </p>
                  </div>
                  <div className="option-card-footer">
                    <span className="option-pill pill-deactivate">Pencarian Ditutup</span>
                  </div>
                </div>

                {/* Reactivate Option */}
                <div
                  className={`action-option-card card-activate ${isActive ? 'is-selected-action' : ''}`}
                  onClick={() => setIsActive(true)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setIsActive(true)}
                >
                  <div className="option-card-header">
                    <div className="option-card-icon icon-activate">
                      <Power size={18} />
                    </div>
                    <div className="option-radio-dot">
                      {isActive && <div className="radio-dot-inner dot-activate" />}
                    </div>
                  </div>
                  <div className="option-card-body">
                    <h4 className="option-card-title text-success">Aktifkan Kembali Tagihan</h4>
                    <p className="option-card-desc">
                      Pulihkan tagihan agar dapat dicari kembali oleh mahasiswa dan kasir dapat
                      menerima pembayaran.
                    </p>
                  </div>
                  <div className="option-card-footer">
                    <span className="option-pill pill-activate">Pencarian Dibuka</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3 (or Step 2 for individual): REASON AND AUDIT LOG */}
        <div className="activation-step-block">
          <div className="step-block-header">
            <div className="step-number-badge">{isIndividual ? '2' : '3'}</div>
            <div className="step-title-col">
              <h3 className="step-block-title">
                Alasan Perubahan <span className="text-danger">*</span>
              </h3>
              <p className="step-block-desc">
                Catat keterangan resmi untuk pertanggungjawaban audit trail sistem.
              </p>
            </div>
          </div>

          <div className="reason-presets-wrap">
            <span className="presets-label">Pilihan Cepat:</span>
            <div className="presets-chips">
              {presets.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className="preset-chip-btn"
                  onClick={() => {
                    setReason(preset);
                    if (error) setError('');
                  }}
                >
                  <Sparkles size={11} className="chip-sparkle-icon" />
                  <span>{preset}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="form-group-modern mt-1">
            <div className="modern-textarea-wrap">
              <textarea
                className="modern-textarea-input"
                rows={3}
                maxLength={500}
                value={reason}
                onChange={(event) => {
                  setReason(event.target.value);
                  if (error && event.target.value.trim()) setError('');
                }}
                placeholder={
                  isIndividual
                    ? 'Tuliskan alasan penonaktifan atau pengaktifan tagihan ini...'
                    : 'Tuliskan alasan perubahan status aktivasi massal untuk periode ini...'
                }
              />
              <div className="textarea-footer-meta">
                <span className="audit-note-text">
                  <FileText size={12} />
                  <span>Tersimpan secara permanen pada audit log.</span>
                </span>
                <span
                  className={`char-counter ${reason.length >= 480 ? 'text-danger font-bold' : ''}`}
                >
                  {reason.length} / 500 karakter
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Validation Error Alert */}
        {error && (
          <div className="activation-error-alert">
            <AlertCircle size={18} className="flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* FOOTER ACTIONS */}
      <div className={isPage ? 'activation-page-footer' : 'modal-footer activation-modal-footer'}>
        {isPage && (
          <div className="footer-scope-summary">
            <span className="scope-summary-label">Ringkasan Target:</span>
            <div className="scope-summary-tags">
              <span className={`badge-pill ${isActive ? 'pill-success' : 'pill-danger'}`}>
                {isActive ? 'Aktifkan Kembali' : 'Nonaktifkan'}
              </span>
              <span className="badge-pill pill-neutral">
                Periode: {selectedPeriodObj ? selectedPeriodObj.name : period || 'Belum dipilih'}
              </span>
              <span className="badge-pill pill-neutral">
                Prodi: {selectedProdiObj ? selectedProdiObj.name : 'Semua Prodi'}
              </span>
            </div>
          </div>
        )}

        <div className="footer-action-buttons">
          <button
            type="button"
            className="btn btn-secondary btn-action-cancel"
            onClick={onCancel}
            disabled={loading}
          >
            Batal
          </button>
          <button
            type="submit"
            className={`btn ${isActive ? 'btn-primary' : 'btn-danger'} btn-action-submit`}
            disabled={loading}
          >
            {loading ? (
              <span className="flex-row-gap-8">
                <span className="btn-spinner" />
                <span>Menyimpan...</span>
              </span>
            ) : (
              <span className="flex-row-gap-8">
                {isActive ? <Power size={16} /> : <PowerOff size={16} />}
                <span>{desiredLabel} Tagihan</span>
              </span>
            )}
          </button>
        </div>
      </div>
    </form>
  );
}

BillActivationForm.displayName = 'BillActivationForm';
