import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Search, Plus, UserCheck, Edit2, Trash2, Eye, RefreshCw, X, Copy,
  Users, UserX, CreditCard, BookOpen, ChevronLeft, ChevronRight,
  ChevronsLeft, ChevronsRight, Check, Phone, Mail, MapPin, Calendar
} from 'lucide-react';
import { studentsApi, masterApi } from '../services/api';
import { useToast } from '../components/common/Toast';
import { useAuth } from '../context/AuthContext';
import Student360Modal from './Student360Modal';
import ConfirmModal from '../components/common/ConfirmModal';

export default function StudentsPage({ navigateTo }) {
  const { showToast } = useToast();
  const { can } = useAuth();

  const [students, setStudents] = useState([]);
  const [prodis, setProdis] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [query, setQuery] = useState('');
  const [selectedProdi, setSelectedProdi] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState('');
  const [sortBy, setSortBy] = useState('entry_period_desc');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Copy state
  const [copiedKey, setCopiedKey] = useState(null);

  // Modals state
  const [selected360Id, setSelected360Id] = useState(null);
  const [editorModalOpen, setEditorModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    nim: '',
    full_name: '',
    no_ktp: '',
    tempat_lahir: '',
    tanggal_lahir: '',
    nama_ibu_kandung: '',
    study_program_id: '',
    academic_status: 'aktif',
    entry_year: '',
    entry_semester: 'ganjil',
    entry_period: '',
    initial_registration: '',
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
        entry_period: selectedPeriod,
        sort_by: sortBy,
      });
      setStudents(res.students || []);
      setCurrentPage(1);
    } catch (err) {
      showToast(err.message || 'Gagal memuat data mahasiswa.', 'error');
    } finally {
      setLoading(false);
    }
  }, [query, selectedProdi, selectedStatus, selectedPeriod, sortBy, showToast]);

  useEffect(() => {
    fetchProdis();
  }, []);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  // Statistics calculation
  const stats = useMemo(() => {
    const total = students.length;
    const active = students.filter((s) => s.academic_status === 'aktif').length;
    const nonActive = students.filter((s) => s.academic_status && s.academic_status !== 'aktif').length;
    const withBills = students.filter((s) => Number(s.bill_count || 0) > 0).length;
    return { total, active, nonActive, withBills };
  }, [students]);

  // Paginated students slice
  const totalPages = Math.max(1, Math.ceil(students.length / pageSize));
  const paginatedStudents = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return students.slice(start, start + pageSize);
  }, [students, currentPage, pageSize]);

  const handleCopy = (text, label) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(label);
    showToast(`${label} disalin!`, 'success');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleOpenCreate = () => {
    setEditingStudent(null);
    setFormData({
      nim: '',
      full_name: '',
      no_ktp: '',
      tempat_lahir: '',
      tanggal_lahir: '',
      nama_ibu_kandung: '',
      study_program_id: prodis[0]?.id || '',
      academic_status: 'aktif',
      entry_year: new Date().getFullYear().toString(),
      entry_semester: 'ganjil',
      entry_period: `${new Date().getFullYear()}.1`,
      initial_registration: `UNIVERSITAS TERBUKA ${new Date().getFullYear()}.1`,
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
      no_ktp: student.no_ktp || '',
      tempat_lahir: student.tempat_lahir || '',
      tanggal_lahir: student.tanggal_lahir || '',
      nama_ibu_kandung: student.nama_ibu_kandung || '',
      study_program_id: student.study_program_id || '',
      academic_status: student.academic_status || 'aktif',
      entry_year: student.entry_year ? String(student.entry_year) : '',
      entry_semester: student.entry_semester || 'ganjil',
      entry_period: student.entry_period || '',
      initial_registration: student.initial_registration || '',
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
      no_ktp: formData.no_ktp || null,
      tempat_lahir: formData.tempat_lahir || null,
      tanggal_lahir: formData.tanggal_lahir || null,
      nama_ibu_kandung: formData.nama_ibu_kandung || null,
      entry_semester: formData.entry_semester || null,
      entry_period: formData.entry_period || null,
      initial_registration: formData.initial_registration || null,
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
      {/* Summary Statistics Bar */}
      <div className="student-stats-row">
        <div className="student-stat-card">
          <div className="student-stat-icon" style={{ background: 'var(--brand-surface)', color: 'var(--brand)' }}>
            <Users size={22} />
          </div>
          <div className="student-stat-meta">
            <span className="student-stat-title">Total Mahasiswa</span>
            <strong className="student-stat-number">{stats.total}</strong>
          </div>
        </div>

        <div className="student-stat-card">
          <div className="student-stat-icon" style={{ background: 'var(--success-bg)', color: 'var(--success)' }}>
            <UserCheck size={22} />
          </div>
          <div className="student-stat-meta">
            <span className="student-stat-title">Mahasiswa Aktif</span>
            <strong className="student-stat-number" style={{ color: 'var(--success)' }}>{stats.active}</strong>
          </div>
        </div>

        <div className="student-stat-card">
          <div className="student-stat-icon" style={{ background: 'var(--warning-bg)', color: 'var(--warning)' }}>
            <UserX size={22} />
          </div>
          <div className="student-stat-meta">
            <span className="student-stat-title">Cuti / Non-Aktif</span>
            <strong className="student-stat-number" style={{ color: 'var(--warning)' }}>{stats.nonActive}</strong>
          </div>
        </div>

        <div className="student-stat-card">
          <div className="student-stat-icon" style={{ background: 'var(--info-bg)', color: 'var(--info)' }}>
            <CreditCard size={22} />
          </div>
          <div className="student-stat-meta">
            <span className="student-stat-title">Memiliki Tagihan</span>
            <strong className="student-stat-number" style={{ color: 'var(--info)' }}>{stats.withBills}</strong>
          </div>
        </div>
      </div>

      <div className="panel-card">
        {/* Toolbar & Filters */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
          {/* Top Row: Search Input + Action Button */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div className="search-input-wrap" style={{ flex: 1, maxWidth: 440 }}>
              <Search size={16} />
              <input
                type="text"
                placeholder="Cari NIM, nama, prodi, NIK, kontak..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  style={{
                    position: 'absolute',
                    right: 10,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--muted)',
                    cursor: 'pointer',
                    padding: 4,
                  }}
                  title="Hapus pencarian"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {can('manage_students') && (
              <button
                type="button"
                className="btn btn-primary"
                style={{ height: 38 }}
                onClick={handleOpenCreate}
              >
                <Plus size={16} />
                <span>Tambah Mahasiswa</span>
              </button>
            )}
          </div>

          {/* Bottom Row: Dedicated Filter Strip */}
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10, padding: '10px 14px', background: '#f8fafc', border: '1px solid var(--line)', borderRadius: 'var(--radius-md)' }}>
            <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--muted)', marginRight: 4 }}>
              Filter:
            </span>

            <select
              className="select-filter"
              style={{ minWidth: 190, flex: '1 1 190px' }}
              value={selectedProdi}
              onChange={(e) => setSelectedProdi(e.target.value)}
            >
              <option value="">Semua Program Studi</option>
              {prodis.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>

            <select
              className="select-filter"
              style={{ minWidth: 160, flex: '1 1 160px' }}
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
            >
              <option value="">Semua Periode Masuk</option>
              <option value="2026.1">2026.1 (Ganjil)</option>
              <option value="2025.2">2025.2 (Genap)</option>
              <option value="2025.1">2025.1 (Ganjil)</option>
              <option value="2024.2">2024.2 (Genap)</option>
              <option value="2024.1">2024.1 (Ganjil)</option>
              <option value="2023.2">2023.2 (Genap)</option>
              <option value="2023.1">2023.1 (Ganjil)</option>
            </select>

            <select
              className="select-filter"
              style={{ minWidth: 130, flex: '1 1 130px' }}
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

            <select
              className="select-filter"
              style={{ minWidth: 160, flex: '1 1 160px' }}
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              title="Urutan Data"
            >
              <option value="entry_period_desc">Urut Periode Terbaru</option>
              <option value="entry_period_asc">Urut Periode Terlama</option>
              <option value="nim_asc">Urut NIM (A-Z)</option>
              <option value="name_asc">Urut Nama (A-Z)</option>
            </select>

            <button
              type="button"
              className="btn btn-secondary"
              style={{ height: 38, padding: '0 12px' }}
              onClick={() => {
                setQuery('');
                setSelectedProdi('');
                setSelectedStatus('');
                setSelectedPeriod('');
                setSortBy('entry_period_desc');
              }}
              title="Reset Filter"
            >
              <RefreshCw size={14} />
              <span>Reset</span>
            </button>
          </div>
        </div>

        {/* Table Content */}
        {loading ? (
          <div style={{ padding: '24px 12px' }}>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="skeleton-box skeleton-row" style={{ width: '100%' }} />
            ))}
          </div>
        ) : students.length === 0 ? (
          <div className="empty-state-card">
            <div className="empty-state-icon">
              <Users size={32} />
            </div>
            <h3 className="empty-state-title">Tidak Ada Data Mahasiswa</h3>
            <p className="empty-state-text">
              Tidak ditemukan data mahasiswa yang sesuai dengan filter atau kata kunci pencarian Anda.
            </p>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setQuery('');
                setSelectedProdi('');
                setSelectedStatus('');
                setSelectedPeriod('');
              }}
            >
              <RefreshCw size={14} />
              <span>Reset Filter Pencarian</span>
            </button>
          </div>
        ) : (
          <>
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: 44, textAlign: 'center' }}>No.</th>
                    <th style={{ width: 130 }}>NIM</th>
                    <th>Nama Mahasiswa</th>
                    <th style={{ width: 170 }}>No KTP / NIK</th>
                    <th>Program Studi</th>
                    <th style={{ width: 130 }}>Periode Masuk</th>
                    <th style={{ width: 130 }}>Kontak</th>
                    <th style={{ width: 100, textAlign: 'center' }}>Status</th>
                    <th style={{ width: 140 }}>Tagihan</th>
                    <th style={{ width: 150, textAlign: 'right' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedStudents.map((s, index) => (
                    <tr key={s.id}>
                      <td style={{ width: 44, textAlign: 'center', color: 'var(--muted)', fontWeight: 600, fontSize: 12.5 }}>
                        {(currentPage - 1) * pageSize + index + 1}
                      </td>
                      <td>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <strong style={{ fontFamily: 'var(--font-mono)' }}>{s.nim}</strong>
                          <button
                            type="button"
                            className="copy-btn-inline"
                            onClick={() => handleCopy(s.nim, `NIM ${s.nim}`)}
                            title="Salin NIM"
                          >
                            {copiedKey === `NIM ${s.nim}` ? <Check size={12} color="var(--success)" /> : <Copy size={12} />}
                          </button>
                        </div>
                      </td>
                      <td>
                        <div>
                          <button
                            type="button"
                            className="table-link-btn"
                            onClick={() => {
                              if (navigateTo) {
                                navigateTo('student-profile', { studentId: s.id });
                              } else {
                                setSelected360Id(s.id);
                              }
                            }}
                            title="Buka Halaman Profil 360 Mahasiswa"
                          >
                            {s.full_name}
                          </button>
                          {s.email && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{s.email}</div>}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <code style={{ fontSize: 12, color: 'var(--ink)', fontFamily: 'var(--font-mono)' }}>{s.no_ktp || '-'}</code>
                          {s.no_ktp && (
                            <button
                              type="button"
                              className="copy-btn-inline"
                              onClick={() => handleCopy(s.no_ktp, `NIK ${s.no_ktp}`)}
                              title="Salin NIK"
                            >
                              {copiedKey === `NIK ${s.no_ktp}` ? <Check size={12} color="var(--success)" /> : <Copy size={12} />}
                            </button>
                          )}
                        </div>
                      </td>
                      <td>
                        <span>{s.study_program_name || s.program_study || '-'}</span>
                      </td>
                      <td>
                        <span className="badge badge-neutral" style={{ fontSize: 11, fontWeight: 700 }}>
                          {s.entry_period_formatted || s.initial_registration || (s.entry_year ? `Angkatan ${s.entry_year}` : '-')}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: 12.5, fontFamily: 'var(--font-mono)' }}>{s.phone_number || '-'}</span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className={`badge ${s.academic_status === 'aktif' ? 'badge-success' : s.academic_status === 'cuti' ? 'badge-warning' : 'badge-danger'}`}>
                          {s.academic_status || 'aktif'}
                        </span>
                      </td>
                      <td>
                        <div>
                          <strong style={{ color: Number(s.total_amount || 0) > 0 ? 'var(--brand-strong)' : 'var(--muted)' }}>
                            {s.total_amount_formatted}
                          </strong>
                          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                            {s.bill_count} tagihan
                          </div>
                        </div>
                      </td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{ height: 30, padding: '0 8px', gap: 4 }}
                            onClick={() => {
                              if (navigateTo) {
                                navigateTo('student-profile', { studentId: s.id, initialTab: 'profile' });
                              } else {
                                setSelected360Id(s.id);
                              }
                            }}
                            title="Lihat Profil 360 Mahasiswa"
                          >
                            <Eye size={13} color="var(--brand)" />
                            <span>Profil 360</span>
                          </button>

                          {can('manage_students') && (
                            <>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                style={{ height: 30, padding: '0 8px', gap: 4 }}
                                onClick={() => {
                                  if (navigateTo) {
                                    navigateTo('student-profile', { studentId: s.id, initialTab: 'edit' });
                                  } else {
                                    handleOpenEdit(s);
                                  }
                                }}
                                title="Edit Data Mahasiswa"
                              >
                                <Edit2 size={13} />
                                <span>Edit</span>
                              </button>
                              <button
                                type="button"
                                className="btn btn-danger btn-sm"
                                style={{ height: 30, width: 30, padding: 0 }}
                                onClick={() => setDeleteTarget(s)}
                                title="Hapus Mahasiswa"
                              >
                                <Trash2 size={13} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="pagination-wrap">
              <div className="pagination-info">
                Menampilkan <strong>{(currentPage - 1) * pageSize + 1}</strong> s.d. <strong>{Math.min(currentPage * pageSize, students.length)}</strong> dari <strong>{students.length}</strong> data mahasiswa
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--muted)' }}>
                  <span>Tampilkan:</span>
                  <select
                    className="pagination-select"
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                  >
                    <option value={15}>15 per halaman</option>
                    <option value={25}>25 per halaman</option>
                    <option value={50}>50 per halaman</option>
                    <option value={100}>100 per halaman</option>
                  </select>
                </div>

                <div className="pagination-controls">
                  <button
                    type="button"
                    className="pagination-btn"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(1)}
                    title="Halaman Pertama"
                  >
                    <ChevronsLeft size={16} />
                  </button>
                  <button
                    type="button"
                    className="pagination-btn"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    title="Halaman Sebelumnya"
                  >
                    <ChevronLeft size={16} />
                  </button>

                  <span style={{ fontSize: 13, fontWeight: 700, padding: '0 8px', color: 'var(--ink)' }}>
                    Halaman {currentPage} / {totalPages}
                  </span>

                  <button
                    type="button"
                    className="pagination-btn"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    title="Halaman Berikutnya"
                  >
                    <ChevronRight size={16} />
                  </button>
                  <button
                    type="button"
                    className="pagination-btn"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(totalPages)}
                    title="Halaman Terakhir"
                  >
                    <ChevronsRight size={16} />
                  </button>
                </div>
              </div>
            </div>
          </>
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
              <div className="modal-body" style={{ maxHeight: 'calc(85vh - 130px)', overflowY: 'auto' }}>
                {formError && (
                  <div style={{ padding: '10px 14px', background: 'var(--danger-bg)', color: 'var(--danger)', borderRadius: 8, fontSize: 13, marginBottom: 16 }}>
                    {formError}
                  </div>
                )}

                {/* Section 1: Identitas Kependudukan */}
                <div className="form-section-card">
                  <div className="form-section-title">
                    <UserCheck size={16} />
                    <span>1. Identitas Kependudukan</span>
                  </div>
                  <div className="form-grid-2">
                    <div className="form-group">
                      <label>NIM Mahasiswa *</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Contoh: 051234567"
                        value={formData.nim}
                        onChange={(e) => setFormData({ ...formData, nim: e.target.value })}
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label>Nama Lengkap (Capital Each Word) *</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Contoh: Budi Santoso"
                        value={formData.full_name}
                        onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label>Nomor KTP / NIK (16 Digit)</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="3603100510860014"
                        value={formData.no_ktp}
                        onChange={(e) => setFormData({ ...formData, no_ktp: e.target.value })}
                      />
                    </div>

                    <div className="form-group">
                      <label>Nama Ibu Kandung</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Nama Ibu Kandung"
                        value={formData.nama_ibu_kandung}
                        onChange={(e) => setFormData({ ...formData, nama_ibu_kandung: e.target.value })}
                      />
                    </div>

                    <div className="form-group">
                      <label>Tempat Lahir</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Tangerang"
                        value={formData.tempat_lahir}
                        onChange={(e) => setFormData({ ...formData, tempat_lahir: e.target.value })}
                      />
                    </div>

                    <div className="form-group">
                      <label>Tanggal Lahir</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="14 September 2000"
                        value={formData.tanggal_lahir}
                        onChange={(e) => setFormData({ ...formData, tanggal_lahir: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                {/* Section 2: Akademik & Program Studi */}
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
                        value={formData.study_program_id}
                        onChange={(e) => setFormData({ ...formData, study_program_id: e.target.value })}
                      >
                        <option value="">Pilih Program Studi</option>
                        {prodis.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
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
                      <label>Periode Masuk (e.g. 2023.1)</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="2023.1"
                        value={formData.entry_period}
                        onChange={(e) => {
                          const val = e.target.value;
                          const match = val.match(/(20\d{2})\.([12])/);
                          setFormData({
                            ...formData,
                            entry_period: val,
                            entry_year: match ? match[1] : formData.entry_year,
                            entry_semester: match ? (match[2] === '1' ? 'ganjil' : 'genap') : formData.entry_semester,
                          });
                        }}
                      />
                    </div>

                    <div className="form-group">
                      <label>Registrasi Awal (String Master Data)</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="UNIVERSITAS TERBUKA 2023.1"
                        value={formData.initial_registration}
                        onChange={(e) => setFormData({ ...formData, initial_registration: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                {/* Section 3: Kontak & Domisili */}
                <div className="form-section-card" style={{ marginBottom: 0 }}>
                  <div className="form-section-title">
                    <Phone size={16} />
                    <span>3. Kontak & Domisili</span>
                  </div>
                  <div className="form-grid-2">
                    <div className="form-group">
                      <label>Nomor HP / Kontak (WA)</label>
                      <input
                        type="tel"
                        className="form-control"
                        placeholder="081234567890"
                        value={formData.phone_number}
                        onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                      />
                    </div>

                    <div className="form-group">
                      <label>Email Mahasiswa</label>
                      <input
                        type="email"
                        className="form-control"
                        placeholder="mahasiswa@ecampus.ut.ac.id"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      />
                    </div>

                    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                      <label>Alamat Tinggal Lengkap</label>
                      <textarea
                        className="form-control"
                        rows={2}
                        placeholder="Alamat domisili lengkap mahasiswa..."
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      />
                    </div>
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
