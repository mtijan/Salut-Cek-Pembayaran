import React, { useState, useEffect } from 'react';
import { X, AlertTriangle } from 'lucide-react';

export default function ConfirmModal({
  isOpen,
  title = 'Konfirmasi Penghapusan',
  description = 'Apakah Anda yakin ingin menghapus data ini?',
  confirmText = 'Hapus Data',
  onConfirm,
  onClose,
}) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setReason('');
      setError('');
      setSubmitting(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('Alasan penghapusan wajib diisi untuk audit log.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await onConfirm(reason.trim());
      onClose();
    } catch (err) {
      setError(err.message || 'Gagal memproses aksi.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
      >
        <div className="modal-header">
          <div className="confirm-modal-header-left">
            <div className="confirm-modal-header-icon">
              <AlertTriangle size={20} />
            </div>
            <h2 id="confirm-modal-title">{title}</h2>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Tutup">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <p className="confirm-modal-desc">{description}</p>

            <div className="form-group form-group-no-mb">
              <label htmlFor="confirm-reason">
                Alasan Penghapusan <span className="text-danger">*</span>
              </label>
              <textarea
                id="confirm-reason"
                className="form-control"
                rows={3}
                placeholder="Contoh: Kesalahan input nominal dari excel cabang"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
                autoFocus
              />
              {error && <p className="field-error-text">{error}</p>}
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={submitting}
            >
              Batal
            </button>
            <button type="submit" className="btn btn-danger" disabled={submitting}>
              {submitting ? 'Memproses...' : confirmText}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

ConfirmModal.displayName = 'ConfirmModal';
