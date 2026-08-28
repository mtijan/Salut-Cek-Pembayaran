import React from 'react';
import { AlertCircle, Save } from 'lucide-react';

function FormField({ children, fullWidth = false, label }) {
  return (
    <div className={`form-group ${fullWidth ? 'form-group-full' : ''}`}>
      <label>{label}</label>
      {children}
    </div>
  );
}

export function StudentEditTab({ editError, form, onCancel, onChange, onSubmit, prodis, saving }) {
  const update = (field) => (event) =>
    onChange((previous) => ({ ...previous, [field]: event.target.value }));

  return (
    <div className="profile-tab-pane">
      <div className="mb-4">
        <h3 className="panel-header-title">Edit Biodata &amp; Informasi Mahasiswa</h3>
        <p className="panel-header-desc">
          Perbarui data kependudukan, program studi, kontak, dan status akademik mahasiswa
        </p>
      </div>
      {editError && (
        <div className="alert-box alert-danger mb-4">
          <AlertCircle size={18} />
          <span>{editError}</span>
        </div>
      )}
      <form onSubmit={onSubmit} className="modern-form">
        <div className="form-grid-2">
          <FormField label="NIM Mahasiswa (Permanen)">
            <input
              type="text"
              value={form.nim}
              disabled
              className="form-input input-disabled-safe"
            />
          </FormField>
          <FormField
            label={
              <>
                Nama Lengkap Mahasiswa <span className="text-danger">*</span>
              </>
            }
          >
            <input
              type="text"
              value={form.full_name}
              onChange={update('full_name')}
              className="form-input"
              placeholder="Nama lengkap sesuai KTP"
              required
            />
          </FormField>
          <FormField label="No. KTP / NIK (16 Digit)">
            <input
              type="text"
              value={form.no_ktp}
              onChange={update('no_ktp')}
              className="form-input"
              placeholder="Contoh: 3603100510860014"
              maxLength={16}
            />
          </FormField>
          <FormField label="Nama Ibu Kandung">
            <input
              type="text"
              value={form.nama_ibu_kandung}
              onChange={update('nama_ibu_kandung')}
              className="form-input"
              placeholder="Nama ibu kandung"
            />
          </FormField>
          <FormField label="Tempat Lahir">
            <input
              type="text"
              value={form.tempat_lahir}
              onChange={update('tempat_lahir')}
              className="form-input"
              placeholder="Kota tempat lahir"
            />
          </FormField>
          <FormField label="Tanggal Lahir">
            <input
              type="text"
              value={form.tanggal_lahir}
              onChange={update('tanggal_lahir')}
              className="form-input"
              placeholder="Contoh: 14 September 2000"
            />
          </FormField>
          <FormField label="Program Studi">
            <select
              value={form.study_program_id}
              onChange={update('study_program_id')}
              className="form-input"
            >
              <option value="">-- Pilih Program Studi --</option>
              {prodis.map((prodi) => (
                <option key={prodi.id} value={prodi.id}>
                  {prodi.name} {prodi.degree ? `(${prodi.degree})` : ''}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Status Akademik">
            <select
              value={form.academic_status}
              onChange={update('academic_status')}
              className="form-input"
            >
              <option value="aktif">Aktif</option>
              <option value="cuti">Cuti</option>
              <option value="nonaktif">Nonaktif</option>
              <option value="lulus">Lulus</option>
              <option value="keluar">Keluar / DO</option>
            </select>
          </FormField>
          <FormField label="No. Handphone / WhatsApp">
            <input
              type="text"
              value={form.phone_number}
              onChange={update('phone_number')}
              className="form-input"
              placeholder="Contoh: 085163132520"
            />
          </FormField>
          <FormField label="Alamat Email">
            <input
              type="email"
              value={form.email}
              onChange={update('email')}
              className="form-input"
              placeholder="Contoh: mahasiswa@email.com"
            />
          </FormField>
          <FormField label="Tahun Masuk">
            <input
              type="number"
              value={form.entry_year}
              onChange={update('entry_year')}
              className="form-input"
              placeholder="Contoh: 2023"
            />
          </FormField>
          <FormField label="Periode Masuk (Kode)">
            <input
              type="text"
              value={form.entry_period}
              onChange={update('entry_period')}
              className="form-input"
              placeholder="Contoh: 2023.1"
            />
          </FormField>
          <FormField label="Alamat Lengkap" fullWidth>
            <textarea
              value={form.address}
              onChange={update('address')}
              className="form-input"
              rows={3}
              placeholder="Alamat domisili lengkap..."
            />
          </FormField>
        </div>
        <div className="form-actions-end">
          <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={saving}>
            Batal
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? (
              <>
                <div className="spinner-sm" />
                <span>Menyimpan...</span>
              </>
            ) : (
              <>
                <Save size={16} />
                <span>Simpan Perubahan Biodata</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

StudentEditTab.displayName = 'StudentEditTab';
