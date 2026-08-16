import React, { useState, useEffect, useCallback } from 'react';
import { Database, Plus, Edit2, Trash2, CheckCircle2, X } from 'lucide-react';
import { masterApi } from '../services/api';
import { useToast } from '../components/common/Toast';
import { useAuth } from '../context/AuthContext';

export default function MasterPage() {
  const { showToast } = useToast();
  const { isViewer } = useAuth();

  const [activeTab, setActiveTab] = useState('prodi'); // 'prodi' | 'period'

  // Prodi State
  const [prodis, setProdis] = useState([]);
  const [prodiLoading, setProdiLoading] = useState(true);
  const [prodiModalOpen, setProdiModalOpen] = useState(false);
  const [editingProdi, setEditingProdi] = useState(null);
  const [prodiForm, setProdiForm] = useState({
    code: '',
    name: '',
    degree: 'S1',
    faculty: '',
    is_active: 1,
  });
  const [prodiError, setProdiError] = useState('');
  const [prodiSaving, setProdiSaving] = useState(false);

  // Period State
  const [periods, setPeriods] = useState([]);
  const [periodLoading, setPeriodLoading] = useState(true);
  const [periodModalOpen, setPeriodModalOpen] = useState(false);
  const [editingPeriod, setEditingPeriod] = useState(null);
  const [periodForm, setPeriodForm] = useState({
    code: '',
    name: '',
    semester_type: 'ganjil',
    default_due_date: '',
    is_active: 1,
  });
  const [periodError, setPeriodError] = useState('');
  const [periodSaving, setPeriodSaving] = useState(false);

  const fetchProdis = useCallback(async () => {
    setProdiLoading(true);
    try {
      const res = await masterApi.listProdi();
      setProdis(res.study_programs || []);
    } catch (err) {
      showToast(err.message || 'Gagal memuat Program Studi.', 'error');
    } finally {
      setProdiLoading(false);
    }
  }, [showToast]);

  const fetchPeriods = useCallback(async () => {
    setPeriodLoading(true);
    try {
      const res = await masterApi.listPeriods();
      setPeriods(res.academic_periods || []);
    } catch (err) {
      showToast(err.message || 'Gagal memuat Periode Akademik.', 'error');
    } finally {
      setPeriodLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchProdis();
    fetchPeriods();
  }, [fetchProdis, fetchPeriods]);

  // Prodi Handlers
  const handleOpenProdiCreate = () => {
    setEditingProdi(null);
    setProdiForm({
      code: '',
      name: '',
      degree: 'S1',
      faculty: 'Fakultas Hukum, Ilmu Sosial, dan Ilmu Politik',
      is_active: 1,
    });
    setProdiError('');
    setProdiModalOpen(true);
  };

  const handleOpenProdiEdit = (p) => {
    setEditingProdi(p);
    setProdiForm({
      code: p.code,
      name: p.name,
      degree: p.degree || 'S1',
      faculty: p.faculty || '',
      is_active: p.is_active ? 1 : 0,
    });
    setProdiError('');
    setProdiModalOpen(true);
  };

  const handleSaveProdi = async (e) => {
    e.preventDefault();
    if (!prodiForm.code || !prodiForm.name) {
      setProdiError('Kode dan Nama Program Studi wajib diisi.');
      return;
    }
    setProdiError('');
    setProdiSaving(true);
    try {
      if (editingProdi) {
        await masterApi.updateProdi(editingProdi.id, prodiForm);
        showToast('Program Studi berhasil diperbarui.');
      } else {
        await masterApi.createProdi(prodiForm);
        showToast('Program Studi baru berhasil ditambahkan.');
      }
      setProdiModalOpen(false);
      fetchProdis();
    } catch (err) {
      setProdiError(err.message || 'Gagal menyimpan Program Studi.');
    } finally {
      setProdiSaving(false);
    }
  };

  // Period Handlers
  const handleOpenPeriodCreate = () => {
    setEditingPeriod(null);
    setPeriodForm({
      code: '',
      name: '',
      semester_type: 'ganjil',
      default_due_date: '',
      is_active: 0,
    });
    setPeriodError('');
    setPeriodModalOpen(true);
  };

  const handleOpenPeriodEdit = (p) => {
    setEditingPeriod(p);
    setPeriodForm({
      code: p.code,
      name: p.name,
      semester_type: p.semester_type || p.period_type || 'ganjil',
      default_due_date: p.default_due_date || '',
      is_active: p.is_active ? 1 : 0,
    });
    setPeriodError('');
    setPeriodModalOpen(true);
  };

  const handleSavePeriod = async (e) => {
    e.preventDefault();
    if (!periodForm.code || !periodForm.name) {
      setPeriodError('Kode dan Nama Periode Akademik wajib diisi.');
      return;
    }
    setPeriodError('');
    setPeriodSaving(true);
    try {
      if (editingPeriod) {
        await masterApi.updatePeriod(editingPeriod.id, periodForm);
        showToast('Periode Akademik berhasil diperbarui.');
      } else {
        await masterApi.createPeriod(periodForm);
        showToast('Periode Akademik baru berhasil ditambahkan.');
      }
      setPeriodModalOpen(false);
      fetchPeriods();
    } catch (err) {
      setPeriodError(err.message || 'Gagal menyimpan Periode Akademik.');
    } finally {
      setPeriodSaving(false);
    }
  };

  return (
    <div>
      {/* Tabs */}
      <div className="tab-bar">
        <button
          type="button"
          className={`tab-btn ${activeTab === 'prodi' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('prodi')}
        >
          Master Program Studi ({prodis.length})
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'period' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('period')}
        >
          Master Periode Akademik ({periods.length})
        </button>
      </div>

      {/* TAB 1: PROGRAM STUDI */}
      {activeTab === 'prodi' && (
        <div className="panel-card">
          <div className="toolbar-row">
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--ink)' }}>
                Daftar Program Studi Terdaftar
              </h3>
              <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                Master data program studi untuk relasi mahasiswa dan laporan keuangan
              </p>
            </div>

            {!isViewer && (
              <button type="button" className="btn btn-primary" onClick={handleOpenProdiCreate}>
                <Plus size={16} />
                <span>Tambah Program Studi</span>
              </button>
            )}
          </div>

          {prodiLoading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
              <span>Memuat Program Studi...</span>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Kode</th>
                    <th>Nama Program Studi</th>
                    <th>Jenjang</th>
                    <th>Fakultas</th>
                    <th style={{ textAlign: 'right' }}>Mahasiswa</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {prodis.map((p) => (
                    <tr key={p.id}>
                      <td><strong>{p.code}</strong></td>
                      <td>{p.name}</td>
                      <td><span className="badge badge-info">{p.degree}</span></td>
                      <td>{p.faculty || '-'}</td>
                      <td style={{ textAlign: 'right' }}><strong>{p.student_count || 0}</strong></td>
                      <td>
                        <span className={`badge ${p.is_active ? 'badge-success' : 'badge-neutral'}`}>
                          {p.is_active ? 'Aktif' : 'Non-Aktif'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {!isViewer && (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleOpenProdiEdit(p)}
                          >
                            <Edit2 size={14} />
                            <span>Edit</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: PERIODE AKADEMIK */}
      {activeTab === 'period' && (
        <div className="panel-card">
          <div className="toolbar-row">
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--ink)' }}>
                Daftar Periode / Semester Akademik
              </h3>
              <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                Kalender semester akademik untuk penetapan tagihan berjalan
              </p>
            </div>

            {!isViewer && (
              <button type="button" className="btn btn-primary" onClick={handleOpenPeriodCreate}>
                <Plus size={16} />
                <span>Tambah Periode Akademik</span>
              </button>
            )}
          </div>

          {periodLoading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
              <span>Memuat Periode Akademik...</span>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Kode Semester</th>
                    <th>Nama Periode</th>
                    <th>Tipe</th>
                    <th>Batas Pembayaran Default</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {periods.map((p) => {
                    const semType = p.semester_type || p.period_type || 'ganjil';
                    return (
                      <tr key={p.id}>
                        <td><strong>{p.code}</strong></td>
                        <td>{p.name}</td>
                        <td>
                          <span className={`badge ${semType === 'ganjil' ? 'badge-info' : 'badge-warning'}`}>
                            {semType}
                          </span>
                        </td>
                        <td>{p.default_due_date || '-'}</td>
                        <td>
                          {p.is_active ? (
                            <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <CheckCircle2 size={12} />
                              <span>Semester Aktif</span>
                            </span>
                          ) : (
                            <span className="badge badge-neutral">Arsip</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {!isViewer && (
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleOpenPeriodEdit(p)}
                            >
                              <Edit2 size={14} />
                              <span>Edit</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Prodi Modal */}
      {prodiModalOpen && (
        <div className="modal-backdrop" onClick={() => setProdiModalOpen(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()} role="dialog">
            <div className="modal-header">
              <h2>{editingProdi ? 'Edit Program Studi' : 'Tambah Program Studi'}</h2>
              <button type="button" className="modal-close-btn" onClick={() => setProdiModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveProdi}>
              <div className="modal-body">
                {prodiError && (
                  <div style={{ padding: '10px 14px', background: 'var(--danger-bg)', color: 'var(--danger)', borderRadius: 8, fontSize: 13, marginBottom: 16 }}>
                    {prodiError}
                  </div>
                )}
                <div className="form-group">
                  <label>Kode Program Studi *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Contoh: 311 (Ilmu Hukum)"
                    value={prodiForm.code}
                    onChange={(e) => setProdiForm({ ...prodiForm, code: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Nama Program Studi *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Contoh: S1 Ilmu Hukum"
                    value={prodiForm.name}
                    onChange={(e) => setProdiForm({ ...prodiForm, name: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Jenjang Pendidikan</label>
                  <select
                    className="form-control"
                    value={prodiForm.degree}
                    onChange={(e) => setProdiForm({ ...prodiForm, degree: e.target.value })}
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
                    value={prodiForm.faculty}
                    onChange={(e) => setProdiForm({ ...prodiForm, faculty: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={Boolean(prodiForm.is_active)}
                      onChange={(e) => setProdiForm({ ...prodiForm, is_active: e.target.checked ? 1 : 0 })}
                    />
                    <span>Program Studi Aktif Menerima Mahasiswa</span>
                  </label>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setProdiModalOpen(false)} disabled={prodiSaving}>
                  Batal
                </button>
                <button type="submit" className="btn btn-primary" disabled={prodiSaving}>
                  {prodiSaving ? 'Menyimpan...' : 'Simpan Program Studi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Period Modal */}
      {periodModalOpen && (
        <div className="modal-backdrop" onClick={() => setPeriodModalOpen(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()} role="dialog">
            <div className="modal-header">
              <h2>{editingPeriod ? 'Edit Periode Akademik' : 'Tambah Periode Akademik'}</h2>
              <button type="button" className="modal-close-btn" onClick={() => setPeriodModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSavePeriod}>
              <div className="modal-body">
                {periodError && (
                  <div style={{ padding: '10px 14px', background: 'var(--danger-bg)', color: 'var(--danger)', borderRadius: 8, fontSize: 13, marginBottom: 16 }}>
                    {periodError}
                  </div>
                )}
                <div className="form-group">
                  <label>Kode Semester *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Contoh: 20251 atau 20252"
                    value={periodForm.code}
                    onChange={(e) => setPeriodForm({ ...periodForm, code: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Nama Periode / Semester *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Contoh: Semester 2025/2026 Ganjil"
                    value={periodForm.name}
                    onChange={(e) => setPeriodForm({ ...periodForm, name: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Tipe Semester</label>
                  <select
                    className="form-control"
                    value={periodForm.semester_type}
                    onChange={(e) => setPeriodForm({ ...periodForm, semester_type: e.target.value })}
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
                    value={periodForm.default_due_date}
                    onChange={(e) => setPeriodForm({ ...periodForm, default_due_date: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={Boolean(periodForm.is_active)}
                      onChange={(e) => setPeriodForm({ ...periodForm, is_active: e.target.checked ? 1 : 0 })}
                    />
                    <span>Tetapkan sebagai Semester Aktif</span>
                  </label>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setPeriodModalOpen(false)} disabled={periodSaving}>
                  Batal
                </button>
                <button type="submit" className="btn btn-primary" disabled={periodSaving}>
                  {periodSaving ? 'Menyimpan...' : 'Simpan Periode Akademik'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
