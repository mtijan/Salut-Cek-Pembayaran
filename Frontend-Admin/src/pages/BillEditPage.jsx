import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  CreditCard,
  User,
  Check,
  Copy,
  AlertCircle,
  ChevronRight,
  RefreshCw,
  Save,
} from 'lucide-react';
import { billsApi, studentsApi, masterApi } from '../services/api';
import { useToast } from '../components/common/Toast';
import { useAuth } from '../context/AuthContext';
import { useCopyFeedback } from '../hooks/useCopyFeedback';

const formatRupiah = (val) => {
  const num = Number(val) || 0;
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
};

export default function BillEditPage({ billId, mode, navigateTo }) {
  const { showToast } = useToast();
  const { can } = useAuth();
  const isCreate = mode === 'create' || !billId;

  const [loading, setLoading] = useState(!isCreate);
  const [saving, setSaving] = useState(false);
  const { copiedKey, copyToClipboard } = useCopyFeedback();
  const [formError, setFormError] = useState('');

  // Master Data Options
  const [periods, setPeriods] = useState([]);
  const [students, setStudents] = useState([]);

  // Loaded bill & student details (for edit mode)
  const [loadedBill, setLoadedBill] = useState(null);
  const [loadedStudent, setLoadedStudent] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    student_id: '',
    nim: '',
    full_name: '',
    period_mode: 'master',
    period: '20251',
    custom_period: '',
    bill_type_mode: 'UKT',
    custom_bill_type: '',
    amount: '',
    paid_amount: '0',
    briva: '',
    status: 'unpaid',
    due_date: '',
    instructions: 'Bayar melalui BRIVA BRI dengan nomor BRIVA yang tampil.',
    notes: '',
  });

  const fetchMasterOptions = useCallback(async () => {
    try {
      const [pRes, sRes] = await Promise.all([
        masterApi.listPeriods(),
        studentsApi.list({ limit: 1000 }),
      ]);
      setPeriods(pRes.academic_periods || []);
      setStudents(sRes.students || []);
    } catch {}
  }, []);

  const fetchBillData = useCallback(async () => {
    if (isCreate || !billId) return;
    setLoading(true);
    try {
      const res = await billsApi.getDetail(billId);
      const b = res.bill || {};
      const s = res.student || {};
      setLoadedBill(b);
      setLoadedStudent(s);

      // Determine period mode
      const rawPeriod = b.period || '';
      const isPeriodInList = periods.some((p) => p.code === rawPeriod || p.name === rawPeriod);

      // Determine bill type mode
      const rawType = b.bill_type || 'UKT';
      const isKnownType = ['UKT', 'WISUDA', 'PRAKTIKUM', 'REGISTRASI'].includes(
        rawType.toUpperCase(),
      );

      setFormData({
        student_id: b.student_id || s.id || '',
        nim: s.nim || b.nim || '',
        full_name: s.full_name || b.full_name || '',
        period_mode: isPeriodInList ? 'master' : rawPeriod ? 'custom' : 'master',
        period: isPeriodInList ? rawPeriod : periods[0]?.code || '20251',
        custom_period: !isPeriodInList ? rawPeriod : '',
        bill_type_mode: isKnownType ? rawType.toUpperCase() : 'Custom',
        custom_bill_type: !isKnownType ? rawType : '',
        amount: String(b.amount || ''),
        paid_amount: String(b.paid_amount || '0'),
        briva: b.briva || '',
        status: b.status || 'unpaid',
        due_date: b.due_date ? String(b.due_date).slice(0, 10) : '',
        instructions: b.instructions || 'Bayar melalui BRIVA BRI dengan nomor BRIVA yang tampil.',
        notes: '',
      });
    } catch (err) {
      showToast(err.message || 'Gagal memuat data tagihan.', 'error');
    } finally {
      setLoading(false);
    }
  }, [billId, isCreate, periods, showToast]);

  useEffect(() => {
    fetchMasterOptions();
  }, [fetchMasterOptions]);

  useEffect(() => {
    if (periods.length > 0 || isCreate) {
      fetchBillData();
    }
  }, [periods, fetchBillData, isCreate]);

  const handleCopy = (text, label) => {
    copyToClipboard(text, label, () => showToast(`${label} disalin ke clipboard!`, 'success'));
  };

  // Status and calculations
  const totalAmountNum = Number(formData.amount) || 0;
  const paidAmountNum = Number(formData.paid_amount) || 0;
  const remainingAmountNum = Math.max(0, totalAmountNum - paidAmountNum);

  const handleStatusChange = (newStatus) => {
    let updatedPaid = formData.paid_amount;
    if (newStatus === 'paid') {
      updatedPaid = String(totalAmountNum);
    } else if (newStatus === 'unpaid') {
      updatedPaid = '0';
    } else if (newStatus === 'partial') {
      if (Number(updatedPaid) <= 0 || Number(updatedPaid) >= totalAmountNum) {
        updatedPaid = String(Math.round(totalAmountNum / 2) || 500000);
      }
    }
    setFormData((prev) => ({
      ...prev,
      status: newStatus,
      paid_amount: updatedPaid,
    }));
  };

  const handleAmountChange = (e) => {
    const val = e.target.value;
    const num = Number(val) || 0;
    setFormData((prev) => {
      let nextPaid = prev.paid_amount;
      if (prev.status === 'paid') {
        nextPaid = String(num);
      } else if (prev.status === 'partial' && Number(nextPaid) > num) {
        nextPaid = String(Math.round(num / 2));
      }
      return { ...prev, amount: val, paid_amount: nextPaid };
    });
  };

  const handlePaidAmountChange = (e) => {
    const val = e.target.value;
    const num = Number(val) || 0;
    let nextStatus = formData.status;
    if (num <= 0) {
      nextStatus = 'unpaid';
    } else if (num >= totalAmountNum && totalAmountNum > 0) {
      nextStatus = 'paid';
    } else {
      nextStatus = 'partial';
    }
    setFormData((prev) => ({
      ...prev,
      paid_amount: val,
      status: nextStatus,
    }));
  };

  const handleStudentSelect = (e) => {
    const sId = e.target.value;
    const st = students.find((s) => s.id === sId);
    if (st) {
      setFormData((prev) => ({
        ...prev,
        student_id: st.id,
        nim: st.nim,
        full_name: st.full_name,
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        student_id: '',
        nim: '',
        full_name: '',
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (isCreate && !formData.student_id && !formData.nim) {
      setFormError('Mahasiswa wajib dipilih.');
      return;
    }
    if (!formData.briva.trim()) {
      setFormError('Nomor BRIVA wajib diisi.');
      return;
    }
    if (totalAmountNum <= 0) {
      setFormError('Nominal tagihan harus berupa angka positif lebih dari 0.');
      return;
    }

    const finalPeriod =
      formData.period_mode === 'custom' ? formData.custom_period.trim() : formData.period;
    if (!finalPeriod) {
      setFormError('Periode tagihan wajib diisi.');
      return;
    }

    const finalBillType =
      formData.bill_type_mode === 'Custom'
        ? formData.custom_bill_type.trim()
        : formData.bill_type_mode;
    if (!finalBillType) {
      setFormError('Jenis tagihan wajib diisi.');
      return;
    }

    if (paidAmountNum > totalAmountNum) {
      setFormError('Nominal terbayar tidak boleh melebihi total nominal tagihan.');
      return;
    }

    const payload = {
      student_id: formData.student_id || undefined,
      nim: formData.nim || undefined,
      full_name: formData.full_name || undefined,
      period: finalPeriod,
      bill_type: finalBillType,
      amount: totalAmountNum,
      paid_amount: paidAmountNum,
      briva: formData.briva.trim(),
      status: formData.status,
      due_date: formData.due_date || null,
      instructions: formData.instructions.trim(),
    };

    setSaving(true);
    try {
      if (isCreate) {
        await billsApi.create(payload);
        showToast('Tagihan mahasiswa berhasil dibuat!', 'success');
      } else {
        await billsApi.update(billId, payload);
        showToast('Perubahan tagihan mahasiswa berhasil disimpan!', 'success');
      }
      navigateTo('bills');
    } catch (err) {
      setFormError(err.message || 'Gagal menyimpan data tagihan.');
      showToast(err.message || 'Gagal menyimpan data tagihan.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="content-container">
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '350px',
            gap: '16px',
          }}
        >
          <RefreshCw
            size={36}
            className="spin"
            style={{ color: 'var(--brand-primary, #059669)' }}
          />
          <p style={{ color: 'var(--text-muted, #6b7280)', fontSize: '15px' }}>
            Memuat formulir data tagihan...
          </p>
        </div>
      </div>
    );
  }

  const studentData = loadedStudent || {};
  const billData = loadedBill || {};

  return (
    <div className="content-container">
      {/* Top Header & Breadcrumbs */}
      <div style={{ marginBottom: '24px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '13px',
            color: 'var(--text-muted, #6b7280)',
            marginBottom: '8px',
          }}
        >
          <button
            type="button"
            onClick={() => navigateTo('bills')}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              color: 'var(--text-muted, #6b7280)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            Tagihan Mahasiswa
          </button>
          <ChevronRight size={14} />
          <span style={{ color: 'var(--text-main, #111827)', fontWeight: 600 }}>
            {isCreate ? 'Buat Tagihan Baru' : `Edit Tagihan: ${formData.briva || billData.briva}`}
          </span>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <button
              type="button"
              onClick={() => navigateTo('bills')}
              className="btn btn-secondary"
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <ArrowLeft size={16} />
              <span>Kembali</span>
            </button>
            <div>
              <h1
                style={{
                  fontSize: '22px',
                  fontWeight: 700,
                  margin: 0,
                  color: 'var(--text-main, #111827)',
                }}
              >
                {isCreate ? 'Buat Tagihan Mahasiswa Baru' : 'Edit Tagihan & Data Finansial'}
              </h1>
              <p
                style={{
                  fontSize: '13px',
                  color: 'var(--text-muted, #6b7280)',
                  margin: '4px 0 0 0',
                }}
              >
                {isCreate
                  ? 'Entri tagihan baru dengan nomor BRIVA dan kalkulasi pembayaran terstruktur'
                  : `Kelola parameter pokok tagihan, periode, jatuh tempo, dan status pembayaran untuk ${studentData.full_name || formData.full_name}`}
              </p>
            </div>
          </div>

          {!isCreate && billId && (
            <div style={{ display: 'flex', gap: '10px' }}>
              {studentData.id && (
                <button
                  type="button"
                  onClick={() => navigateTo('student-profile', { studentId: studentData.id })}
                  className="btn btn-secondary"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '13px',
                  }}
                >
                  <User size={15} />
                  <span>Lihat Profil 360</span>
                </button>
              )}
              {can('manage_billing') && (
                <button
                  type="button"
                  onClick={() => navigateTo('bill-payment', { billId })}
                  className="btn btn-primary"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '13px',
                  }}
                >
                  <CreditCard size={15} />
                  <span>Buka Halaman Kasir / Bayar</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 2-Column Grid Layout */}
      <div className="profile-layout-grid" style={{ alignItems: 'start' }}>
        {/* Left Column: Student & Bill Summary Card */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Student Identity Card */}
          <div className="card" style={{ padding: '24px', borderRadius: '12px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                marginBottom: '20px',
                paddingBottom: '16px',
                borderBottom: '1px solid var(--border-color, #e5e7eb)',
              }}
            >
              <div
                style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '20px',
                  fontWeight: 700,
                  boxShadow: '0 4px 12px rgba(5, 150, 105, 0.25)',
                }}
              >
                {(formData.full_name || 'M').charAt(0).toUpperCase()}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <h3
                  style={{
                    fontSize: '16px',
                    fontWeight: 700,
                    margin: 0,
                    color: 'var(--text-main, #111827)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {formData.full_name || (isCreate ? 'Pilih Mahasiswa' : 'Nama Mahasiswa')}
                </h3>
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}
                >
                  <span
                    style={{
                      fontFamily: 'monospace',
                      fontSize: '13px',
                      fontWeight: 600,
                      color: 'var(--brand-primary, #059669)',
                    }}
                  >
                    {formData.nim || '-'}
                  </span>
                  {formData.nim && (
                    <button
                      type="button"
                      onClick={() => handleCopy(formData.nim, 'NIM')}
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: '2px',
                        cursor: 'pointer',
                        color: 'var(--text-muted, #6b7280)',
                      }}
                      title="Salin NIM"
                    >
                      {copiedKey === 'NIM' ? (
                        <Check size={13} style={{ color: '#059669' }} />
                      ) : (
                        <Copy size={13} />
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div
              style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}
            >
              <div
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <span style={{ color: 'var(--text-muted, #6b7280)' }}>Program Studi</span>
                <span style={{ fontWeight: 600, color: 'var(--text-main, #111827)' }}>
                  {studentData.study_program_name || studentData.prodi_name || '-'}
                </span>
              </div>
              <div
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <span style={{ color: 'var(--text-muted, #6b7280)' }}>Status Akademik</span>
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: '9999px',
                    fontSize: '11px',
                    fontWeight: 600,
                    textTransform: 'capitalize',
                    background: studentData.academic_status === 'aktif' ? '#ecfdf5' : '#f3f4f6',
                    color: studentData.academic_status === 'aktif' ? '#065f46' : '#4b5563',
                  }}
                >
                  {studentData.academic_status || 'Aktif'}
                </span>
              </div>
              <div
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <span style={{ color: 'var(--text-muted, #6b7280)' }}>Sumber Entri</span>
                <span style={{ fontWeight: 500, color: 'var(--text-main, #111827)' }}>
                  {billData.source_file || (isCreate ? 'Manual Admin' : 'Manual')}
                </span>
              </div>
            </div>
          </div>

          {/* Financial Summary Card */}
          <div
            className="card"
            style={{ padding: '24px', borderRadius: '12px', background: 'var(--bg-card, #ffffff)' }}
          >
            <h4
              style={{
                fontSize: '14px',
                fontWeight: 700,
                margin: '0 0 16px 0',
                color: 'var(--text-main, #111827)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <CreditCard size={16} style={{ color: 'var(--brand-primary, #059669)' }} />
              <span>Ringkasan Saldo Tagihan</span>
            </h4>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div
                style={{
                  background: 'var(--bg-secondary, #f8fafc)',
                  padding: '12px 14px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color, #e2e8f0)',
                }}
              >
                <div
                  style={{
                    fontSize: '11px',
                    color: 'var(--text-muted, #64748b)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  Total Tagihan
                </div>
                <div
                  style={{
                    fontSize: '18px',
                    fontWeight: 700,
                    color: 'var(--text-main, #0f172a)',
                    marginTop: '2px',
                  }}
                >
                  {formatRupiah(totalAmountNum)}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div
                  style={{
                    background: '#ecfdf5',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #a7f3d0',
                  }}
                >
                  <div style={{ fontSize: '11px', color: '#065f46', fontWeight: 600 }}>
                    Terbayar
                  </div>
                  <div
                    style={{
                      fontSize: '14px',
                      fontWeight: 700,
                      color: '#047857',
                      marginTop: '2px',
                    }}
                  >
                    {formatRupiah(paidAmountNum)}
                  </div>
                </div>

                <div
                  style={{
                    background: remainingAmountNum > 0 ? '#fffbeb' : '#f1f5f9',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: remainingAmountNum > 0 ? '1px solid #fde68a' : '1px solid #cbd5e1',
                  }}
                >
                  <div
                    style={{
                      fontSize: '11px',
                      color: remainingAmountNum > 0 ? '#92400e' : '#475569',
                      fontWeight: 600,
                    }}
                  >
                    Sisa Tagihan
                  </div>
                  <div
                    style={{
                      fontSize: '14px',
                      fontWeight: 700,
                      color: remainingAmountNum > 0 ? '#b45309' : '#334155',
                      marginTop: '2px',
                    }}
                  >
                    {formatRupiah(remainingAmountNum)}
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              <div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '12px',
                    color: 'var(--text-muted, #64748b)',
                    marginBottom: '4px',
                  }}
                >
                  <span>Progres Pelunasan</span>
                  <span style={{ fontWeight: 600 }}>
                    {totalAmountNum > 0 ? Math.round((paidAmountNum / totalAmountNum) * 100) : 0}%
                  </span>
                </div>
                <div
                  style={{
                    width: '100%',
                    height: '8px',
                    background: '#e2e8f0',
                    borderRadius: '9999px',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${totalAmountNum > 0 ? Math.min(100, Math.round((paidAmountNum / totalAmountNum) * 100)) : 0}%`,
                      background: formData.status === 'paid' ? '#10b981' : '#f59e0b',
                      borderRadius: '9999px',
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingTop: '8px',
                  borderTop: '1px solid var(--border-color, #e2e8f0)',
                  fontSize: '12px',
                }}
              >
                <span style={{ color: 'var(--text-muted, #64748b)' }}>Status Saat Ini</span>
                <span
                  style={{
                    padding: '4px 10px',
                    borderRadius: '9999px',
                    fontSize: '12px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    background:
                      formData.status === 'paid'
                        ? '#dcfce7'
                        : formData.status === 'partial'
                          ? '#fef3c7'
                          : '#fee2e2',
                    color:
                      formData.status === 'paid'
                        ? '#15803d'
                        : formData.status === 'partial'
                          ? '#b45309'
                          : '#b91c1c',
                  }}
                >
                  {formData.status === 'paid'
                    ? 'LUNAS'
                    : formData.status === 'partial'
                      ? 'BAYAR SEBAGIAN'
                      : 'BELUM LUNAS'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Structured Bill Form Card */}
        <div className="card" style={{ padding: '28px', borderRadius: '12px' }}>
          <form onSubmit={handleSubmit}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingBottom: '16px',
                marginBottom: '20px',
                borderBottom: '1px solid var(--border-color, #e5e7eb)',
              }}
            >
              <div>
                <h3
                  style={{
                    fontSize: '17px',
                    fontWeight: 700,
                    margin: 0,
                    color: 'var(--text-main, #111827)',
                  }}
                >
                  {isCreate ? 'Formulir Tagihan Baru' : 'Formulir Edit Data Tagihan'}
                </h3>
                <p
                  style={{
                    fontSize: '13px',
                    color: 'var(--text-muted, #6b7280)',
                    margin: '4px 0 0 0',
                  }}
                >
                  Lengkapi seluruh informasi tagihan dengan teliti untuk sinkronisasi sistem
                  keuangan.
                </p>
              </div>
              <span
                style={{
                  padding: '4px 12px',
                  borderRadius: '9999px',
                  fontSize: '12px',
                  fontWeight: 600,
                  background: isCreate ? '#eff6ff' : '#f0fdf4',
                  color: isCreate ? '#1e40af' : '#166534',
                  border: isCreate ? '1px solid #bfdbfe' : '1px solid #bbf7d0',
                }}
              >
                {isCreate ? 'Mode Buat Baru' : 'Mode Perbarui'}
              </span>
            </div>

            {formError && (
              <div
                style={{
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '8px',
                  padding: '12px 16px',
                  marginBottom: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  color: '#991b1b',
                  fontSize: '13px',
                }}
              >
                <AlertCircle size={18} style={{ flexShrink: 0 }} />
                <span>{formError}</span>
              </div>
            )}

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                gap: '18px',
              }}
            >
              {/* Student Picker (Create Mode) or Read-Only Card (Edit Mode) */}
              <div style={{ gridColumn: '1 / -1' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: 'var(--text-main, #374151)',
                    marginBottom: '6px',
                  }}
                >
                  Mahasiswa Terkait <span style={{ color: '#ef4444' }}>*</span>
                </label>
                {isCreate ? (
                  <select
                    className="form-control"
                    value={formData.student_id}
                    onChange={handleStudentSelect}
                    required
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color, #d1d5db)',
                    }}
                  >
                    <option value="">-- Pilih Mahasiswa Penerima Tagihan --</option>
                    {students.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nim} - {s.full_name} ({s.study_program_name || 'Umum'})
                      </option>
                    ))}
                  </select>
                ) : (
                  <div
                    style={{
                      background: 'var(--bg-secondary, #f8fafc)',
                      border: '1px solid var(--border-color, #e2e8f0)',
                      borderRadius: '8px',
                      padding: '12px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px',
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontWeight: 600,
                          color: 'var(--text-main, #0f172a)',
                          fontSize: '14px',
                        }}
                      >
                        {studentData.full_name || formData.full_name}
                      </div>
                      <div
                        style={{
                          fontSize: '12px',
                          color: 'var(--text-muted, #64748b)',
                          marginTop: '2px',
                        }}
                      >
                        NIM:{' '}
                        <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                          {studentData.nim || formData.nim}
                        </span>{' '}
                        &bull; {studentData.study_program_name || 'Program Studi'}
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: '11px',
                        color: '#64748b',
                        background: '#e2e8f0',
                        padding: '3px 8px',
                        borderRadius: '4px',
                        fontWeight: 600,
                      }}
                    >
                      Terkunci (Read-Only)
                    </span>
                  </div>
                )}
              </div>

              {/* Bill Type */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: 'var(--text-main, #374151)',
                    marginBottom: '6px',
                  }}
                >
                  Jenis Tagihan <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <select
                    className="form-control"
                    value={formData.bill_type_mode}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, bill_type_mode: e.target.value }))
                    }
                    style={{
                      flex: 1,
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color, #d1d5db)',
                    }}
                  >
                    <option value="UKT">UKT (Uang Kuliah Tunggal)</option>
                    <option value="WISUDA">WISUDA</option>
                    <option value="PRAKTIKUM">PRAKTIKUM</option>
                    <option value="REGISTRASI">REGISTRASI AWAL</option>
                    <option value="Custom">Custom / Lainnya</option>
                  </select>
                  {formData.bill_type_mode === 'Custom' && (
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Nama jenis tagihan..."
                      value={formData.custom_bill_type}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, custom_bill_type: e.target.value }))
                      }
                      required
                      style={{
                        flex: 1,
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color, #d1d5db)',
                      }}
                    />
                  )}
                </div>
              </div>

              {/* Academic Period */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: 'var(--text-main, #374151)',
                    marginBottom: '6px',
                  }}
                >
                  Periode Tagihan <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <select
                    className="form-control"
                    value={formData.period_mode === 'custom' ? 'custom' : formData.period}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === 'custom') {
                        setFormData((prev) => ({ ...prev, period_mode: 'custom' }));
                      } else {
                        setFormData((prev) => ({ ...prev, period_mode: 'master', period: val }));
                      }
                    }}
                    style={{
                      flex: 1,
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color, #d1d5db)',
                    }}
                  >
                    {periods.map((p) => (
                      <option key={p.id} value={p.code}>
                        {p.name} ({p.code})
                      </option>
                    ))}
                    <option value="custom">+ Entri Periode Kustom</option>
                  </select>
                  {formData.period_mode === 'custom' && (
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Contoh: 2026.1 atau 20261"
                      value={formData.custom_period}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, custom_period: e.target.value }))
                      }
                      required
                      style={{
                        flex: 1,
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color, #d1d5db)',
                      }}
                    />
                  )}
                </div>
              </div>

              {/* Total Amount */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: 'var(--text-main, #374151)',
                    marginBottom: '6px',
                  }}
                >
                  Total Nominal Tagihan (Rp) <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <span
                    style={{
                      position: 'absolute',
                      left: '12px',
                      top: '10px',
                      color: '#6b7280',
                      fontSize: '13px',
                      fontWeight: 600,
                    }}
                  >
                    Rp
                  </span>
                  <input
                    type="number"
                    className="form-control"
                    value={formData.amount}
                    onChange={handleAmountChange}
                    placeholder="Contoh: 1500000"
                    min="1"
                    required
                    style={{
                      width: '100%',
                      padding: '10px 12px 10px 38px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color, #d1d5db)',
                      fontWeight: 600,
                    }}
                  />
                </div>
              </div>

              {/* BRIVA Account Number */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: 'var(--text-main, #374151)',
                    marginBottom: '6px',
                  }}
                >
                  Nomor Rekening BRIVA <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.briva}
                    onChange={(e) => setFormData((prev) => ({ ...prev, briva: e.target.value }))}
                    placeholder="Contoh: 178100012345"
                    required
                    style={{
                      flex: 1,
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color, #d1d5db)',
                      fontFamily: 'monospace',
                      fontWeight: 600,
                    }}
                  />
                  {formData.briva && (
                    <button
                      type="button"
                      onClick={() => handleCopy(formData.briva, 'BRIVA')}
                      className="btn btn-secondary"
                      style={{ padding: '0 12px', borderRadius: '8px' }}
                      title="Salin BRIVA"
                    >
                      {copiedKey === 'BRIVA' ? (
                        <Check size={15} style={{ color: '#059669' }} />
                      ) : (
                        <Copy size={15} />
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* Due Date */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: 'var(--text-main, #374151)',
                    marginBottom: '6px',
                  }}
                >
                  Batas Pembayaran / Jatuh Tempo
                </label>
                <input
                  type="date"
                  className="form-control"
                  value={formData.due_date}
                  onChange={(e) => setFormData((prev) => ({ ...prev, due_date: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color, #d1d5db)',
                  }}
                />
              </div>

              {/* Status Pembayaran */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: 'var(--text-main, #374151)',
                    marginBottom: '6px',
                  }}
                >
                  Status Pembayaran <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select
                  className="form-control"
                  value={formData.status}
                  onChange={(e) => handleStatusChange(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color, #d1d5db)',
                    fontWeight: 600,
                  }}
                >
                  <option value="unpaid">Belum Lunas (Unpaid)</option>
                  <option value="partial">Bayar Sebagian (Partial)</option>
                  <option value="paid">Lunas (Paid)</option>
                </select>
              </div>

              {/* Nominal Terbayar (Conditional / Editable on Partial) */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: 'var(--text-main, #374151)',
                    marginBottom: '6px',
                  }}
                >
                  Nominal Sudah Terbayar (Rp)
                </label>
                <div style={{ position: 'relative' }}>
                  <span
                    style={{
                      position: 'absolute',
                      left: '12px',
                      top: '10px',
                      color: '#6b7280',
                      fontSize: '13px',
                      fontWeight: 600,
                    }}
                  >
                    Rp
                  </span>
                  <input
                    type="number"
                    className="form-control"
                    value={formData.paid_amount}
                    onChange={handlePaidAmountChange}
                    disabled={formData.status === 'unpaid' || formData.status === 'paid'}
                    placeholder="0"
                    min="0"
                    max={totalAmountNum}
                    style={{
                      width: '100%',
                      padding: '10px 12px 10px 38px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color, #d1d5db)',
                      background:
                        formData.status === 'unpaid' || formData.status === 'paid'
                          ? 'var(--bg-secondary, #f3f4f6)'
                          : '#ffffff',
                      fontWeight: 600,
                    }}
                  />
                </div>
                <div
                  style={{
                    fontSize: '11px',
                    color: 'var(--text-muted, #6b7280)',
                    marginTop: '4px',
                  }}
                >
                  {formData.status === 'partial'
                    ? 'Masukkan nominal cicilan yang sudah dibayarkan mahasiswa'
                    : formData.status === 'paid'
                      ? 'Otomatis bernilai penuh sesuai total tagihan'
                      : 'Bernilai 0 saat status Belum Lunas'}
                </div>
              </div>

              {/* Live Calculation Preview Box */}
              <div
                style={{
                  gridColumn: '1 / -1',
                  background:
                    formData.status === 'paid'
                      ? '#f0fdf4'
                      : formData.status === 'partial'
                        ? '#fffbeb'
                        : '#f8fafc',
                  border:
                    formData.status === 'paid'
                      ? '1px solid #bbf7d0'
                      : formData.status === 'partial'
                        ? '1px solid #fde68a'
                        : '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '14px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '12px',
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: 'var(--text-muted, #64748b)',
                    }}
                  >
                    Kalkulasi Sisa Tagihan Real-Time
                  </div>
                  <div
                    style={{
                      fontSize: '14px',
                      fontWeight: 700,
                      color: 'var(--text-main, #0f172a)',
                      marginTop: '2px',
                    }}
                  >
                    {formatRupiah(totalAmountNum)} - {formatRupiah(paidAmountNum)} ={' '}
                    <span style={{ color: remainingAmountNum > 0 ? '#b45309' : '#15803d' }}>
                      {formatRupiah(remainingAmountNum)}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted, #64748b)' }}>
                    Status Akhir:
                  </span>
                  <span
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 700,
                      background:
                        formData.status === 'paid'
                          ? '#dcfce7'
                          : formData.status === 'partial'
                            ? '#fef3c7'
                            : '#fee2e2',
                      color:
                        formData.status === 'paid'
                          ? '#15803d'
                          : formData.status === 'partial'
                            ? '#b45309'
                            : '#b91c1c',
                    }}
                  >
                    {formData.status === 'paid'
                      ? 'LUNAS'
                      : formData.status === 'partial'
                        ? 'BAYAR SEBAGIAN'
                        : 'BELUM LUNAS'}
                  </span>
                </div>
              </div>

              {/* Payment Instructions / Notes */}
              <div style={{ gridColumn: '1 / -1' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: 'var(--text-main, #374151)',
                    marginBottom: '6px',
                  }}
                >
                  Petunjuk Pembayaran / Catatan
                </label>
                <textarea
                  className="form-control"
                  rows={3}
                  value={formData.instructions}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, instructions: e.target.value }))
                  }
                  placeholder="Petunjuk cara pembayaran untuk mahasiswa..."
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color, #d1d5db)',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: '12px',
                marginTop: '28px',
                paddingTop: '20px',
                borderTop: '1px solid var(--border-color, #e5e7eb)',
              }}
            >
              <button
                type="button"
                onClick={() => navigateTo('bills')}
                className="btn btn-secondary"
                disabled={saving}
                style={{ padding: '10px 20px', borderRadius: '8px' }}
              >
                Batal
              </button>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={saving || !can('manage_billing')}
                style={{
                  padding: '10px 24px',
                  borderRadius: '8px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontWeight: 600,
                }}
              >
                {saving ? (
                  <>
                    <RefreshCw size={16} className="spin" />
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    <span>{isCreate ? 'Buat Tagihan Mahasiswa' : 'Simpan Perubahan Tagihan'}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
