import React, { useState } from 'react';
import { X, KeyRound } from 'lucide-react';

export default function ResetPasswordModal({
  isOpen,
  onClose,
  targetUser,
  error,
  saving,
  onSubmit,
}) {
  const [password, setPassword] = useState('');

  if (!isOpen || !targetUser) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(password, () => setPassword(''));
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()} role="dialog">
        <div className="modal-header">
          <h2>
            <KeyRound size={18} className="modal-title-icon" />
            Reset Password Admin
          </h2>
          <button type="button" className="modal-close-btn" onClick={onClose}>
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
              <label>Password Baru * (Min 8 karakter)</label>
              <input
                type="password"
                className="form-control"
                placeholder="Masukkan password baru"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
                autoFocus
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
