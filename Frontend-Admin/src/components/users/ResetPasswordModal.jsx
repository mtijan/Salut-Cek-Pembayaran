import React, { useEffect, useState } from 'react';
import { X, KeyRound } from 'lucide-react';
import { useDialogAccessibility } from '../../hooks/useDialogAccessibility.js';

export default function ResetPasswordModal({
  isOpen,
  onClose,
  targetUser,
  error,
  saving,
  onSubmit,
}) {
  const [password, setPassword] = useState('');
  const dialogRef = useDialogAccessibility(isOpen, onClose);

  useEffect(() => {
    if (!isOpen) setPassword('');
  }, [isOpen]);

  if (!isOpen || !targetUser) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(password, () => setPassword(''));
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        ref={dialogRef}
        className="modal-dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reset-password-modal-title"
        tabIndex={-1}
      >
        <div className="modal-header">
          <h2 id="reset-password-modal-title">
            <KeyRound size={18} className="modal-title-icon" />
            Reset Password Admin
          </h2>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Tutup dialog reset password"
          >
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="modal-alert-danger">{error}</div>}

            <p className="modal-desc-text">
              Mereset password untuk akun <strong>{targetUser.email}</strong> (
              {targetUser.full_name || 'Tanpa Nama'}). Seluruh session aktif pengguna ini akan
              otomatis dicabut.
            </p>

            <div className="form-group">
              <label htmlFor="reset-admin-password">Password Baru * (Min 8 karakter)</label>
              <input
                id="reset-admin-password"
                type="password"
                className="form-control"
                placeholder="Masukkan password baru"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
              Batal
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving || password.length < 8}
            >
              {saving ? 'Mereset...' : 'Reset Password & Cabut Session'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

ResetPasswordModal.displayName = 'ResetPasswordModal';
