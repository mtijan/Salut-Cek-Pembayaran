import React from 'react';
import { ArrowLeft, User, RefreshCw, Check, Copy, Calendar } from 'lucide-react';
import { useBillPayment } from '../hooks/useBillPayment';
import PaymentForm from '../components/billing/PaymentForm';
import PaymentHistoryTable from '../components/billing/PaymentHistoryTable';

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
  const p = useBillPayment({ billId });

  if (p.loading && !p.data) {
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
      {/* Header & Breadcrumb */}
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
            <span className="crumb-target">
              {p.bill.briva || p.student.full_name || 'Tagihan'}
            </span>
          </div>
        </div>

        <div className="profile-header-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => p.fetchBillDetail()}
            title="Segarkan Data"
          >
            <RefreshCw size={15} />
            <span>Segarkan</span>
          </button>
          {p.student.id && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() =>
                navigateTo('student-profile', { studentId: p.student.id, initialTab: 'profile' })
              }
            >
              <User size={15} />
              <span>Profil Mahasiswa</span>
            </button>
          )}
        </div>
      </div>

      {/* 2-Column Layout */}
      <div className="payment-layout-grid">
        {/* Left Column: Student & Bill Summary */}
        <div className="payment-left-col">
          {/* Student Identity Card */}
          <div className="panel-card payment-id-card">
            <div className="payment-id-header">
              <div className="profile-avatar-circle" style={{ width: 48, height: 48, fontSize: 16 }}>
                {(p.student.full_name || p.bill.student_name || 'M').slice(0, 2).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h2 className="payment-student-name text-truncate">
                  {p.student.full_name || p.bill.student_name || 'Mahasiswa'}
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
                    <strong className="mono-font">
                      {p.student.nim || p.bill.student_nim || '-'}
                    </strong>
                  </span>
                  {(p.student.nim || p.bill.student_nim) && (
                    <button
                      type="button"
                      className="copy-btn-inline"
                      onClick={() => p.handleCopy(p.student.nim || p.bill.student_nim, 'NIM')}
                      title="Salin NIM"
                    >
                      {p.copiedKey === 'NIM' ? (
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
                  {p.student.study_program_name || p.bill.study_program_name || '-'}
                </span>
              </div>
              {p.student.phone_number && (
                <div className="info-row">
                  <span className="label">No. WhatsApp</span>
                  <span className="val">{p.student.phone_number}</span>
                </div>
              )}
              {p.student.academic_status && (
                <div className="info-row">
                  <span className="label">Status Mahasiswa</span>
                  <span
                    className={`badge ${p.student.academic_status === 'aktif' ? 'badge-success' : 'badge-warning'}`}
                    style={{ fontSize: 11 }}
                  >
                    {p.student.academic_status.toUpperCase()}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Bill Summary & Outstanding Balance Card */}
          <div className="panel-card payment-balance-card">
            <div className="card-sub-title">Detail Tagihan &amp; Sisa Tunggakan</div>

            <div className="briva-spotlight-box">
              <div className="briva-spotlight-label">Nomor BRIVA Pembayaran</div>
              <div className="briva-spotlight-val-row">
                <span className="briva-spotlight-val">{p.bill.briva || '-'}</span>
                {p.bill.briva && (
                  <button
                    type="button"
                    className="copy-btn-inline"
                    onClick={() => p.handleCopy(p.bill.briva, 'BRIVA')}
                    title="Salin BRIVA"
                    style={{ background: 'rgba(255,255,255,0.2)', color: '#ffffff' }}
                  >
                    {p.copiedKey === 'BRIVA' ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                )}
              </div>
              <div className="briva-spotlight-meta">
                <span>
                  Periode: <strong>{p.bill.period || '-'}</strong>
                </span>
                <span>•</span>
                <span>
                  Jenis: <strong>{p.bill.bill_type || '-'}</strong>
                </span>
              </div>
            </div>

            <div className="balance-metrics-grid">
              <div className="balance-item">
                <span className="label">Total Tagihan</span>
                <span className="val">{formatRupiah(p.totalAmount)}</span>
              </div>
              <div className="balance-item">
                <span className="label">Sudah Dibayar</span>
                <span className="val-paid">{formatRupiah(p.currentPaid)}</span>
              </div>
            </div>

            <div className="outstanding-hero-box">
              <span className="out-label">SISA TAGIHAN (OUTSTANDING)</span>
              <span className="out-val">{formatRupiah(p.remainingAmount)}</span>
              <div style={{ marginTop: 8 }}>
                <span
                  className={`badge ${p.bill.status === 'paid' ? 'badge-success' : p.bill.status === 'partial' ? 'badge-warning' : 'badge-danger'}`}
                  style={{ fontSize: 12, padding: '4px 12px' }}
                >
                  Status Tagihan:{' '}
                  {p.bill.status === 'paid'
                    ? 'LUNAS'
                    : p.bill.status === 'partial'
                      ? 'BAYAR SEBAGIAN (CICILAN)'
                      : 'BELUM DIBAYAR'}
                </span>
              </div>
            </div>

            {p.bill.due_date_formatted && (
              <div className="due-date-note">
                <Calendar size={14} />
                <span>
                  Jatuh Tempo: <strong>{p.bill.due_date_formatted}</strong>
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Payment Form & Ledger */}
        <div className="payment-right-col">
          <PaymentForm
            bill={p.bill}
            remainingAmount={p.remainingAmount}
            totalAmount={p.totalAmount}
            paymentMode={p.paymentMode}
            paymentAmount={p.paymentAmount}
            setPaymentAmount={p.setPaymentAmount}
            paymentDate={p.paymentDate}
            setPaymentDate={p.setPaymentDate}
            paymentMethod={p.paymentMethod}
            setPaymentMethod={p.setPaymentMethod}
            referenceNumber={p.referenceNumber}
            setReferenceNumber={p.setReferenceNumber}
            notes={p.notes}
            setNotes={p.setNotes}
            submitting={p.submitting}
            formError={p.formError}
            numericPayment={p.numericPayment}
            newRemaining={p.newRemaining}
            willBePaid={p.willBePaid}
            handleModeChange={p.handleModeChange}
            handleQuickAmount={p.handleQuickAmount}
            handleSubmitPayment={p.handleSubmitPayment}
          />
          <PaymentHistoryTable transactions={p.transactions} />
        </div>
      </div>
    </div>
  );
}
