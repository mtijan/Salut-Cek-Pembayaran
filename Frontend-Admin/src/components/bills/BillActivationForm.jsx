import React, { useMemo, useState } from 'react';
import { AlertTriangle, Power } from 'lucide-react';
import { billsApi } from '../../services/billsApi';
import { formatRupiah } from '../../utils/currency';
import {
  buildActivationScope,
  validateActivationScope,
} from '../../features/billing/model/billActivationModel';

export default function BillActivationForm({
  targetBill = null,
  fixedPeriod = '',
  initialProdi = '',
  initialIsActive = false,
  periods = [],
  prodis = [],
  requireProdi = false,
  presentation = 'modal',
  onApplied,
  onCancel,
}) {
  const [period, setPeriod] = useState(targetBill?.period || fixedPeriod || '');
  const [studyProgramId, setStudyProgramId] = useState(initialProdi || '');
  const [isActive, setIsActive] = useState(targetBill ? !targetBill.is_active : initialIsActive);
  const [mode, setMode] = useState('with_replacement');
  const [replacementPeriod, setReplacementPeriod] = useState('');
  const [confirmAllPrograms, setConfirmAllPrograms] = useState(false);
  const [reason, setReason] = useState('');
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const isIndividual = Boolean(targetBill);
  const isPage = presentation === 'page';
  const desiredLabel = isActive ? 'Aktifkan' : 'Nonaktifkan';
  const availableReplacements = useMemo(
    () => periods.filter((item) => item.code !== period),
    [period, periods],
  );
  const scopePayload = buildActivationScope({
    period,
    studyProgramId,
    isActive,
    mode,
    replacementPeriod,
    confirmAllPrograms,
  });

  const resetPreview = () => {
    setPreview(null);
    setError('');
  };

  const handlePreview = async () => {
    const validationError = validateActivationScope(scopePayload, { requireProdi });
    if (validationError) {
      setError(validationError);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await billsApi.previewActivation(scopePayload);
      setPreview(result);
    } catch (requestError) {
      setError(requestError.message || 'Gagal memuat preview aktivasi tagihan.');
      setPreview(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!reason.trim()) {
      setError('Alasan perubahan aktivasi wajib diisi.');
      return;
    }
    if (!isIndividual && !preview) {
      setError('Tampilkan dan periksa preview sebelum melanjutkan.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = isIndividual
        ? await billsApi.updateActivation(targetBill.id, {
            is_active: isActive,
            reason: reason.trim(),
          })
        : await billsApi.bulkUpdateActivation({ ...scopePayload, reason: reason.trim() });
      await onApplied?.(result);
      onCancel?.();
    } catch (requestError) {
      setError(requestError.message || 'Gagal memperbarui aktivasi tagihan.');
    } finally {
      setLoading(false);
    }
  };

  const summary = preview?.summary;
  return (
    <form
      className={isPage ? 'activation-page-form' : 'activation-modal-form'}
      onSubmit={handleSubmit}
    >
      <div className={isPage ? 'activation-page-form-body' : 'modal-body'}>
        {isIndividual ? (
          <div className="modal-alert-warning">
            <AlertTriangle size={16} />
            <span>
              {desiredLabel} tagihan {targetBill.period} milik{' '}
              <strong>{targetBill.student_name || targetBill.full_name}</strong> sebesar{' '}
              <strong>{targetBill.amount_formatted || formatRupiah(targetBill.amount)}</strong>.
            </span>
          </div>
        ) : (
          <>
            {isPage && (
              <div className="activation-page-intro">
                <Power size={20} />
                <div>
                  <strong>Tentukan ruang lingkup perubahan dengan hati-hati</strong>
                  <p>
                    Pilih periode, program studi, dan aksi. Sistem tidak akan mengubah data sebelum
                    preview ditampilkan dan Anda memberikan alasan.
                  </p>
                </div>
              </div>
            )}
            <div className="form-grid-2 activation-form-grid">
              <label className="form-group">
                <span>Periode Tagihan</span>
                <select
                  className="form-control"
                  aria-label="Periode Tagihan"
                  value={period}
                  disabled={Boolean(fixedPeriod)}
                  onChange={(event) => {
                    setPeriod(event.target.value);
                    resetPreview();
                  }}
                >
                  <option value="">Pilih periode</option>
                  {periods.map((item) => (
                    <option key={item.id} value={item.code}>
                      {item.name} ({item.code})
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-group">
                <span>Program Studi</span>
                <select
                  className="form-control"
                  aria-label="Program Studi"
                  value={studyProgramId}
                  disabled={Boolean(initialProdi && requireProdi)}
                  onChange={(event) => {
                    setStudyProgramId(event.target.value);
                    setConfirmAllPrograms(false);
                    resetPreview();
                  }}
                >
                  <option value="">Semua program studi</option>
                  {prodis.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-group">
                <span>Aksi</span>
                <select
                  className="form-control"
                  aria-label="Aksi Aktivasi"
                  value={isActive ? 'active' : 'inactive'}
                  onChange={(event) => {
                    setIsActive(event.target.value === 'active');
                    resetPreview();
                  }}
                >
                  <option value="inactive">Nonaktifkan tagihan</option>
                  <option value="active">Aktifkan kembali tagihan</option>
                </select>
              </label>
              {!isActive && (
                <label className="form-group">
                  <span>Mode Scope</span>
                  <select
                    className="form-control"
                    aria-label="Mode Scope"
                    value={mode}
                    onChange={(event) => {
                      setMode(event.target.value);
                      resetPreview();
                    }}
                  >
                    <option value="with_replacement">Hanya yang punya tagihan pengganti</option>
                    <option value="all">Semua tagihan pada scope</option>
                  </select>
                </label>
              )}
              {!isActive && mode === 'with_replacement' && (
                <label className="form-group">
                  <span>Periode Pengganti</span>
                  <select
                    className="form-control"
                    aria-label="Periode Pengganti"
                    value={replacementPeriod}
                    onChange={(event) => {
                      setReplacementPeriod(event.target.value);
                      resetPreview();
                    }}
                  >
                    <option value="">Pilih periode pengganti</option>
                    {availableReplacements.map((item) => (
                      <option key={item.id} value={item.code}>
                        {item.name} ({item.code})
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            {!studyProgramId && (
              <label className="checkbox-row activation-all-programs-confirm">
                <input
                  type="checkbox"
                  checked={confirmAllPrograms}
                  onChange={(event) => {
                    setConfirmAllPrograms(event.target.checked);
                    resetPreview();
                  }}
                />
                <span>Saya memahami aksi ini mencakup semua program studi.</span>
              </label>
            )}
            <div className="activation-preview-action">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handlePreview}
                disabled={loading}
              >
                {loading ? 'Menghitung...' : 'Tampilkan Preview Dampak'}
              </button>
              <span>Preview wajib diperiksa sebelum perubahan massal dapat disimpan.</span>
            </div>
            {summary && (
              <div className="bills-summary-banner activation-preview-summary">
                <span>
                  <strong>{summary.total_count}</strong> tagihan /{' '}
                  <strong>{summary.student_count}</strong> mahasiswa
                </span>
                <span>
                  {summary.paid_count} lunas, {summary.partial_count} sebagian,{' '}
                  {summary.unpaid_count} belum lunas
                </span>
                <span>
                  Sisa historis: <strong>{formatRupiah(summary.total_remaining)}</strong>
                </span>
              </div>
            )}
          </>
        )}
        <label className="form-group form-group-no-mb activation-reason-field">
          <span>
            Alasan Perubahan <span className="text-danger">*</span>
          </span>
          <textarea
            className="form-control"
            rows={isPage ? 5 : 3}
            maxLength={500}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Contoh: Periode lama ditutup setelah tagihan semester baru diterbitkan"
          />
        </label>
        {error && <p className="field-error-text">{error}</p>}
      </div>
      <div className={isPage ? 'activation-page-actions' : 'modal-footer'}>
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={loading}>
          Batal
        </button>
        <button
          type="submit"
          className={isActive ? 'btn btn-primary' : 'btn btn-danger'}
          disabled={loading || (!isIndividual && !preview)}
        >
          {loading ? 'Memproses...' : `${desiredLabel} Tagihan`}
        </button>
      </div>
    </form>
  );
}

BillActivationForm.displayName = 'BillActivationForm';
