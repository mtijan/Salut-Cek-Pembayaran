import React from 'react';
import {
  AlertCircle,
  BookOpen,
  Calendar,
  CreditCard,
  GraduationCap,
  Hash,
  HeartHandshake,
  Lock,
  Mail,
  MapPin,
  Phone,
  PhoneCall,
  Save,
  ShieldCheck,
  Sparkles,
  User,
  UserCheck,
} from 'lucide-react';

export function StudentEditTab({ editError, form, onCancel, onChange, onSubmit, prodis, saving }) {
  const update = (field) => (event) =>
    onChange((previous) => ({ ...previous, [field]: event.target.value }));

  const updateNumeric = (field, maxLength) => (event) => {
    const rawValue = event.target.value.replace(/\D/g, '');
    const cleanValue = maxLength ? rawValue.slice(0, maxLength) : rawValue;
    onChange((previous) => ({ ...previous, [field]: cleanValue }));
  };

  const ktpLength = (form.no_ktp || '').length;

  return (
    <div className="profile-tab-pane">
      <div className="student-edit-tab-container">
        {/* Top Header Banner */}
        <div className="student-edit-header-banner">
          <div className="student-edit-header-info">
            <h3 className="student-edit-header-title">
              <Sparkles size={18} className="text-brand" />
              <span>Edit Biodata &amp; Informasi Mahasiswa</span>
            </h3>
            <p className="student-edit-header-desc">
              Perbarui data kependudukan, program studi, status akademik, dan kontak mahasiswa
              secara terstruktur.
            </p>
          </div>
        </div>

        {editError && (
          <div className="alert-box alert-danger">
            <AlertCircle size={18} />
            <span>{editError}</span>
          </div>
        )}

        <form onSubmit={onSubmit} className="student-edit-tab-container">
          {/* Section 1: Identitas & Kependudukan */}
          <div className="student-edit-section-card">
            <div className="student-edit-section-header">
              <div className="student-edit-section-title-wrap">
                <div className="student-edit-icon-badge">
                  <UserCheck size={18} />
                </div>
                <div className="student-edit-section-titles">
                  <h4 className="student-edit-section-title">
                    1. Data Identitas &amp; Kependudukan
                  </h4>
                  <p className="student-edit-section-subtitle">
                    Identitas pokok mahasiswa sesuai dokumen kependudukan resmi (KTP / KK)
                  </p>
                </div>
              </div>
            </div>

            <div className="student-edit-section-body">
              <div className="student-edit-grid-2">
                {/* NIM (Read-Only) */}
                <div className="student-edit-field-group">
                  <div className="student-edit-field-label-row">
                    <label className="student-edit-field-label">
                      <span>NIM Mahasiswa</span>
                    </label>
                    <span className="student-edit-badge-readonly">
                      <Lock size={11} />
                      <span>Permanen</span>
                    </span>
                  </div>
                  <div className="student-edit-input-wrap">
                    <div className="student-edit-input-icon">
                      <Lock size={16} />
                    </div>
                    <input
                      type="text"
                      value={form.nim}
                      disabled
                      className="student-edit-input student-edit-input-readonly"
                      title="NIM bersifat permanen dan tidak dapat diubah"
                    />
                  </div>
                  <span className="student-edit-field-helper">
                    Nomor Induk Mahasiswa utama yang terdaftar pada sistem akademik.
                  </span>
                </div>

                {/* Nama Lengkap (Required) */}
                <div className="student-edit-field-group">
                  <div className="student-edit-field-label-row">
                    <label className="student-edit-field-label">
                      <span>Nama Lengkap Mahasiswa</span>
                      <span className="text-danger">*</span>
                    </label>
                    <span className="student-edit-badge-required">Wajib</span>
                  </div>
                  <div className="student-edit-input-wrap">
                    <div className="student-edit-input-icon">
                      <User size={16} />
                    </div>
                    <input
                      type="text"
                      value={form.full_name}
                      onChange={update('full_name')}
                      className="student-edit-input"
                      placeholder="Nama lengkap sesuai KTP"
                      required
                    />
                  </div>
                  <span className="student-edit-field-helper">
                    Gunakan huruf kapital di awal setiap kata (Title Case).
                  </span>
                </div>

                {/* No. KTP / NIK */}
                <div className="student-edit-field-group">
                  <div className="student-edit-field-label-row">
                    <label className="student-edit-field-label">
                      <span>Nomor KTP / NIK</span>
                    </label>
                    <span
                      className={`student-edit-badge-counter ${
                        ktpLength === 16 ? 'valid' : 'incomplete'
                      }`}
                    >
                      {ktpLength} / 16 Digit
                    </span>
                  </div>
                  <div className="student-edit-input-wrap">
                    <div className="student-edit-input-icon">
                      <CreditCard size={16} />
                    </div>
                    <input
                      type="text"
                      value={form.no_ktp}
                      onChange={updateNumeric('no_ktp', 16)}
                      className="student-edit-input mono-font"
                      placeholder="Contoh: 3603100510860014"
                      maxLength={16}
                      inputMode="numeric"
                    />
                  </div>
                  <span className="student-edit-field-helper">
                    16 digit Nomor Induk Kependudukan resmi Dukcapil.
                  </span>
                </div>

                {/* Nama Ibu Kandung */}
                <div className="student-edit-field-group">
                  <div className="student-edit-field-label-row">
                    <label className="student-edit-field-label">
                      <span>Nama Ibu Kandung</span>
                    </label>
                  </div>
                  <div className="student-edit-input-wrap">
                    <div className="student-edit-input-icon">
                      <HeartHandshake size={16} />
                    </div>
                    <input
                      type="text"
                      value={form.nama_ibu_kandung}
                      onChange={update('nama_ibu_kandung')}
                      className="student-edit-input"
                      placeholder="Nama lengkap ibu kandung"
                    />
                  </div>
                  <span className="student-edit-field-helper">
                    Diperlukan untuk verifikasi validasi data kemahasiswaan.
                  </span>
                </div>

                {/* Tempat Lahir */}
                <div className="student-edit-field-group">
                  <div className="student-edit-field-label-row">
                    <label className="student-edit-field-label">
                      <span>Tempat Lahir</span>
                    </label>
                  </div>
                  <div className="student-edit-input-wrap">
                    <div className="student-edit-input-icon">
                      <MapPin size={16} />
                    </div>
                    <input
                      type="text"
                      value={form.tempat_lahir}
                      onChange={update('tempat_lahir')}
                      className="student-edit-input"
                      placeholder="Kota / Kabupaten tempat lahir"
                    />
                  </div>
                </div>

                {/* Tanggal Lahir */}
                <div className="student-edit-field-group">
                  <div className="student-edit-field-label-row">
                    <label className="student-edit-field-label">
                      <span>Tanggal Lahir</span>
                    </label>
                  </div>
                  <div className="student-edit-input-wrap">
                    <div className="student-edit-input-icon">
                      <Calendar size={16} />
                    </div>
                    <input
                      type="text"
                      value={form.tanggal_lahir}
                      onChange={update('tanggal_lahir')}
                      className="student-edit-input"
                      placeholder="Contoh: 14 September 2000"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Akademik & Program Studi */}
          <div className="student-edit-section-card">
            <div className="student-edit-section-header">
              <div className="student-edit-section-title-wrap">
                <div className="student-edit-icon-badge">
                  <GraduationCap size={18} />
                </div>
                <div className="student-edit-section-titles">
                  <h4 className="student-edit-section-title">2. Data Akademik &amp; Perkuliahan</h4>
                  <p className="student-edit-section-subtitle">
                    Program studi terdaftar, status keaktifan mahasiswa, dan angkatan perkuliahan
                  </p>
                </div>
              </div>
            </div>

            <div className="student-edit-section-body">
              <div className="student-edit-grid-2">
                {/* Program Studi */}
                <div className="student-edit-field-group">
                  <div className="student-edit-field-label-row">
                    <label className="student-edit-field-label">
                      <span>Program Studi</span>
                    </label>
                  </div>
                  <div className="student-edit-input-wrap">
                    <div className="student-edit-input-icon">
                      <BookOpen size={16} />
                    </div>
                    <select
                      value={form.study_program_id}
                      onChange={update('study_program_id')}
                      className="student-edit-select"
                    >
                      <option value="">-- Pilih Program Studi --</option>
                      {prodis.map((prodi) => (
                        <option key={prodi.id} value={prodi.id}>
                          {prodi.name} {prodi.degree ? `(${prodi.degree})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <span className="student-edit-field-helper">
                    Jurusan/program studi aktif yang ditempuh mahasiswa.
                  </span>
                </div>

                {/* Status Akademik */}
                <div className="student-edit-field-group">
                  <div className="student-edit-field-label-row">
                    <label className="student-edit-field-label">
                      <span>Status Akademik</span>
                    </label>
                  </div>
                  <div className="student-edit-input-wrap">
                    <div className="student-edit-input-icon">
                      <UserCheck size={16} />
                    </div>
                    <select
                      value={form.academic_status}
                      onChange={update('academic_status')}
                      className="student-edit-select"
                    >
                      <option value="aktif">Aktif (Kuliah Berjalan)</option>
                      <option value="cuti">Cuti Akademik</option>
                      <option value="nonaktif">Non-Aktif</option>
                      <option value="lulus">Lulus / Alumni</option>
                      <option value="keluar">Keluar / DO</option>
                    </select>
                  </div>
                  <span className="student-edit-field-helper">
                    Status kelayakan pendaftaran dan registrasi mata kuliah.
                  </span>
                </div>

                {/* Tahun Masuk */}
                <div className="student-edit-field-group">
                  <div className="student-edit-field-label-row">
                    <label className="student-edit-field-label">
                      <span>Tahun Masuk</span>
                    </label>
                  </div>
                  <div className="student-edit-input-wrap">
                    <div className="student-edit-input-icon">
                      <Calendar size={16} />
                    </div>
                    <input
                      type="number"
                      value={form.entry_year}
                      onChange={update('entry_year')}
                      className="student-edit-input"
                      placeholder="Contoh: 2023"
                      min="1990"
                      max="2099"
                    />
                  </div>
                </div>

                {/* Periode Masuk (Kode) */}
                <div className="student-edit-field-group">
                  <div className="student-edit-field-label-row">
                    <label className="student-edit-field-label">
                      <span>Periode Masuk (Kode)</span>
                    </label>
                  </div>
                  <div className="student-edit-input-wrap">
                    <div className="student-edit-input-icon">
                      <Hash size={16} />
                    </div>
                    <input
                      type="text"
                      value={form.entry_period}
                      onChange={update('entry_period')}
                      className="student-edit-input mono-font"
                      placeholder="Contoh: 2023.1"
                    />
                  </div>
                  <span className="student-edit-field-helper">
                    Kode semester masuk format UT (contoh: 2023.1 untuk Ganjil, 2023.2 untuk Genap).
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Kontak & Alamat Domisili */}
          <div className="student-edit-section-card">
            <div className="student-edit-section-header">
              <div className="student-edit-section-title-wrap">
                <div className="student-edit-icon-badge">
                  <PhoneCall size={18} />
                </div>
                <div className="student-edit-section-titles">
                  <h4 className="student-edit-section-title">3. Kontak &amp; Alamat Domisili</h4>
                  <p className="student-edit-section-subtitle">
                    Saluran komunikasi aktif dan alamat surat-menyurat mahasiswa
                  </p>
                </div>
              </div>
            </div>

            <div className="student-edit-section-body">
              <div className="student-edit-grid-2">
                {/* No. Handphone / WhatsApp */}
                <div className="student-edit-field-group">
                  <div className="student-edit-field-label-row">
                    <label className="student-edit-field-label">
                      <span>No. Handphone / WhatsApp</span>
                    </label>
                  </div>
                  <div className="student-edit-input-wrap">
                    <div className="student-edit-input-icon">
                      <Phone size={16} />
                    </div>
                    <input
                      type="tel"
                      value={form.phone_number}
                      onChange={update('phone_number')}
                      className="student-edit-input"
                      placeholder="Contoh: 085163132520"
                    />
                  </div>
                  <span className="student-edit-field-helper">
                    Nomor aktif yang terhubung dengan WhatsApp untuk notifikasi tagihan.
                  </span>
                </div>

                {/* Email */}
                <div className="student-edit-field-group">
                  <div className="student-edit-field-label-row">
                    <label className="student-edit-field-label">
                      <span>Alamat Email</span>
                    </label>
                  </div>
                  <div className="student-edit-input-wrap">
                    <div className="student-edit-input-icon">
                      <Mail size={16} />
                    </div>
                    <input
                      type="email"
                      value={form.email}
                      onChange={update('email')}
                      className="student-edit-input"
                      placeholder="Contoh: mahasiswa@email.com"
                    />
                  </div>
                  <span className="student-edit-field-helper">
                    Alamat email aktif untuk pengiriman bukti dan informasi resmi.
                  </span>
                </div>

                {/* Alamat Lengkap Domisili (Full Width) */}
                <div className="student-edit-field-group full-width">
                  <div className="student-edit-field-label-row">
                    <label className="student-edit-field-label">
                      <span>Alamat Lengkap Domisili</span>
                    </label>
                  </div>
                  <div className="student-edit-textarea-wrap">
                    <div className="student-edit-textarea-icon">
                      <MapPin size={16} />
                    </div>
                    <textarea
                      value={form.address}
                      onChange={update('address')}
                      className="student-edit-textarea"
                      rows={3}
                      placeholder="Tuliskan alamat lengkap domisili mahasiswa (Jalan, RT/RW, Kelurahan, Kecamatan, Kota/Kabupaten, Kode Pos)..."
                    />
                  </div>
                  <span className="student-edit-field-helper">
                    Alamat pengiriman berkas atau modul kuliah cetak.
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Footer Bar */}
          <div className="student-edit-actions-footer">
            <div className="student-edit-actions-note">
              <ShieldCheck size={16} className="text-brand" />
              <span>Pastikan data yang diubah telah diverifikasi sesuai berkas mahasiswa.</span>
            </div>
            <div className="student-edit-actions-btns">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onCancel}
                disabled={saving}
              >
                Batal
              </button>
              <button type="submit" className="btn btn-brand" disabled={saving}>
                {saving ? (
                  <>
                    <div className="spinner-sm" />
                    <span>Menyimpan Perubahan...</span>
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    <span>Simpan Perubahan Biodata</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

StudentEditTab.displayName = 'StudentEditTab';
