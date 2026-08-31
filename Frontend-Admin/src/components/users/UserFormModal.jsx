import React from 'react';
import { X } from 'lucide-react';
import { useDialogAccessibility } from '../../hooks/useDialogAccessibility.js';

export default function UserFormModal({
  isOpen,
  onClose,
  editingUser,
  form,
  setForm,
  error,
  saving,
  onSubmit,
}) {
  const dialogRef = useDialogAccessibility(isOpen, onClose);
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        ref={dialogRef}
        className="modal-dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="user-form-modal-title"
        tabIndex={-1}
      >
        <div className="modal-header">
          <h2 id="user-form-modal-title">
            {editingUser ? 'Edit Akun Administrator' : 'Tambah Administrator Baru'}
          </h2>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Tutup dialog pengguna"
          >
            <X size={20} />
          </button>
        </div>
        <form onSubmit={onSubmit}>
          <div className="modal-body">
            {error && <div className="modal-alert-danger">{error}</div>}

            <div className="form-group">
              <label htmlFor="admin-user-email">Email *</label>
              <input
                id="admin-user-email"
                type="email"
                className="form-control"
                placeholder="nama@salut.id"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                disabled={Boolean(editingUser)}
                required
              />
              {editingUser && (
                <small className="form-hint">Email akun administrator tidak dapat diubah.</small>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="admin-user-name">Nama Lengkap</label>
              <input
                id="admin-user-name"
                type="text"
                className="form-control"
                placeholder="Contoh: Budi Santoso"
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label htmlFor="admin-user-role">Role Akses *</label>
              <select
                id="admin-user-role"
                className="form-control"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
              >
                <option value="viewer">Viewer (Hanya Melihat Data &amp; Laporan)</option>
                <option value="admin_akademik">
                  Admin Akademik (Kelola Mahasiswa &amp; Master Data)
                </option>
                <option value="admin_keuangan">
                  Admin Keuangan (Kelola Tagihan &amp; Import Excel)
                </option>
                <option value="admin">Admin (Akademik + Keuangan)</option>
                <option value="super_admin">Super Admin (Akses Penuh + Kelola Pengguna)</option>
              </select>
            </div>

            {!editingUser && (
              <div className="form-group">
                <label htmlFor="admin-user-password">Password Awal * (Min 8 karakter)</label>
                <input
                  id="admin-user-password"
                  type="password"
                  className="form-control"
                  placeholder="Masukkan password aman"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  minLength={8}
                  required
                />
              </div>
            )}

            <div className="form-group">
              <label className="checkbox-label-row">
                <input
                  type="checkbox"
                  checked={Boolean(form.is_active)}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked ? 1 : 0 })}
                />
                <span>Akun Administrator Aktif</span>
              </label>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
              Batal
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Menyimpan...' : editingUser ? 'Simpan Perubahan' : 'Buat Akun Admin'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

UserFormModal.displayName = 'UserFormModal';
