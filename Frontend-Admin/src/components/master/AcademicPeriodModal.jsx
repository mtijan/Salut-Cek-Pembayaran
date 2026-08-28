import React from 'react';
import { X } from 'lucide-react';

export default function AcademicPeriodModal({
  isOpen,
  onClose,
  editingPeriod,
  form,
  setForm,
  error,
  saving,
  onSubmit,
}) {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()} role="dialog">
        <div className="modal-header">
          <h2>{editingPeriod ? 'Edit Periode Akademik' : 'Tambah Periode Akademik'}</h2>
          <button type="button" className="modal-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <form onSubmit={onSubmit}>
          <div className="modal-body">
            {error && <div className="modal-alert-danger">{error}</div>}
            <div className="form-group">
              <label>Kode Semester *</label>
              <input
                type="text"
                className="form-control"
                placeholder="Contoh: 20251 atau 20252"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>Nama Periode / Semester *</label>
              <input
                type="text"
                className="form-control"
                placeholder="Contoh: Semester 2025/2026 Ganjil"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>Tipe Semester</label>
              <select
                className="form-control"
                value={form.semester_type}
                onChange={(e) => setForm({ ...form, semester_type: e.target.value })}
              >
                <option value="ganjil">Ganjil</option>
                <option value="genap">Genap</option>
                <option value="pendek">Pendek / Antara</option>
              </select>
            </div>
            <div className="form-group">
              <label>Batas Pembayaran Default</label>
              <input
                type="date"
                className="form-control"
                value={form.default_due_date}
                onChange={(e) => setForm({ ...form, default_due_date: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="checkbox-label-row">
                <input
                  type="checkbox"
                  checked={Boolean(form.is_active)}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked ? 1 : 0 })}
                />
                <span>Tetapkan sebagai Semester Aktif</span>
              </label>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
              Batal
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Menyimpan...' : 'Simpan Periode Akademik'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

AcademicPeriodModal.displayName = 'AcademicPeriodModal';
