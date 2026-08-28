import React from 'react';
import { X } from 'lucide-react';

export default function ProgramStudyModal({
  isOpen,
  onClose,
  editingProdi,
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
          <h2>{editingProdi ? 'Edit Program Studi' : 'Tambah Program Studi'}</h2>
          <button type="button" className="modal-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <form onSubmit={onSubmit}>
          <div className="modal-body">
            {error && <div className="modal-alert-danger">{error}</div>}
            <div className="form-group">
              <label>Kode Program Studi *</label>
              <input
                type="text"
                className="form-control"
                placeholder="Contoh: 311 (Ilmu Hukum)"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>Nama Program Studi *</label>
              <input
                type="text"
                className="form-control"
                placeholder="Contoh: S1 Ilmu Hukum"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>Jenjang Pendidikan</label>
              <select
                className="form-control"
                value={form.degree}
                onChange={(e) => setForm({ ...form, degree: e.target.value })}
              >
                <option value="D3">Diploma 3 (D3)</option>
                <option value="D4">Diploma 4 (D4)</option>
                <option value="S1">Sarjana (S1)</option>
                <option value="S2">Magister (S2)</option>
              </select>
            </div>
            <div className="form-group">
              <label>Fakultas</label>
              <input
                type="text"
                className="form-control"
                value={form.faculty}
                onChange={(e) => setForm({ ...form, faculty: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="checkbox-label-row">
                <input
                  type="checkbox"
                  checked={Boolean(form.is_active)}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked ? 1 : 0 })}
                />
                <span>Program Studi Aktif Menerima Mahasiswa</span>
              </label>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
              Batal
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Menyimpan...' : 'Simpan Program Studi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

ProgramStudyModal.displayName = 'ProgramStudyModal';
