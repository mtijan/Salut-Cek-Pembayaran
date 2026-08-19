import React, { useState, useEffect, useCallback } from 'react';
import { Search, Plus, Edit2, Trash2, ChevronLeft, ChevronRight, CheckCircle2, RefreshCw, AlertCircle, Info, DollarSign, UserCheck } from 'lucide-react';
import { billsApi, studentsApi, masterApi } from '../services/api';
import { useToast } from '../components/common/Toast';
import { useAuth } from '../context/AuthContext';
import ConfirmModal from '../components/common/ConfirmModal';

const formatRupiah = (val) => {
  const num = Number(val) || 0;
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
};

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
    period_mode: 'master',
    period: '20251',
    custom_period: '',
    bill_type_mode: 'UKT',
    custom_bill_type: '',
    amount: '',
    paid_amount: '',
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

  const handleStatusChange = async (bill, newStatus) => {
    if (isViewer) return;
    if (newStatus === 'partial') {
      // Open edit modal directly to allow entering partial paid_amount with full calculation UI
      handleOpenEdit(bill, 'partial');
      return;
    }
    try {
      await billsApi.updateStatus(bill.id, newStatus);
      showToast('Status tagihan berhasil diperbarui.');
      fetchBills();
    } catch (err) {
      showToast(err.message || 'Gagal memperbarui status tagihan.', 'error');
    }
  };

  const handleOpenCreate = () => {
    setEditingBill(null);
    const activePeriod = periods.find((p) => p.is_active)?.code || (periods[0]?.code || '20251');
    setFormData({
      student_id: students[0]?.id || '',
      period_mode: 'master',
      period: activePeriod,
      custom_period: '',
      bill_type_mode: 'UKT',
      custom_bill_type: '',
      amount: '',
      paid_amount: '',
      briva: '',
      status: 'unpaid',
      due_date: '',
      instructions: '',
    });
    setFormError('');
    setEditorModalOpen(true);
  };

  const handleOpenEdit = (bill, overrideStatus = null) => {
    setEditingBill(bill);

    // Resolve period mode
    const isMasterPeriod = periods.some((p) => p.code === bill.period);
    const periodMode = isMasterPeriod ? 'master' : (bill.period ? 'custom' : 'master');
    const periodVal = isMasterPeriod ? bill.period : (periods[0]?.code || '20251');
    const customPeriodVal = !isMasterPeriod ? bill.period : '';

    // Resolve bill type mode
    const upperType = (bill.bill_type || '').toUpperCase();
    let typeMode = 'custom';
    let customTypeVal = bill.bill_type || '';
    if (upperType === 'UKT' || upperType.includes('UKT') || upperType.includes('SPP')) {
      typeMode = 'UKT';
      customTypeVal = '';
    } else if (upperType === 'WISUDA' || upperType.includes('WISUDA')) {
      typeMode = 'WISUDA';
      customTypeVal = '';
    }

    const currentStatus = overrideStatus || bill.status || 'unpaid';
    const currentPaid = bill.paid_amount || (currentStatus === 'paid' ? bill.amount : '');

    setFormData({
      student_id: bill.student_id,
      period_mode: periodMode,
      period: periodVal,
      custom_period: customPeriodVal,
      bill_type_mode: typeMode,
      custom_bill_type: customTypeVal,
      amount: String(bill.amount || ''),
      paid_amount: String(currentPaid || ''),
      briva: bill.briva || '',
      status: currentStatus,
      due_date: bill.due_date || '',
      instructions: bill.instructions || '',
    });
    setFormError('');
    setEditorModalOpen(true);
  };

  const handleSaveBill = async (e) => {
    e.preventDefault();

    // Determine final period
    let finalPeriod = '';
    if (formData.period_mode === 'custom') {
      finalPeriod = formData.custom_period.trim();
      if (!finalPeriod) {
        setFormError('Periode custom wajib diisi.');
        return;
      }
    } else {
      finalPeriod = formData.period;
      if (!finalPeriod) {
        setFormError('Periode akademik wajib dipilih.');
        return;
      }
    }

    // Determine final bill type
    let finalBillType = '';
    if (formData.bill_type_mode === 'custom') {
      finalBillType = formData.custom_bill_type.trim();
      if (!finalBillType) {
        setFormError('Jenis tagihan custom wajib diisi.');
        return;
      }
    } else {
      finalBillType = formData.bill_type_mode;
    }

    // Validation
    if (!editingBill && !formData.student_id) {
      setFormError('Mahasiswa wajib dipilih.');
      return;
    }
    if (!formData.amount || Number(formData.amount) <= 0) {
      setFormError('Nominal total tagihan wajib diisi dan lebih dari 0.');
      return;
    }
    if (!formData.briva || !formData.briva.trim()) {
      setFormError('Nomor BRIVA wajib diisi.');
      return;
    }

    const amountNum = Number(formData.amount);
    let paidAmountNum = 0;

    if (formData.status === 'paid') {
      paidAmountNum = amountNum;
    } else if (formData.status === 'unpaid') {
      paidAmountNum = 0;
    } else if (formData.status === 'partial') {
      if (!formData.paid_amount || Number(formData.paid_amount) <= 0) {
        setFormError('Nominal yang dibayarkan wajib diisi untuk status Bayar Sebagian.');
        return;
      }
      paidAmountNum = Number(formData.paid_amount);
      if (paidAmountNum >= amountNum) {
        setFormError('Nominal bayar sebagian harus lebih kecil dari total tagihan. Jika sudah lunas, silakan pilih status Lunas.');
        return;
      }
    }

    setFormError('');
    setSaving(true);

    const payload = {
      student_id: formData.student_id,
      period: finalPeriod,
      bill_type: finalBillType,
      amount: amountNum,
      paid_amount: paidAmountNum,
      briva: formData.briva.trim(),
      status: formData.status,
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
      fetchMasterOptions();
      fetchBills();
    } catch (err) {
      setFormError(err.message || 'Gagal menyimpan tagihan.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteConfirm = async (reason) => {
    if (!deleteTarget) return;
    try {
      await billsApi.delete(deleteTarget.id, reason);
      showToast(`Tagihan ${deleteTarget.amount_formatted} berhasil dihapus.`);
      setDeleteTarget(null);
      fetchBills();
    } catch (err) {
      showToast(err.message || 'Gagal menghapus tagihan.', 'error');
    }
  };

  const totalPages = Math.ceil(totalCount / limit) || 1;

  // Real-time calculation helpers for modal
  const calcAmount = Number(formData.amount) || 0;
  const calcPaid = formData.status === 'paid' ? calcAmount : (formData.status === 'unpaid' ? 0 : (Number(formData.paid_amount) || 0));
  const calcRemaining = Math.max(0, calcAmount - calcPaid);

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
              className="btn btn-secondary btn-sm"
              onClick={() => {
                fetchBills();
                fetchMasterOptions();
              }}
              title="Muat ulang"
            >
              <RefreshCw size={14} />
            </button>
          </div>

          <div className="toolbar-actions">
            {!isViewer && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleOpenCreate}
              >
                <Plus size={16} />
                <span>Buat Tagihan</span>
              </button>
            )}
          </div>
        </div>

        {/* Total count badge */}
        <div style={{ marginBottom: 16, fontSize: 13, color: 'var(--muted)' }}>
          Menampilkan {bills.length} dari {totalCount} total tagihan
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
                  <th>Nominal Tagihan</th>
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
                      <strong>{b.student_name || b.full_name}</strong>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                        NIM: {b.student_nim || b.nim} {b.study_program_name ? `• ${b.study_program_name}` : ''}
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-info">{b.period}</span>
                    </td>
                    <td>{b.bill_type}</td>
                    <td>
                      <div>
                        <strong>{b.amount_formatted}</strong>
                      </div>
                      {b.status === 'partial' && (
                        <div style={{ fontSize: 11, marginTop: 4 }}>
                          <span style={{ color: 'var(--success)', fontWeight: 600 }}>
                            Dibayar: {b.paid_amount_formatted}
                          </span>
                          <br />
                          <span style={{ color: 'var(--danger)', fontWeight: 600 }}>
                            Sisa: {b.remaining_amount_formatted}
                          </span>
                        </div>
                      )}
                      {b.status === 'paid' && (
                        <div style={{ fontSize: 11, color: 'var(--success)', marginTop: 2 }}>
                          Lunas penuh
                        </div>
                      )}
                    </td>
                    <td>
                      {isViewer ? (
                        <span className={`badge ${b.status === 'paid' ? 'badge-success' : b.status === 'partial' ? 'badge-warning' : 'badge-danger'}`}>
                          {b.status === 'paid' ? 'Lunas' : b.status === 'partial' ? 'Bayar Sebagian' : 'Belum Lunas'}
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
                            cursor: 'pointer',
                          }}
                          value={b.status}
                          onChange={(e) => handleStatusChange(b, e.target.value)}
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
                  <div style={{ padding: '10px 14px', background: 'var(--danger-bg)', color: 'var(--danger)', borderRadius: 8, fontSize: 13, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <AlertCircle size={16} />
                    <span>{formError}</span>
                  </div>
                )}

                {/* Edit Mode: Readonly Student Badge */}
                {editingBill ? (
                  <div style={{ padding: '14px 16px', background: 'var(--bg-subtle, #f8fafc)', border: '1px solid var(--line)', borderRadius: 8, marginBottom: 18 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <UserCheck size={16} style={{ color: 'var(--primary)' }} />
                      <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--primary)' }}>
                        Mahasiswa Terkait (Terkunci)
                      </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, fontSize: 13 }}>
                      <div>
                        <span style={{ color: 'var(--muted)', fontSize: 11, display: 'block' }}>NIM</span>
                        <strong>{editingBill.student_nim || editingBill.nim}</strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--muted)', fontSize: 11, display: 'block' }}>Nama Lengkap</span>
                        <strong>{editingBill.student_name || editingBill.full_name}</strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--muted)', fontSize: 11, display: 'block' }}>Program Studi</span>
                        <span>{editingBill.study_program_name || '-'}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Create Mode: Select Student */
                  <div className="form-group" style={{ marginBottom: 16 }}>
                    <label>Pilih Mahasiswa *</label>
                    <select
                      className="form-control"
                      value={formData.student_id}
                      onChange={(e) => setFormData({ ...formData, student_id: e.target.value })}
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
                )}

                <div className="form-grid-2">
                  {/* Jenis Tagihan Dropdown */}
                  <div className="form-group">
                    <label>Jenis Tagihan *</label>
                    <select
                      className="form-control"
                      value={formData.bill_type_mode}
                      onChange={(e) => setFormData({ ...formData, bill_type_mode: e.target.value })}
                      required
                    >
                      <option value="UKT">UKT (Uang Kuliah Tunggal / SPP)</option>
                      <option value="WISUDA">WISUDA (Biaya Wisuda)</option>
                      <option value="custom">Custom (Jenis Lainnya)</option>
                    </select>
                    {formData.bill_type_mode === 'custom' && (
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Masukkan jenis tagihan (contoh: PRAKTIKUM)"
                        style={{ marginTop: 8 }}
                        value={formData.custom_bill_type}
                        onChange={(e) => setFormData({ ...formData, custom_bill_type: e.target.value })}
                        required
                      />
                    )}
                  </div>

                  {/* Periode Akademik Dropdown */}
                  <div className="form-group">
                    <label>Periode Akademik *</label>
                    <select
                      className="form-control"
                      value={formData.period_mode === 'custom' ? 'custom' : formData.period}
                      onChange={(e) => {
                        if (e.target.value === 'custom') {
                          setFormData({ ...formData, period_mode: 'custom' });
                        } else {
                          setFormData({ ...formData, period_mode: 'master', period: e.target.value });
                        }
                      }}
                      required
                    >
                      {periods.map((p) => (
                        <option key={p.id || p.code} value={p.code}>
                          {p.code} - {p.name} {p.is_active ? '(Semester Aktif)' : ''}
                        </option>
                      ))}
                      <option value="custom">-- Periode Kustom Lainnya --</option>
                    </select>
                    {formData.period_mode === 'custom' && (
                      <div style={{ marginTop: 8 }}>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Masukkan kode periode (contoh: 20261 atau 2026.1)"
                          value={formData.custom_period}
                          onChange={(e) => setFormData({ ...formData, custom_period: e.target.value })}
                          required
                        />
                        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Info size={12} />
                          <span>Periode kustom akan otomatis terdaftar ke Master Periode secara global.</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Nominal Tagihan */}
                  <div className="form-group">
                    <label>Nominal Total Tagihan (Rp) *</label>
                    <input
                      type="number"
                      className="form-control"
                      placeholder="1850000"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      required
                    />
                  </div>

                  {/* Nomor BRIVA */}
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

                  {/* Status Pembayaran */}
                  <div className="form-group">
                    <label>Status Pembayaran *</label>
                    <select
                      className="form-control"
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      required
                    >
                      <option value="unpaid">Belum Lunas (Belum Ada Pembayaran)</option>
                      <option value="partial">Bayar Sebagian (Cicilan)</option>
                      <option value="paid">Lunas Penuh</option>
                    </select>
                  </div>

                  {/* Batas Aktif Pembayaran */}
                  <div className="form-group">
                    <label>Batas Aktif Pembayaran</label>
                    <input
                      type="date"
                      className="form-control"
                      value={formData.due_date}
                      onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                    />
                  </div>

                  {/* Bayar Sebagian (Partial) Input & Real-time Calculation */}
                  {formData.status === 'partial' && (
                    <div className="form-group" style={{ gridColumn: '1 / -1', padding: '14px 16px', background: '#fefce8', border: '1px solid #fef08a', borderRadius: 8 }}>
                      <label style={{ color: '#854d0e', fontWeight: 700 }}>
                        Nominal yang Dibayarkan (Rp) *
                      </label>
                      <input
                        type="number"
                        className="form-control"
                        placeholder="Contoh: 1000000"
                        style={{ marginTop: 4, background: '#fff' }}
                        value={formData.paid_amount}
                        onChange={(e) => setFormData({ ...formData, paid_amount: e.target.value })}
                        required
                      />

                      {/* Realtime calculation box */}
                      <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, background: '#fff', padding: '10px 14px', borderRadius: 6, border: '1px solid #fef08a' }}>
                        <div>
                          <span style={{ fontSize: 11, color: 'var(--muted)', display: 'block' }}>Total Tagihan</span>
                          <strong>{formatRupiah(calcAmount)}</strong>
                        </div>
                        <div>
                          <span style={{ fontSize: 11, color: '#15803d', display: 'block' }}>Nominal Dibayar</span>
                          <strong style={{ color: '#15803d' }}>{formatRupiah(calcPaid)}</strong>
                        </div>
                        <div>
                          <span style={{ fontSize: 11, color: '#b91c1c', display: 'block' }}>Sisa Piutang</span>
                          <strong style={{ color: '#b91c1c' }}>{formatRupiah(calcRemaining)}</strong>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Instruksi Pembayaran */}
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label>Instruksi Pembayaran Khusus (Opsional)</label>
                    <textarea
                      className="form-control"
                      rows={2}
                      placeholder="Bayar melalui BRIVA BRI dengan nomor BRIVA yang tampil..."
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
                  {saving ? 'Menyimpan...' : (editingBill ? 'Simpan Perubahan Tagihan' : 'Simpan Tagihan Baru')}
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
        description={`Apakah Anda yakin ingin menghapus tagihan sebesar ${deleteTarget?.amount_formatted} untuk mahasiswa "${deleteTarget?.student_name || deleteTarget?.full_name}"?`}
        confirmText="Hapus Tagihan"
        onConfirm={handleDeleteConfirm}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
