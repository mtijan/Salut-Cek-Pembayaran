import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  User,
  RefreshCw,
  Check,
  Copy,
  Calendar,
  CreditCard,
  Phone,
  GraduationCap,
  Wifi,
  AlertTriangle,
  Edit3,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useBillPayment } from '../hooks/useBillPayment';
import { useBillEditor } from '../hooks/useBillEditor';
import PaymentForm from '../components/billing/PaymentForm';
import PaymentHistoryTable from '../components/billing/PaymentHistoryTable';
import BillSummaryCard from '../components/billing/BillSummaryCard';
import BillFormFields from '../components/billing/BillFormFields';
import { formatRupiah } from '../utils/currency';

export default function BillPaymentPage({ billId, initialTab = 'payment', mode, navigateTo }) {
  const { can } = useAuth();
  const canManageBilling = can('manage_billing');
  const isCreate = mode === 'create';

  const [activeTab, setActiveTab] = useState(
    initialTab === 'edit' && canManageBilling ? 'edit' : 'payment',
  );

  // Bill payment hook (cashier & transactions)
  const p = useBillPayment({
    billId: isCreate ? null : billId,
    onPaymentSuccess: async () => {
      await editor.fetchBillData();
    },
  });

  // Bill editor hook (core bill fields)
  const editor = useBillEditor({
    billId: isCreate ? null : billId,
    mode,
    navigateTo,
    enabled: canManageBilling,
    onSaved: async () => {
      if (isCreate) {
        navigateTo('bills');
        return;
      }
      await Promise.all([p.fetchBillDetail(), editor.fetchBillData()]);
      setActiveTab('payment');
    },
  });

  useEffect(() => {
    if (!canManageBilling && activeTab === 'edit') {
      setActiveTab('payment');
    }
  }, [activeTab, canManageBilling]);

  if (!isCreate && !billId) {
    return (
      <div className="table-empty-container" role="alert">
        <AlertTriangle size={42} className="empty-state-icon" />
        <p className="empty-state-title">Tagihan tidak dapat dibuka</p>
        <p className="empty-state-desc">ID tagihan tidak tersedia pada navigasi halaman ini.</p>
        <button type="button" className="btn btn-secondary" onClick={() => navigateTo('bills')}>
          Kembali ke Tagihan Mahasiswa
        </button>
      </div>
    );
  }

  // Create Mode Rendering
  if (isCreate) {
    if (!canManageBilling) {
      return (
        <div className="table-empty-container" role="alert">
          <AlertTriangle size={42} className="empty-state-icon" />
          <p className="empty-state-title">Akses pembuatan tagihan ditolak</p>
          <p className="empty-state-desc">
            Akun ini tidak memiliki izin untuk membuat atau mengubah tagihan.
          </p>
          <button type="button" className="btn btn-secondary" onClick={() => navigateTo('bills')}>
            Kembali ke Tagihan Mahasiswa
          </button>
        </div>
      );
    }
    if (editor.loading) {
      return (
        <div className="table-empty-container">
          <div className="loading-spinner-circle empty-state-icon" />
          <p className="loading-state-text">Memuat formulir data tagihan baru...</p>
        </div>
      );
    }

    return (
      <div className="payment-page-container">
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
              <span className="crumb-active">Buat Tagihan Baru</span>
            </div>
          </div>
        </div>

        <div className="payment-layout-grid">
          <div className="payment-left-col">
            <BillSummaryCard
              formData={editor.formData}
              loadedStudent={editor.loadedStudent}
              loadedBill={editor.loadedBill}
              isCreate={true}
              copiedKey={editor.copiedKey}
              onCopyNim={editor.handleCopy}
            />
          </div>
          <div className="payment-right-col">
            <BillFormFields
              isCreate={true}
              formData={editor.formData}
              setFormData={editor.setFormData}
              formError={editor.formError}
              periods={editor.periods}
              students={editor.students}
              loadedStudent={editor.loadedStudent}
              totalAmountNum={editor.totalAmountNum}
              paidAmountNum={editor.paidAmountNum}
              remainingAmountNum={editor.remainingAmountNum}
              copiedKey={editor.copiedKey}
              onCopyBriva={editor.handleCopy}
              saving={editor.saving}
              onSubmit={editor.handleSubmit}
              onCancel={() => navigateTo('bills')}
              handleStudentSelect={editor.handleStudentSelect}
              handleStatusChange={editor.handleStatusChange}
              handleAmountChange={editor.handleAmountChange}
              handlePaidAmountChange={editor.handlePaidAmountChange}
              canManage={canManageBilling}
            />
          </div>
        </div>
      </div>
    );
  }

  // Loading state for existing bill
  if (p.loading && !p.data) {
    return (
      <div className="table-empty-container">
        <div className="loading-spinner-circle empty-state-icon" />
        <p className="loading-state-text">Memuat detail dan kelola tagihan mahasiswa...</p>
      </div>
    );
  }

  if (p.loadError && !p.data) {
    return (
      <div className="table-empty-container" role="alert">
        <AlertTriangle size={42} className="empty-state-icon" />
        <p className="empty-state-title">Detail tagihan gagal dimuat</p>
        <p className="empty-state-desc">{p.loadError}</p>
        <div className="flex-row-gap-8">
          <button type="button" className="btn btn-secondary" onClick={() => navigateTo('bills')}>
            Kembali
          </button>
          <button type="button" className="btn btn-primary" onClick={() => p.fetchBillDetail()}>
            Coba Lagi
          </button>
        </div>
      </div>
    );
  }

  const percentPaid = p.totalAmount > 0 ? Math.round((p.currentPaid / p.totalAmount) * 100) : 0;
  const clampedPercent = Math.min(100, Math.max(0, percentPaid));

  const handleRefreshAll = async () => {
    const requests = [p.fetchBillDetail()];
    if (canManageBilling) requests.push(editor.fetchBillData());
    await Promise.all(requests);
  };

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
            <span className="crumb-active">Kelola Tagihan</span>
            <span className="crumb-sep">/</span>
            <span className="crumb-target">{p.bill.briva || p.student.full_name || 'Tagihan'}</span>
          </div>
        </div>

        <div className="profile-header-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleRefreshAll}
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
              title="Lihat Profil Mahasiswa"
            >
              <User size={15} />
              <span>Profil Mahasiswa</span>
            </button>
          )}
        </div>
      </div>

      {/* 2-Column Unified Layout */}
      <div className="payment-layout-grid">
        {/* Left Column: Student Identity & Live Balance Overview */}
        <div className="payment-left-col">
          {/* Student Identity Card */}
          <div className="panel-card payment-id-card">
            <div className="payment-id-header">
              <div className="profile-avatar-circle avatar-lg">
                {(p.student.full_name || p.bill.student_name || 'M').slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="payment-student-name text-truncate">
                  {p.student.full_name || p.bill.student_name || 'Mahasiswa'}
                </h2>
                <div className="student-meta-row">
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
                <span className="label">
                  <GraduationCap size={13} className="info-icon-inline" />
                  Program Studi
                </span>
                <span className="val">
                  {p.student.study_program_name || p.bill.study_program_name || '-'}
                </span>
              </div>
              {p.student.phone_number && (
                <div className="info-row">
                  <span className="label">
                    <Phone size={13} className="info-icon-inline" />
                    No. WhatsApp
                  </span>
                  <span className="val mono-font">{p.student.phone_number}</span>
                </div>
              )}
              {p.student.academic_status && (
                <div className="info-row">
                  <span className="label">Status Mahasiswa</span>
                  <span
                    className={`badge badge-sm ${p.student.academic_status === 'aktif' ? 'badge-success' : 'badge-warning'}`}
                  >
                    {p.student.academic_status.toUpperCase()}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Bill Summary & Outstanding Balance Card */}
          <div className="panel-card payment-balance-card">
            <div className="card-sub-title-row">
              <CreditCard size={15} className="text-brand" />
              <span className="card-sub-title">Detail Tagihan &amp; Sisa Tunggakan</span>
            </div>

            {/* Virtual BRIVA Banking Card */}
            <div className="briva-spotlight-box">
              <div className="briva-card-top-row">
                <div className="briva-card-brand">
                  <span className="briva-bank-title">BANK BRI</span>
                  <span className="briva-badge-type">{p.bill.bill_type || 'BRIVA'}</span>
                </div>
                <div className="briva-card-signals">
                  <Wifi size={18} className="briva-signal-icon" />
                </div>
              </div>

              <div className="briva-chip-sim-icon" />

              <div className="briva-spotlight-label">Nomor Rekening BRIVA</div>
              <div className="briva-spotlight-val-row">
                <span className="briva-spotlight-val">{p.bill.briva || '-'}</span>
                {p.bill.briva && (
                  <button
                    type="button"
                    className="copy-btn-inline copy-btn-white"
                    onClick={() => p.handleCopy(p.bill.briva, 'BRIVA')}
                    title="Salin BRIVA"
                  >
                    {p.copiedKey === 'BRIVA' ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                )}
              </div>

              <div className="briva-spotlight-meta">
                <div className="briva-meta-item">
                  <span className="briva-meta-label">Periode</span>
                  <span className="briva-meta-val">{p.bill.period || '-'}</span>
                </div>
                <div className="briva-meta-item text-right">
                  <span className="briva-meta-label">Nama Akun</span>
                  <span className="briva-meta-val text-truncate max-w-120">
                    {p.student.full_name || p.bill.student_name || 'Mahasiswa'}
                  </span>
                </div>
              </div>
            </div>

            {/* Balance Metrics */}
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

            {/* Progress Repayment Bar */}
            <div className="payment-progress-wrap">
              <div className="payment-progress-labels">
                <span>Progres Pelunasan</span>
                <span className="font-bold">{percentPaid}%</span>
              </div>
              <div className="payment-progress-track">
                <progress
                  className={`bill-progress-semantic ${p.bill.status === 'paid' ? '' : 'partial'}`}
                  value={clampedPercent}
                  max={100}
                  aria-label={`Progres pelunasan ${percentPaid}%`}
                />
              </div>
            </div>

            {/* Outstanding Balance Hero Display */}
            <div className="outstanding-hero-box">
              <span className="out-label">SISA TAGIHAN (OUTSTANDING)</span>
              <span className="out-val">{formatRupiah(p.remainingAmount)}</span>
              <div className="mt-2">
                <span
                  className={`badge badge-status-lg ${p.bill.status === 'paid' ? 'badge-success' : p.bill.status === 'partial' ? 'badge-warning' : 'badge-danger'}`}
                >
                  {p.bill.status === 'paid'
                    ? 'LUNAS (PAID)'
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

        {/* Right Column: Integrated Tabs (Catat Pembayaran & Edit Data Tagihan) */}
        <div className="payment-right-col">
          <div className="payment-tabs-nav" role="tablist" aria-label="Kelola tagihan">
            <button
              id="bill-payment-tab"
              type="button"
              role="tab"
              aria-selected={activeTab === 'payment'}
              aria-controls="bill-payment-panel"
              className={`payment-tab-btn ${activeTab === 'payment' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('payment')}
            >
              <CreditCard size={15} />
              <span>Catat Pembayaran</span>
            </button>
            {canManageBilling && (
              <button
                id="bill-edit-tab"
                type="button"
                role="tab"
                aria-selected={activeTab === 'edit'}
                aria-controls="bill-edit-panel"
                className={`payment-tab-btn ${activeTab === 'edit' ? 'is-active' : ''}`}
                onClick={() => setActiveTab('edit')}
              >
                <Edit3 size={15} />
                <span>Edit Data Tagihan</span>
              </button>
            )}
          </div>

          {activeTab === 'payment' && (
            <div id="bill-payment-panel" role="tabpanel" aria-labelledby="bill-payment-tab">
              {p.bill.is_active === false ? (
                <div className="panel-card modal-alert-warning">
                  <AlertTriangle size={20} />
                  <div>
                    <strong>Tagihan ini sedang nonaktif.</strong>
                    <p>
                      Aktifkan kembali tagihan dari Bills Page atau Profil Mahasiswa sebelum
                      mencatat pembayaran.
                    </p>
                  </div>
                </div>
              ) : (
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
                  formError={p.formError}
                  submitting={p.submitting}
                  numericPayment={p.numericPayment}
                  newRemaining={p.newRemaining}
                  willBePaid={p.willBePaid}
                  handleModeChange={p.handleModeChange}
                  handleQuickAmount={p.handleQuickAmount}
                  handleSubmitPayment={p.handleSubmitPayment}
                />
              )}

              <PaymentHistoryTable transactions={p.transactions} />
            </div>
          )}

          {activeTab === 'edit' && canManageBilling && (
            <div id="bill-edit-panel" role="tabpanel" aria-labelledby="bill-edit-tab">
              {editor.loading ? (
                <div className="table-loading-container">
                  <div className="loading-spinner-circle" />
                  <p className="loading-state-text">Memuat formulir edit tagihan...</p>
                </div>
              ) : editor.loadError ? (
                <div className="panel-card modal-alert-warning" role="alert">
                  <AlertTriangle size={20} />
                  <div>
                    <strong>Formulir edit tidak dapat dimuat.</strong>
                    <p>{editor.loadError}</p>
                  </div>
                </div>
              ) : (
                <BillFormFields
                  isCreate={false}
                  formData={editor.formData}
                  setFormData={editor.setFormData}
                  formError={editor.formError}
                  periods={editor.periods}
                  students={editor.students}
                  loadedStudent={editor.loadedStudent}
                  totalAmountNum={editor.totalAmountNum}
                  paidAmountNum={editor.paidAmountNum}
                  remainingAmountNum={editor.remainingAmountNum}
                  copiedKey={editor.copiedKey}
                  onCopyBriva={editor.handleCopy}
                  saving={editor.saving}
                  onSubmit={editor.handleSubmit}
                  onCancel={() => setActiveTab('payment')}
                  handleStudentSelect={editor.handleStudentSelect}
                  handleStatusChange={editor.handleStatusChange}
                  handleAmountChange={editor.handleAmountChange}
                  handlePaidAmountChange={editor.handlePaidAmountChange}
                  canManage={canManageBilling}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

BillPaymentPage.displayName = 'BillPaymentPage';
