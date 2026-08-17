import React, { useState, useEffect, useCallback } from 'react';
import { Search, Plus, Edit2, Trash2, ChevronLeft, ChevronRight, CheckCircle2, RefreshCw } from 'lucide-react';
import { billsApi, studentsApi, masterApi } from '../services/api';
import { useToast } from '../components/common/Toast';
import { useAuth } from '../context/AuthContext';
import ConfirmModal from '../components/common/ConfirmModal';

export default function BillsPage() {
  const { showToast } = useToast();
  const { isViewer } = useAuth();

  const [bills, setBills] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Filters & Pagination
  const [query, setQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedSource, setSelectedSource] = useState('');
  const [page, setPage] = useState(1);
  const limit = 100;

  // Master options for modal
  const [periods, setPeriods] = useState([]);
  const [students, setStudents] = useState([]);

  // Modals state
  const [editorModalOpen, setEditorModalOpen] = useState(false);
  const [editingBill, setEditingBill] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    student_id: '',
    period: '20251',
    bill_type: 'SPP / UKT',
    amount: '',
    briva: '',
    status: 'unpaid',
    due_date: '',
    instructions: '',
  });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchMasterOptions = async () => {
    try {
      const [pRes, sRes] = await Promise.all([
        masterApi.listPeriods(),
        studentsApi.list({ limit: 1000 }),
      ]);
      setPeriods(pRes.academic_periods || []);
      setStudents(sRes.students || []);
    } catch {}
  };

  const fetchBills = useCallback(async () => {
    setLoading(true);
    try {
      const offset = (page - 1) * limit;
      const res = await billsApi.list({
        query: query.trim(),
        status: selectedStatus,
        source: selectedSource,
        limit,
        offset,
      });
      setBills(res.bills || []);
      setTotalCount(res.total_count || 0);
    } catch (err) {
      showToast(err.message || 'Gagal memuat daftar tagihan.', 'error');
    } finally {
      setLoading(false);
    }
  }, [query, selectedStatus, selectedSource, page, showToast]);

  useEffect(() => {
    fetchMasterOptions();
  }, []);

  useEffect(() => {
    fetchBills();
  }, [fetchBills]);

  const handleStatusChange = async (billId, newStatus) => {
    if (isViewer) return;
    try {
      await billsApi.updateStatus(billId, newStatus);
      showToast('Status tagihan berhasil diperbarui.');
      setBills((prev) =>
        prev.map((b) => (b.id === billId ? { ...b, status: newStatus } : b))
      );
    } catch (err) {
      showToast(err.message || 'Gagal memperbarui status tagihan.', 'error');
    }
  };

  const handleOpenCreate = () => {
    setEditingBill(null);
    setFormData({
      student_id: students[0]?.id || '',
      period: periods.find((p) => p.is_active)?.code || '20251',
      bill_type: 'SPP / UKT',
      amount: '',
      briva: '',
      status: 'unpaid',
      due_date: '',
      instructions: '',
    });
    setFormError('');
    setEditorModalOpen(true);
  };

  const handleOpenEdit = (bill) => {
    setEditingBill(bill);
    setFormData({
      student_id: bill.student_id,
      period: bill.period,
      bill_type: bill.bill_type || 'SPP / UKT',
      amount: String(bill.amount),
      briva: bill.briva,
      status: bill.status || 'unpaid',
      due_date: bill.due_date || '',
      instructions: bill.instructions || '',
    });
    setFormError('');
    setEditorModalOpen(true);
  };

  const handleSaveBill = async (e) => {
    e.preventDefault();
    if (!formData.student_id || !formData.amount || !formData.briva) {
      setFormError('Mahasiswa, Nominal, dan BRIVA wajib diisi.');
      return;
    }
    setFormError('');
    setSaving(true);

    const payload = {
      ...formData,
      amount: Number(formData.amount),
      due_date: formData.due_date || null,
      instructions: formData.instructions || null,
    };

    try {
      if (editingBill) {
        await billsApi.update(editingBill.id, payload);
        showToast('Tagihan berhasil diperbarui.');
      } else {
        await billsApi.create(payload);
        showToast('Tagihan baru berhasil dibuat.');
      }
      setEditorModalOpen(false);
      fetchBills();
    } catch (err) {
      setFormError(err.message || 'Gagal menyimpan tagihan.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteConfirm = async (reason) => {
    if (!deleteTarget) return;
    await billsApi.delete(deleteTarget.id, reason);
    showToast(`Tagihan ${deleteTarget.amount_formatted} berhasil dihapus.`);
    setDeleteTarget(null);
    fetchBills();
  };

  const totalPages = Math.ceil(totalCount / limit) || 1;

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
                placeholder="Cari NIM, nama mahasiswa, BRIVA..."
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
              />
            </div>

            <select
              className="select-filter"
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Semua Status</option>
              <option value="unpaid">Belum Lunas</option>
              <option value="partial">Bayar Sebagian</option>
              <option value="paid">Lunas</option>
            </select>

            <select
              className="select-filter"
              value={selectedSource}
              onChange={(e) => {
                setSelectedSource(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Semua Sumber</option>
              <option value="import">Hasil Import Excel</option>
              <option value="manual">Input Manual</option>
            </select>

            <button
              type="button"
              className="btn btn-secondary"
              style={{ height: 38, padding: '0 12px' }}
              onClick={() => {
                setQuery('');
                setSelectedStatus('');
                setSelectedSource('');
                setPage(1);
              }}
              title="Reset Filter"
            >
              <RefreshCw size={14} />
              <span>Reset</span>
            </button>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <span className="badge badge-neutral">
              {totalCount} Total Tagihan
            </span>
            {!isViewer && (
              <button type="button" className="btn btn-primary" onClick={handleOpenCreate}>
                <Plus size={16} />
                <span>Buat Tagihan</span>
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
            <span>Memuat daftar tagihan...</span>
          </div>
        ) : !bills.length ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
            <p>Tidak ada tagihan yang sesuai dengan filter.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Mahasiswa</th>
                  <th>Periode</th>
                  <th>Jenis Tagihan</th>
                  <th>Nominal</th>
                  <th>Status Pembayaran</th>
                  <th>Batas Aktif</th>
                  <th>Nomor BRIVA</th>
                  <th style={{ textAlign: 'right' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {bills.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <strong>{b.student_name}</strong>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>NIM: {b.student_nim}</div>
                    </td>
                    <td>{b.period}</td>
                    <td>{b.bill_type}</td>
                    <td><strong>{b.amount_formatted}</strong></td>
                    <td>
                      {isViewer ? (
                        <span className={`badge ${b.status === 'paid' ? 'badge-success' : b.status === 'partial' ? 'badge-warning' : 'badge-danger'}`}>
                          {b.status === 'paid' ? 'Lunas' : b.status === 'partial' ? 'Sebagian' : 'Belum Lunas'}
                        </span>
                      ) : (
                        <select
                          className="select-filter"
                          style={{
                            padding: '4px 8px',
                            fontSize: 12,
                            fontWeight: 700,
                            background: b.status === 'paid' ? '#dcfce7' : b.status === 'partial' ? '#fef3c7' : '#fee2e2',
                            color: b.status === 'paid' ? '#166534' : b.status === 'partial' ? '#92400e' : '#991b1b',
                            border: 'none',
                          }}
                          value={b.status}
                          onChange={(e) => handleStatusChange(b.id, e.target.value)}
                        >
                          <option value="unpaid">Belum Lunas</option>
                          <option value="partial">Bayar Sebagian</option>
                          <option value="paid">Lunas</option>
                        </select>
                      )}
                    </td>
                    <td>{b.due_date_formatted || '-'}</td>
                    <td><code style={{ fontFamily: 'var(--font-mono)' }}>{b.briva}</code></td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {!isViewer && (
                        <>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{ marginRight: 6 }}
                            onClick={() => handleOpenEdit(b)}
                            title="Edit Tagihan"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            onClick={() => setDeleteTarget(b)}
                            title="Hapus Tagihan"
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

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--line)' }}>
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>
              Halaman {page} dari {totalPages}
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft size={16} />
                <span>Sebelumnya</span>
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                <span>Berikutnya</span>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create / Edit Bill Modal */}
      {editorModalOpen && (
        <div className="modal-backdrop" onClick={() => setEditorModalOpen(false)}>
          <div
            className="modal-dialog large"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="modal-header">
              <h2>{editingBill ? 'Edit Tagihan Mahasiswa' : 'Buat Tagihan Baru'}</h2>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setEditorModalOpen(false)}
                aria-label="Tutup"
              >
                <ChevronLeft size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveBill}>
              <div className="modal-body">
                {formError && (
                  <div style={{ padding: '10px 14px', background: 'var(--danger-bg)', color: 'var(--danger)', borderRadius: 8, fontSize: 13, marginBottom: 16 }}>
                    {formError}
                  </div>
                )}

                <div className="form-grid-2">
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label>Pilih Mahasiswa *</label>
                    <select
                      className="form-control"
                      value={formData.student_id}
                      onChange={(e) => setFormData({ ...formData, student_id: e.target.value })}
                      disabled={Boolean(editingBill)}
                      required
                    >
                      <option value="">-- Pilih Mahasiswa --</option>
                      {students.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.nim} - {s.full_name} ({s.study_program_name || s.program_study || '-'})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Periode Akademik *</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="20251"
                      value={formData.period}
                      onChange={(e) => setFormData({ ...formData, period: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Jenis Tagihan *</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="SPP / UKT"
                      value={formData.bill_type}
                      onChange={(e) => setFormData({ ...formData, bill_type: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Nominal Tagihan (Rp) *</label>
                    <input
                      type="number"
                      className="form-control"
                      placeholder="1850000"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Nomor BRIVA *</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="178100023200040"
                      value={formData.briva}
                      onChange={(e) => setFormData({ ...formData, briva: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Status Pembayaran</label>
                    <select
                      className="form-control"
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    >
                      <option value="unpaid">Belum Lunas</option>
                      <option value="partial">Bayar Sebagian</option>
                      <option value="paid">Lunas</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Batas Aktif Pembayaran</label>
                    <input
                      type="date"
                      className="form-control"
                      value={formData.due_date}
                      onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                    />
                  </div>

                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label>Instruksi Pembayaran Khusus</label>
                    <textarea
                      className="form-control"
                      rows={2}
                      placeholder="Petunjuk khusus pembayaran..."
                      value={formData.instructions}
                      onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
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
                  {saving ? 'Menyimpan...' : 'Simpan Tagihan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        title="Hapus Tagihan Mahasiswa"
        description={`Apakah Anda yakin ingin menghapus tagihan sebesar ${deleteTarget?.amount_formatted} untuk mahasiswa "${deleteTarget?.student_name}"?`}
        confirmText="Hapus Tagihan"
        onConfirm={handleDeleteConfirm}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
