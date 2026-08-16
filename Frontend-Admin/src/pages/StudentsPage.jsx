import React, { useState, useEffect, useCallback } from 'react';
import { Search, Plus, UserCheck, Edit2, Trash2, Eye, RefreshCw, X } from 'lucide-react';
import { studentsApi, masterApi } from '../services/api';
import { useToast } from '../components/common/Toast';
import { useAuth } from '../context/AuthContext';
import Student360Modal from './Student360Modal';
import ConfirmModal from '../components/common/ConfirmModal';

export default function StudentsPage() {
  const { showToast } = useToast();
  const { isViewer } = useAuth();

  const [students, setStudents] = useState([]);
  const [prodis, setProdis] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [query, setQuery] = useState('');
  const [selectedProdi, setSelectedProdi] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');

  // Modals state
  const [selected360Id, setSelected360Id] = useState(null);
  const [editorModalOpen, setEditorModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    nim: '',
    full_name: '',
    study_program_id: '',
    academic_status: 'aktif',
    entry_year: '',
    phone_number: '',
    email: '',
    address: '',
  });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchProdis = async () => {
    try {
      const res = await masterApi.listProdi();
      setProdis(res.study_programs || []);
    } catch {}
  };

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await studentsApi.list({
        query: query.trim(),
        study_program_id: selectedProdi,
        academic_status: selectedStatus,
      });
      setStudents(res.students || []);
    } catch (err) {
      showToast(err.message || 'Gagal memuat data mahasiswa.', 'error');
    } finally {
      setLoading(false);
    }
  }, [query, selectedProdi, selectedStatus, showToast]);

  useEffect(() => {
    fetchProdis();
  }, []);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  const handleOpenCreate = () => {
    setEditingStudent(null);
    setFormData({
      nim: '',
      full_name: '',
      study_program_id: prodis[0]?.id || '',
      academic_status: 'aktif',
      entry_year: new Date().getFullYear().toString(),
      phone_number: '',
      email: '',
      address: '',
    });
    setFormError('');
    setEditorModalOpen(true);
  };

  const handleOpenEdit = async (student) => {
    setEditingStudent(student);
    setFormData({
      nim: student.nim,
      full_name: student.full_name,
      study_program_id: student.study_program_id || '',
      academic_status: student.academic_status || 'aktif',
      entry_year: student.entry_year ? String(student.entry_year) : '',
      phone_number: student.phone_number || '',
      email: student.email || '',
      address: student.address || '',
    });
    setFormError('');
    setEditorModalOpen(true);
  };

  const handleSaveStudent = async (e) => {
    e.preventDefault();
    if (!formData.nim || !formData.full_name) {
      setFormError('NIM dan Nama Lengkap wajib diisi.');
      return;
    }
    setFormError('');
    setSaving(true);

    const payload = {
      ...formData,
      entry_year: formData.entry_year ? Number(formData.entry_year) : null,
      study_program_id: formData.study_program_id || null,
      phone_number: formData.phone_number || null,
      email: formData.email || null,
      address: formData.address || null,
    };

    try {
      if (editingStudent) {
        await studentsApi.update(editingStudent.id, payload);
        showToast('Data mahasiswa berhasil diperbarui.');
      } else {
        await studentsApi.create(payload);
        showToast('Mahasiswa baru berhasil ditambahkan.');
      }
      setEditorModalOpen(false);
      fetchStudents();
    } catch (err) {
      setFormError(err.message || 'Gagal menyimpan mahasiswa.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteConfirm = async (reason) => {
    if (!deleteTarget) return;
    await studentsApi.delete(deleteTarget.id, reason);
    showToast(`Mahasiswa ${deleteTarget.full_name} berhasil dihapus.`);
    setDeleteTarget(null);
    fetchStudents();
  };

  return (
    <div>
      <div className="panel-card">
        {/* Toolbar */}
        <div className="toolbar-row">
          <div className="toolbar-filters">
            <div className="search-input-wrap">
              <Search size={16} />
              <input
                type="text"
                placeholder="Cari NIM, nama mahasiswa..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>

            <select
              className="select-filter"
              value={selectedProdi}
              onChange={(e) => setSelectedProdi(e.target.value)}
            >
              <option value="">Semua Program Studi</option>
              {prodis.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.code})
                </option>
              ))}
            </select>

            <select
              className="select-filter"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
            >
              <option value="">Semua Status</option>
              <option value="aktif">Aktif</option>
              <option value="cuti">Cuti</option>
              <option value="lulus">Lulus</option>
              <option value="nonaktif">Non-Aktif</option>
              <option value="keluar">Keluar</option>
            </select>

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setQuery('');
                setSelectedProdi('');
                setSelectedStatus('');
              }}
              title="Reset Filter"
            >
              Reset
            </button>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <span className="badge badge-neutral">
              {students.length} Mahasiswa
            </span>
            {!isViewer && (
              <button type="button" className="btn btn-primary" onClick={handleOpenCreate}>
                <Plus size={16} />
                <span>Tambah Mahasiswa</span>
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
            <span>Memuat data mahasiswa...</span>
          </div>
        ) : !students.length ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
            <p>Tidak ada data mahasiswa yang sesuai dengan filter.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>NIM</th>
                  <th>Nama Mahasiswa</th>
                  <th>Program Studi</th>
                  <th>Status</th>
                  <th>Angkatan</th>
                  <th>Jml Tagihan</th>
                  <th>Total Nominal</th>
                  <th style={{ textAlign: 'right' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => (
                  <tr key={s.id}>
                    <td><strong>{s.nim}</strong></td>
                    <td>{s.full_name}</td>
                    <td>{s.study_program_name || s.program_study || '-'}</td>
                    <td>
                      <span className={`badge ${s.academic_status === 'aktif' ? 'badge-success' : s.academic_status === 'cuti' ? 'badge-warning' : 'badge-danger'}`}>
                        {s.academic_status || 'aktif'}
                      </span>
                    </td>
                    <td>{s.entry_year || '-'}</td>
                    <td>{s.bill_count}</td>
                    <td>{s.total_amount_formatted}</td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ marginRight: 6 }}
                        onClick={() => setSelected360Id(s.id)}
                        title="Lihat Profil 360"
                      >
                        <Eye size={14} color="var(--brand)" />
                        <span>Profil 360</span>
                      </button>

                      {!isViewer && (
                        <>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{ marginRight: 6 }}
                            onClick={() => handleOpenEdit(s)}
                            title="Edit Mahasiswa"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            onClick={() => setDeleteTarget(s)}
                            title="Hapus Mahasiswa"
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Student Profile 360 Modal */}
      <Student360Modal
        studentId={selected360Id}
        isOpen={Boolean(selected360Id)}
        onClose={() => setSelected360Id(null)}
      />

      {/* Create / Edit Student Modal */}
      {editorModalOpen && (
        <div className="modal-backdrop" onClick={() => setEditorModalOpen(false)}>
          <div
            className="modal-dialog large"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="modal-header">
              <h2>{editingStudent ? 'Edit Data Mahasiswa' : 'Tambah Mahasiswa Baru'}</h2>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setEditorModalOpen(false)}
                aria-label="Tutup"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveStudent}>
              <div className="modal-body">
                {formError && (
                  <div style={{ padding: '10px 14px', background: 'var(--danger-bg)', color: 'var(--danger)', borderRadius: 8, fontSize: 13, marginBottom: 16 }}>
                    {formError}
                  </div>
                )}

                <div className="form-grid-2">
                  <div className="form-group">
                    <label>NIM Mahasiswa *</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.nim}
                      onChange={(e) => setFormData({ ...formData, nim: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Nama Lengkap *</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.full_name}
                      onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Program Studi</label>
                    <select
                      className="form-control"
                      value={formData.study_program_id}
                      onChange={(e) => setFormData({ ...formData, study_program_id: e.target.value })}
                    >
                      <option value="">Pilih Program Studi</option>
                      {prodis.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Status Akademik</label>
                    <select
                      className="form-control"
                      value={formData.academic_status}
                      onChange={(e) => setFormData({ ...formData, academic_status: e.target.value })}
                    >
                      <option value="aktif">Aktif</option>
                      <option value="cuti">Cuti</option>
                      <option value="lulus">Lulus</option>
                      <option value="nonaktif">Non-Aktif</option>
                      <option value="keluar">Keluar</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Tahun Angkatan</label>
                    <input
                      type="number"
                      className="form-control"
                      placeholder="2025"
                      value={formData.entry_year}
                      onChange={(e) => setFormData({ ...formData, entry_year: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Nomor HP</label>
                    <input
                      type="tel"
                      className="form-control"
                      placeholder="081234567890"
                      value={formData.phone_number}
                      onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                    />
                  </div>

                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label>Email</label>
                    <input
                      type="email"
                      className="form-control"
                      placeholder="mahasiswa@ecampus.ut.ac.id"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>

                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label>Alamat</label>
                    <textarea
                      className="form-control"
                      rows={2}
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setEditorModalOpen(false)}
                  disabled={saving}
                >
                  Batal
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Menyimpan...' : 'Simpan Data Mahasiswa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        title="Hapus Mahasiswa"
        description={`Apakah Anda yakin ingin menghapus mahasiswa "${deleteTarget?.full_name}" (${deleteTarget?.nim}) beserta seluruh riwayat tagihannya?`}
        confirmText="Hapus Mahasiswa"
        onConfirm={handleDeleteConfirm}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
