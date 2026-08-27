import React from 'react';
import { BookOpen, Phone, UserCheck, X } from 'lucide-react';

function InputField({ label, field, formData, update, ...props }) {
  return (
    <div className="form-group">
      <label>{label}</label>
      <input
        className="form-control"
        value={formData[field]}
        onChange={(event) => update(field, event.target.value)}
        {...props}
      />
    </div>
  );
}

export default function StudentEditorModal({ modal, editor, prodis, actions }) {
  if (!modal.editorOpen) return null;
  const update = (field, value) =>
    actions.setFormData((current) => ({ ...current, [field]: value }));
  return (
    <div className="modal-backdrop" onClick={actions.closeEditor}>
      <div
        className="modal-dialog large"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="modal-header">
          <h2>{modal.editingStudent ? 'Edit Data Mahasiswa' : 'Tambah Mahasiswa Baru'}</h2>
          <button
            type="button"
            className="modal-close-btn"
            onClick={actions.closeEditor}
            aria-label="Tutup"
          >
            <X size={20} />
          </button>
        </div>
        <form onSubmit={actions.saveStudent}>
          <div
            className="modal-body"
            style={{ maxHeight: 'calc(85vh - 130px)', overflowY: 'auto' }}
          >
            {editor.formError && (
              <div
                style={{
                  padding: '10px 14px',
                  background: 'var(--danger-bg)',
                  color: 'var(--danger)',
                  borderRadius: 8,
                  fontSize: 13,
                  marginBottom: 16,
                }}
              >
                {editor.formError}
              </div>
            )}
            <div className="form-section-card">
              <div className="form-section-title">
                <UserCheck size={16} />
                <span>1. Identitas Kependudukan</span>
              </div>
              <div className="form-grid-2">
                <InputField
                  label="NIM Mahasiswa *"
                  field="nim"
                  formData={editor.formData}
                  update={update}
                  type="text"
                  placeholder="Contoh: 051234567"
                  required
                />
                <InputField
                  label="Nama Lengkap (Capital Each Word) *"
                  field="full_name"
                  formData={editor.formData}
                  update={update}
                  type="text"
                  placeholder="Contoh: Budi Santoso"
                  required
                />
                <InputField
                  label="Nomor KTP / NIK (16 Digit)"
                  field="no_ktp"
                  formData={editor.formData}
                  update={update}
                  type="text"
                  placeholder="3603100510860014"
                />
                <InputField
                  label="Nama Ibu Kandung"
                  field="nama_ibu_kandung"
                  formData={editor.formData}
                  update={update}
                  type="text"
                  placeholder="Nama Ibu Kandung"
                />
                <InputField
                  label="Tempat Lahir"
                  field="tempat_lahir"
                  formData={editor.formData}
                  update={update}
                  type="text"
                  placeholder="Tangerang"
                />
                <InputField
                  label="Tanggal Lahir"
                  field="tanggal_lahir"
                  formData={editor.formData}
                  update={update}
                  type="text"
                  placeholder="14 September 2000"
                />
              </div>
            </div>
            <div className="form-section-card">
              <div className="form-section-title">
                <BookOpen size={16} />
                <span>2. Akademik & Program Studi</span>
              </div>
              <div className="form-grid-2">
                <div className="form-group">
                  <label>Program Studi (31 Jurusan Tersedia)</label>
                  <select
                    className="form-control"
                    value={editor.formData.study_program_id}
                    onChange={(event) => update('study_program_id', event.target.value)}
                  >
                    <option value="">Pilih Program Studi</option>
                    {prodis.map((program) => (
                      <option key={program.id} value={program.id}>
                        {program.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Status Akademik</label>
                  <select
                    className="form-control"
                    value={editor.formData.academic_status}
                    onChange={(event) => update('academic_status', event.target.value)}
                  >
                    <option value="aktif">Aktif</option>
                    <option value="cuti">Cuti</option>
                    <option value="lulus">Lulus</option>
                    <option value="nonaktif">Non-Aktif</option>
                    <option value="keluar">Keluar</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Periode Masuk (e.g. 2023.1)</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="2023.1"
                    value={editor.formData.entry_period}
                    onChange={(event) => actions.updateEntryPeriod(event.target.value)}
                  />
                </div>
                <InputField
                  label="Registrasi Awal (String Master Data)"
                  field="initial_registration"
                  formData={editor.formData}
                  update={update}
                  type="text"
                  placeholder="UNIVERSITAS TERBUKA 2023.1"
                />
              </div>
            </div>
            <div className="form-section-card" style={{ marginBottom: 0 }}>
              <div className="form-section-title">
                <Phone size={16} />
                <span>3. Kontak & Domisili</span>
              </div>
              <div className="form-grid-2">
                <InputField
                  label="Nomor HP / Kontak (WA)"
                  field="phone_number"
                  formData={editor.formData}
                  update={update}
                  type="tel"
                  placeholder="081234567890"
                />
                <InputField
                  label="Email Mahasiswa"
                  field="email"
                  formData={editor.formData}
                  update={update}
                  type="email"
                  placeholder="mahasiswa@ecampus.ut.ac.id"
                />
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label>Alamat Tinggal Lengkap</label>
                  <textarea
                    className="form-control"
                    rows={2}
                    placeholder="Alamat domisili lengkap mahasiswa..."
                    value={editor.formData.address}
                    onChange={(event) => update('address', event.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={actions.closeEditor}
              disabled={editor.saving}
            >
              Batal
            </button>
            <button type="submit" className="btn btn-primary" disabled={editor.saving}>
              {editor.saving ? 'Menyimpan...' : 'Simpan Data Mahasiswa'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
