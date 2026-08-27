import React, { useState } from 'react';
import { Plus, Edit2, CheckCircle2, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useMasterPage } from '../hooks/useMasterPage';

export default function MasterPage() {
  const { can } = useAuth();
  const m = useMasterPage();
  const [activeTab, setActiveTab] = useState('prodi');

  return (
    <div>
      {/* Tabs */}
      <div className="tab-bar">
        <button
          type="button"
          className={`tab-btn ${activeTab === 'prodi' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('prodi')}
        >
          Master Program Studi ({m.prodis.length})
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'period' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('period')}
        >
          Master Periode Akademik ({m.periods.length})
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
            {can('manage_master_data') && (
              <button type="button" className="btn btn-primary" onClick={m.handleOpenProdiCreate}>
                <Plus size={16} />
                <span>Tambah Program Studi</span>
              </button>
            )}
          </div>

          {m.prodiLoading ? (
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
                  {m.prodis.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <strong>{p.code}</strong>
                      </td>
                      <td>{p.name}</td>
                      <td>
                        <span className="badge badge-info">{p.degree}</span>
                      </td>
                      <td>{p.faculty || '-'}</td>
                      <td style={{ textAlign: 'right' }}>
                        <strong>{p.student_count || 0}</strong>
                      </td>
                      <td>
                        <span
                          className={`badge ${p.is_active ? 'badge-success' : 'badge-neutral'}`}
                        >
                          {p.is_active ? 'Aktif' : 'Non-Aktif'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {can('manage_master_data') && (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => m.handleOpenProdiEdit(p)}
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
            {can('manage_master_data') && (
              <button type="button" className="btn btn-primary" onClick={m.handleOpenPeriodCreate}>
                <Plus size={16} />
                <span>Tambah Periode Akademik</span>
              </button>
            )}
          </div>

          {m.periodLoading ? (
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
                  {m.periods.map((p) => {
                    const semType = p.semester_type || p.period_type || 'ganjil';
                    return (
                      <tr key={p.id}>
                        <td>
                          <strong>{p.code}</strong>
                        </td>
                        <td>{p.name}</td>
                        <td>
                          <span
                            className={`badge ${semType === 'ganjil' ? 'badge-info' : 'badge-warning'}`}
                          >
                            {semType}
                          </span>
                        </td>
                        <td>{p.default_due_date || '-'}</td>
                        <td>
                          {p.is_active ? (
                            <span
                              className="badge badge-success"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                            >
                              <CheckCircle2 size={12} />
                              <span>Semester Aktif</span>
                            </span>
                          ) : (
                            <span className="badge badge-neutral">Arsip</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {can('manage_master_data') && (
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => m.handleOpenPeriodEdit(p)}
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
      {m.prodiModalOpen && (
        <div className="modal-backdrop" onClick={() => m.setProdiModalOpen(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()} role="dialog">
            <div className="modal-header">
              <h2>{m.editingProdi ? 'Edit Program Studi' : 'Tambah Program Studi'}</h2>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => m.setProdiModalOpen(false)}
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={m.handleSaveProdi}>
              <div className="modal-body">
                {m.prodiError && (
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
                    {m.prodiError}
                  </div>
                )}
                <div className="form-group">
                  <label>Kode Program Studi *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Contoh: 311 (Ilmu Hukum)"
                    value={m.prodiForm.code}
                    onChange={(e) => m.setProdiForm({ ...m.prodiForm, code: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Nama Program Studi *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Contoh: S1 Ilmu Hukum"
                    value={m.prodiForm.name}
                    onChange={(e) => m.setProdiForm({ ...m.prodiForm, name: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Jenjang Pendidikan</label>
                  <select
                    className="form-control"
                    value={m.prodiForm.degree}
                    onChange={(e) => m.setProdiForm({ ...m.prodiForm, degree: e.target.value })}
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
                    value={m.prodiForm.faculty}
                    onChange={(e) => m.setProdiForm({ ...m.prodiForm, faculty: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={Boolean(m.prodiForm.is_active)}
                      onChange={(e) =>
                        m.setProdiForm({ ...m.prodiForm, is_active: e.target.checked ? 1 : 0 })
                      }
                    />
                    <span>Program Studi Aktif Menerima Mahasiswa</span>
                  </label>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => m.setProdiModalOpen(false)}
                  disabled={m.prodiSaving}
                >
                  Batal
                </button>
                <button type="submit" className="btn btn-primary" disabled={m.prodiSaving}>
                  {m.prodiSaving ? 'Menyimpan...' : 'Simpan Program Studi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Period Modal */}
      {m.periodModalOpen && (
        <div className="modal-backdrop" onClick={() => m.setPeriodModalOpen(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()} role="dialog">
            <div className="modal-header">
              <h2>{m.editingPeriod ? 'Edit Periode Akademik' : 'Tambah Periode Akademik'}</h2>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => m.setPeriodModalOpen(false)}
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={m.handleSavePeriod}>
              <div className="modal-body">
                {m.periodError && (
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
                    {m.periodError}
                  </div>
                )}
                <div className="form-group">
                  <label>Kode Semester *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Contoh: 20251 atau 20252"
                    value={m.periodForm.code}
                    onChange={(e) => m.setPeriodForm({ ...m.periodForm, code: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Nama Periode / Semester *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Contoh: Semester 2025/2026 Ganjil"
                    value={m.periodForm.name}
                    onChange={(e) => m.setPeriodForm({ ...m.periodForm, name: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Tipe Semester</label>
                  <select
                    className="form-control"
                    value={m.periodForm.semester_type}
                    onChange={(e) =>
                      m.setPeriodForm({ ...m.periodForm, semester_type: e.target.value })
                    }
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
                    value={m.periodForm.default_due_date}
                    onChange={(e) =>
                      m.setPeriodForm({ ...m.periodForm, default_due_date: e.target.value })
                    }
                  />
                </div>
                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={Boolean(m.periodForm.is_active)}
                      onChange={(e) =>
                        m.setPeriodForm({ ...m.periodForm, is_active: e.target.checked ? 1 : 0 })
                      }
                    />
                    <span>Tetapkan sebagai Semester Aktif</span>
                  </label>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => m.setPeriodModalOpen(false)}
                  disabled={m.periodSaving}
                >
                  Batal
                </button>
                <button type="submit" className="btn btn-primary" disabled={m.periodSaving}>
                  {m.periodSaving ? 'Menyimpan...' : 'Simpan Periode Akademik'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
