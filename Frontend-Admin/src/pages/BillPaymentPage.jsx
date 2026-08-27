import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  CreditCard,
  User,
  Clock,
  Check,
  Copy,
  AlertCircle,
  CheckCircle2,
  Calendar,
  RefreshCw,
  Layers,
  Save,
} from 'lucide-react';
import { billsApi } from '../services/api';
import { useToast } from '../components/common/Toast';
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

export default function BillPaymentPage({ billId, navigateTo }) {
  const { showToast } = useToast();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const { copiedKey, copyToClipboard } = useCopyFeedback();

  // Form payment state
  const [paymentMode, setPaymentMode] = useState('full'); // 'full' | 'partial'
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState('BRIVA');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const fetchBillDetail = useCallback(async () => {
    if (!billId) return;
    setLoading(true);
    try {
      const res = await billsApi.getDetail(billId);
      setData(res);

      const bill = res?.bill || {};
      const rem = Number(bill.remaining_amount || 0);
      if (rem > 0) {
        setPaymentAmount(String(rem));
        setPaymentMode('full');
      } else {
        setPaymentAmount('');
      }
    } catch (err) {
      showToast(err.message || 'Gagal memuat data tagihan.', 'error');
    } finally {
      setLoading(false);
    }
  }, [billId, showToast]);

  useEffect(() => {
    fetchBillDetail();
  }, [fetchBillDetail]);

  const bill = data?.bill || {};
  const student = data?.student || {};
  const transactions = data?.transactions || [];

  const totalAmount = Number(bill.amount || 0);
  const currentPaid = Number(bill.paid_amount || 0);
  const remainingAmount = Number(bill.remaining_amount || 0);

  const handleCopy = (text, label) => {
    copyToClipboard(text, label, () => showToast(`${label} disalin ke clipboard!`, 'success'));
  };

  const handleModeChange = (mode) => {
    setPaymentMode(mode);
    setFormError('');
    if (mode === 'full') {
      setPaymentAmount(String(remainingAmount));
    } else {
      // Set to half or 500k default if remaining allows
      const suggest = remainingAmount > 500000 ? 500000 : Math.round(remainingAmount / 2);
      setPaymentAmount(String(suggest));
    }
  };

  const handleQuickAmount = (val) => {
    setPaymentMode('partial');
    setPaymentAmount(String(val));
    setFormError('');
  };

  // Real-time calculation
  const numericPayment = Number(paymentAmount) || 0;
  const newRemaining = Math.max(0, remainingAmount - numericPayment);
  const willBePaid = numericPayment >= remainingAmount && remainingAmount > 0;

  const handleSubmitPayment = async (e) => {
    e.preventDefault();
    if (remainingAmount <= 0 || bill.status === 'paid') {
      setFormError('Tagihan ini sudah lunas.');
      return;
    }
    if (!paymentAmount || numericPayment <= 0) {
      setFormError('Nominal pembayaran transaksi wajib diisi dan lebih dari 0.');
      return;
    }
    if (numericPayment > remainingAmount) {
      setFormError(
        `Nominal pembayaran (${formatRupiah(numericPayment)}) melebihi sisa tagihan (${formatRupiah(remainingAmount)}).`,
      );
      return;
    }

    setSubmitting(true);
    setFormError('');

    try {
      await billsApi.recordPayment(billId, {
        payment_amount: numericPayment,
        payment_date: paymentDate || null,
        payment_method: paymentMethod || 'BRIVA',
        reference_number: referenceNumber.trim() || null,
        notes: notes.trim() || null,
      });

      showToast(
        `Transaksi pembayaran sebesar ${formatRupiah(numericPayment)} berhasil dicatat!`,
        'success',
      );
      setReferenceNumber('');
      setNotes('');
      await fetchBillDetail();
    } catch (err) {
      setFormError(err.message || 'Gagal menyimpan transaksi pembayaran.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && !data) {
    return (
      <div style={{ padding: '60px 20px', textAlign: 'center' }}>
        <div
          style={{
            width: 40,
            height: 40,
            border: '3px solid var(--line)',
            borderTopColor: 'var(--brand)',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
            margin: '0 auto 16px',
          }}
        />
        <p style={{ color: 'var(--muted)', fontSize: 14, fontWeight: 600 }}>
          Memuat halaman pembayaran tagihan...
        </p>
      </div>
    );
  }

  return (
    <div className="payment-page-container">
      {/* Top Header & Breadcrumbs */}
      <div className="profile-header-bar">
        <div className="profile-breadcrumb-wrap">
          <button
            type="button"
            className="btn btn-secondary back-btn-compact"
            onClick={() => navigateTo('bills')}
            title="Kembali ke Daftar Tagihan"
          >
            <ArrowLeft size={16} />
            <span>Kembali</span>
          </button>
          <div className="profile-breadcrumb">
            <span className="crumb-link" onClick={() => navigateTo('bills')}>
              Tagihan Mahasiswa
            </span>
            <span className="crumb-sep">/</span>
            <span className="crumb-active">Catat Pembayaran</span>
            <span className="crumb-sep">/</span>
            <span className="crumb-target">{bill.briva || student.full_name || 'Tagihan'}</span>
          </div>
        </div>

        <div className="profile-header-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => fetchBillDetail()}
            title="Segarkan Data"
          >
            <RefreshCw size={15} />
            <span>Segarkan</span>
          </button>
          {student.id && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() =>
                navigateTo('student-profile', { studentId: student.id, initialTab: 'profile' })
              }
            >
              <User size={15} />
              <span>Profil Mahasiswa</span>
            </button>
          )}
        </div>
      </div>

      {/* Main 2-Column Grid Layout */}
      <div className="payment-layout-grid">
        {/* Left Column: Mahasiswa & Bill Summary Card */}
        <div className="payment-left-col">
          {/* Card 1: Student Identity Card */}
          <div className="panel-card payment-id-card">
            <div className="payment-id-header">
              <div
                className="profile-avatar-circle"
                style={{ width: 48, height: 48, fontSize: 16 }}
              >
                {(student.full_name || bill.student_name || 'M').slice(0, 2).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h2 className="payment-student-name text-truncate">
                  {student.full_name || bill.student_name || 'Mahasiswa'}
                </h2>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 13,
                    color: 'var(--muted)',
                  }}
                >
                  <span>
                    NIM:{' '}
                    <strong className="mono-font">{student.nim || bill.student_nim || '-'}</strong>
                  </span>
                  {(student.nim || bill.student_nim) && (
                    <button
                      type="button"
                      className="copy-btn-inline"
                      onClick={() => handleCopy(student.nim || bill.student_nim, 'NIM')}
                      title="Salin NIM"
                    >
                      {copiedKey === 'NIM' ? (
                        <Check size={12} color="var(--success)" />
                      ) : (
                        <Copy size={12} />
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="payment-quick-info">
              <div className="info-row">
                <span className="label">Program Studi</span>
                <span className="val">
                  {student.study_program_name || bill.study_program_name || '-'}
                </span>
              </div>
              {student.phone_number && (
                <div className="info-row">
                  <span className="label">No. WhatsApp</span>
                  <span className="val">{student.phone_number}</span>
                </div>
              )}
              {student.academic_status && (
                <div className="info-row">
                  <span className="label">Status Mahasiswa</span>
                  <span
                    className={`badge ${student.academic_status === 'aktif' ? 'badge-success' : 'badge-warning'}`}
                    style={{ fontSize: 11 }}
                  >
                    {student.academic_status.toUpperCase()}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Card 2: Bill Summary & Outstanding Balance Card */}
          <div className="panel-card payment-balance-card">
            <div className="card-sub-title">Detail Tagihan & Sisa Tunggakan</div>

            <div className="briva-spotlight-box">
              <div className="briva-spotlight-label">Nomor BRIVA Pembayaran</div>
              <div className="briva-spotlight-val-row">
                <span className="briva-spotlight-val">{bill.briva || '-'}</span>
                {bill.briva && (
                  <button
                    type="button"
                    className="copy-btn-inline"
                    onClick={() => handleCopy(bill.briva, 'BRIVA')}
                    title="Salin BRIVA"
                    style={{ background: 'rgba(255,255,255,0.2)', color: '#ffffff' }}
                  >
                    {copiedKey === 'BRIVA' ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                )}
              </div>
              <div className="briva-spotlight-meta">
                <span>
                  Periode: <strong>{bill.period || '-'}</strong>
                </span>
                <span>•</span>
                <span>
                  Jenis: <strong>{bill.bill_type || '-'}</strong>
                </span>
              </div>
            </div>

            <div className="balance-metrics-grid">
              <div className="balance-item">
                <span className="label">Total Tagihan</span>
                <span className="val">{formatRupiah(totalAmount)}</span>
              </div>
              <div className="balance-item">
                <span className="label">Sudah Dibayar</span>
                <span className="val-paid">{formatRupiah(currentPaid)}</span>
              </div>
            </div>

            <div className="outstanding-hero-box">
              <span className="out-label">SISA TAGIHAN (OUTSTANDING)</span>
              <span className="out-val">{formatRupiah(remainingAmount)}</span>
              <div style={{ marginTop: 8 }}>
                <span
                  className={`badge ${bill.status === 'paid' ? 'badge-success' : bill.status === 'partial' ? 'badge-warning' : 'badge-danger'}`}
                  style={{ fontSize: 12, padding: '4px 12px' }}
                >
                  Status Tagihan:{' '}
                  {bill.status === 'paid'
                    ? 'LUNAS'
                    : bill.status === 'partial'
                      ? 'BAYAR SEBAGIAN (CICILAN)'
                      : 'BELUM DIBAYAR'}
                </span>
              </div>
            </div>

            {bill.due_date_formatted && (
              <div className="due-date-note">
                <Calendar size={14} />
                <span>
                  Jatuh Tempo: <strong>{bill.due_date_formatted}</strong>
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Payment Form & Ledger */}
        <div className="payment-right-col">
          {/* Card 1: Payment Form */}
          <div className="panel-card payment-form-card">
            <div className="payment-form-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div className="icon-badge-brand">
                  <CreditCard size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--ink)' }}>
                    Formulir Pembayaran Tagihan
                  </h3>
                  <p style={{ fontSize: 12.5, color: 'var(--muted)' }}>
                    Catat transaksi pembayaran baru secara bertahap (cicilan) atau pelunasan penuh
                  </p>
                </div>
              </div>
            </div>

            {remainingAmount <= 0 || bill.status === 'paid' ? (
              <div className="paid-celebration-box">
                <CheckCircle2 size={42} color="var(--success)" style={{ margin: '0 auto 12px' }} />
                <h4 style={{ fontSize: 17, fontWeight: 800, color: 'var(--success)' }}>
                  Tagihan Ini Sudah Lunas Sepenuhnya
                </h4>
                <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
                  Total tagihan sebesar {formatRupiah(totalAmount)} telah terbayar lunas. Tidak ada
                  sisa tunggakan yang perlu dibayarkan.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmitPayment} className="payment-form-body">
                {formError && (
                  <div className="alert-box alert-danger" style={{ marginBottom: 16 }}>
                    <AlertCircle size={17} />
                    <span>{formError}</span>
                  </div>
                )}

                {/* Mode Selector */}
                <div className="payment-mode-switcher">
                  <button
                    type="button"
                    className={`mode-btn ${paymentMode === 'full' ? 'is-active' : ''}`}
                    onClick={() => handleModeChange('full')}
                  >
                    <CheckCircle2 size={16} />
                    <div>
                      <div className="mode-title">Pelunasan Penuh (Lunas)</div>
                      <div className="mode-sub">
                        Bayar seluruh sisa {formatRupiah(remainingAmount)}
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    className={`mode-btn ${paymentMode === 'partial' ? 'is-active' : ''}`}
                    onClick={() => handleModeChange('partial')}
                  >
                    <Layers size={16} />
                    <div>
                      <div className="mode-title">Bayar Sebagian (Cicilan)</div>
                      <div className="mode-sub">Masukkan nominal pembayaran bertahap</div>
                    </div>
                  </button>
                </div>

                {/* Nominal Input & Quick Chips */}
                <div className="form-group" style={{ marginTop: 18 }}>
                  <label
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      display: 'flex',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span>
                      Nominal Pembayaran Transaksi Ini (Rp){' '}
                      <span style={{ color: 'var(--danger)' }}>*</span>
                    </span>
                    <span style={{ color: 'var(--brand)', fontWeight: 600 }}>
                      Sisa Saat Ini: {formatRupiah(remainingAmount)}
                    </span>
                  </label>
                  <div className="currency-input-wrap">
                    <span className="currency-prefix">Rp</span>
                    <input
                      type="number"
                      value={paymentAmount}
                      onChange={(e) => {
                        setPaymentAmount(e.target.value);
                        if (Number(e.target.value) === remainingAmount) {
                          setPaymentMode('full');
                        } else {
                          setPaymentMode('partial');
                        }
                      }}
                      className="currency-input"
                      placeholder="0"
                      min={1}
                      max={remainingAmount}
                      required
                    />
                  </div>

                  {/* Quick Chips */}
                  <div className="quick-chips-row">
                    <span className="chips-label">Pilihan Cepat:</span>
                    <button
                      type="button"
                      className="chip-btn"
                      onClick={() => handleModeChange('full')}
                    >
                      Sisa Penuh ({formatRupiah(remainingAmount)})
                    </button>
                    {remainingAmount > 1000000 && (
                      <button
                        type="button"
                        className="chip-btn"
                        onClick={() => handleQuickAmount(1000000)}
                      >
                        Rp 1.000.000
                      </button>
                    )}
                    {remainingAmount > 500000 && (
                      <button
                        type="button"
                        className="chip-btn"
                        onClick={() => handleQuickAmount(500000)}
                      >
                        Rp 500.000
                      </button>
                    )}
                    {remainingAmount > 250000 && (
                      <button
                        type="button"
                        className="chip-btn"
                        onClick={() => handleQuickAmount(250000)}
                      >
                        Rp 250.000
                      </button>
                    )}
                  </div>
                </div>

                {/* Live Calculation Preview Box */}
                <div className="live-calc-box">
                  <div className="calc-item">
                    <span className="calc-label">Sisa Sebelumnya:</span>
                    <span className="calc-val">{formatRupiah(remainingAmount)}</span>
                  </div>
                  <div className="calc-sep">-</div>
                  <div className="calc-item">
                    <span className="calc-label">Bayar Sekarang:</span>
                    <span className="calc-val" style={{ color: 'var(--brand)', fontWeight: 800 }}>
                      {formatRupiah(numericPayment)}
                    </span>
                  </div>
                  <div className="calc-sep">=</div>
                  <div className="calc-item">
                    <span className="calc-label">Sisa Tagihan Baru:</span>
                    <span
                      className="calc-val"
                      style={{
                        color: newRemaining > 0 ? 'var(--danger)' : 'var(--success)',
                        fontWeight: 800,
                      }}
                    >
                      {formatRupiah(newRemaining)}
                    </span>
                  </div>
                  <div className="calc-status-badge">
                    <span className={`badge ${willBePaid ? 'badge-success' : 'badge-warning'}`}>
                      {willBePaid ? 'AKAN LUNAS (PAID)' : 'SEBAGIAN (PARTIAL)'}
                    </span>
                  </div>
                </div>

                {/* Transaction Metadata Grid */}
                <div className="form-grid-2" style={{ marginTop: 16 }}>
                  <div className="form-group">
                    <label>
                      Tanggal Transaksi Pembayaran <span style={{ color: 'var(--danger)' }}>*</span>
                    </label>
                    <input
                      type="date"
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      className="form-input"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Metode Pembayaran</label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="form-input"
                    >
                      <option value="BRIVA">BRIVA Bank BRI</option>
                      <option value="Transfer Bank BCA">Transfer Bank BCA</option>
                      <option value="Transfer Bank Mandiri">Transfer Bank Mandiri</option>
                      <option value="Transfer Bank BNI">Transfer Bank BNI</option>
                      <option value="Kasir / Tunai">Kasir / Tunai Langsung</option>
                      <option value="QRIS">QRIS SALUT</option>
                      <option value="Lainnya">Metode Lainnya</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Nomor Referensi Transaksi Bank (Opsional)</label>
                    <input
                      type="text"
                      value={referenceNumber}
                      onChange={(e) => setReferenceNumber(e.target.value)}
                      className="form-input"
                      placeholder="Contoh: REF-20260825-9988"
                    />
                  </div>

                  <div className="form-group">
                    <label>Catatan / Keterangan Pembayaran (Opsional)</label>
                    <input
                      type="text"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="form-input"
                      placeholder="Contoh: Cicilan ke-1 biaya UKT semester genap"
                    />
                  </div>
                </div>

                <div className="form-actions-bar" style={{ marginTop: 24 }}>
                  <button
                    type="submit"
                    className="btn btn-primary btn-large"
                    disabled={submitting || numericPayment <= 0 || numericPayment > remainingAmount}
                    style={{
                      width: '100%',
                      justifyContent: 'center',
                      fontSize: 14.5,
                      padding: '12px 20px',
                    }}
                  >
                    {submitting ? (
                      <>
                        <div className="spinner-sm" />
                        <span>Memproses Transaksi Pembayaran...</span>
                      </>
                    ) : (
                      <>
                        <Save size={18} />
                        <span>
                          Simpan & Catat Transaksi Pembayaran ({formatRupiah(numericPayment)})
                        </span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Card 2: Payment Transaction Ledger */}
          <div className="panel-card payment-history-card">
            <div className="payment-history-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Clock size={17} color="var(--brand)" />
                <h3 style={{ fontSize: 15, fontWeight: 700 }}>
                  Riwayat Pembayaran Tagihan Ini ({transactions.length})
                </h3>
              </div>
            </div>

            {transactions.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--muted)' }}>
                <Clock size={32} style={{ margin: '0 auto 8px', opacity: 0.3 }} />
                <p style={{ fontSize: 13, fontWeight: 600 }}>
                  Belum ada mutasi transaksi pembayaran untuk tagihan ini.
                </p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Tanggal</th>
                      <th>Tipe Mutasi</th>
                      <th style={{ textAlign: 'right' }}>Nominal Transaksi</th>
                      <th style={{ textAlign: 'right' }}>Akumulasi Terbayar</th>
                      <th>Status Tagihan</th>
                      <th>Metode & Referensi</th>
                      <th>Catatan</th>
                      <th>Dicatat Oleh</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((tx) => (
                      <tr key={tx.id}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{tx.payment_date || '-'}</div>
                          <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                            {tx.created_at || ''}
                          </div>
                        </td>
                        <td>
                          <span
                            className={`badge ${tx.transaction_type === 'payment' ? 'badge-success' : tx.transaction_type === 'reversal' ? 'badge-danger' : 'badge-neutral'}`}
                          >
                            {tx.transaction_type === 'payment'
                              ? 'PEMBAYARAN'
                              : tx.transaction_type === 'reversal'
                                ? 'PEMBATALAN'
                                : 'KOREKSI'}
                          </span>
                        </td>
                        <td
                          style={{
                            textAlign: 'right',
                            fontWeight: 700,
                            color: tx.amount >= 0 ? 'var(--success)' : 'var(--danger)',
                          }}
                        >
                          {tx.amount >= 0 ? `+ ${tx.amount_formatted}` : `- ${tx.amount_formatted}`}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>
                          {tx.running_paid_total_formatted}
                        </td>
                        <td>
                          <div style={{ fontSize: 12 }}>
                            <span>{tx.previous_status || 'unpaid'}</span>
                            <span style={{ margin: '0 4px' }}>→</span>
                            <strong>{tx.new_status}</strong>
                          </div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{tx.payment_method || 'BRIVA'}</div>
                          {tx.reference_number && (
                            <div
                              className="mono-font"
                              style={{ fontSize: 11, color: 'var(--muted)' }}
                            >
                              Ref: {tx.reference_number}
                            </div>
                          )}
                        </td>
                        <td style={{ fontSize: 12.5, maxWidth: 200 }}>{tx.notes || '-'}</td>
                        <td style={{ fontSize: 12 }}>{tx.recorded_by_name || 'Admin SALUT'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
