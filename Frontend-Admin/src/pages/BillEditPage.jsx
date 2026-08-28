import React from 'react';
import { ArrowLeft, CreditCard, User, ChevronRight, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useBillEditor } from '../hooks/useBillEditor';
import BillSummaryCard from '../components/billing/BillSummaryCard';
import BillFormFields from '../components/billing/BillFormFields';

export default function BillEditPage({ billId, mode, navigateTo }) {
  const { can } = useAuth();
  const editor = useBillEditor({ billId, mode, navigateTo });

  const {
    isCreate,
    loading,
    saving,
    formData,
    setFormData,
    formError,
    periods,
    students,
    loadedBill,
    loadedStudent,
    copiedKey,
    totalAmountNum,
    paidAmountNum,
    remainingAmountNum,
    handleCopy,
    handleStatusChange,
    handleAmountChange,
    handlePaidAmountChange,
    handleStudentSelect,
    handleSubmit,
  } = editor;

  const studentData = loadedStudent || {};
  const billData = loadedBill || {};

  if (loading) {
    return (
      <div className="content-container">
        <div className="page-loading-center">
          <RefreshCw size={36} className="spin loading-spinner-lg" />
          <p className="page-loading-text">Memuat formulir data tagihan...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="content-container">
      {/* Header & Breadcrumb */}
      <div className="crumb-header-wrap">
        <div className="crumb-nav-row">
          <button type="button" onClick={() => navigateTo('bills')} className="crumb-nav-btn">
            Tagihan Mahasiswa
          </button>
          <ChevronRight size={14} />
          <span className="crumb-active-title">
            {isCreate ? 'Buat Tagihan Baru' : `Edit Tagihan: ${formData.briva || billData.briva}`}
          </span>
        </div>

        <div className="page-title-row">
          <div className="page-title-left">
            <button
              type="button"
              onClick={() => navigateTo('bills')}
              className="btn btn-secondary back-btn-compact"
            >
              <ArrowLeft size={16} />
              <span>Kembali</span>
            </button>
            <div>
              <h1 className="page-title-h1">
                {isCreate ? 'Buat Tagihan Mahasiswa Baru' : 'Edit Tagihan & Data Finansial'}
              </h1>
              <p className="page-subtitle-p">
                {isCreate
                  ? 'Entri tagihan baru dengan nomor BRIVA dan kalkulasi pembayaran terstruktur'
                  : `Kelola parameter pokok tagihan, periode, jatuh tempo, dan status pembayaran untuk ${studentData.full_name || formData.full_name}`}
              </p>
            </div>
          </div>

          {!isCreate && billId && (
            <div className="page-header-btn-group">
              {studentData.id && (
                <button
                  type="button"
                  onClick={() => navigateTo('student-profile', { studentId: studentData.id })}
                  className="btn btn-secondary btn-flex-gap"
                >
                  <User size={15} />
                  <span>Lihat Profil 360</span>
                </button>
              )}
              {can('manage_billing') && (
                <button
                  type="button"
                  onClick={() => navigateTo('bill-payment', { billId })}
                  className="btn btn-primary btn-flex-gap"
                >
                  <CreditCard size={15} />
                  <span>Buka Halaman Kasir / Bayar</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 2-Column Layout */}
      <div className="profile-layout-grid">
        <BillSummaryCard
          formData={formData}
          loadedStudent={loadedStudent}
          loadedBill={loadedBill}
          isCreate={isCreate}
          copiedKey={copiedKey}
          onCopyNim={handleCopy}
        />
        <BillFormFields
          isCreate={isCreate}
          formData={formData}
          setFormData={setFormData}
          formError={formError}
          periods={periods}
          students={students}
          loadedStudent={loadedStudent}
          totalAmountNum={totalAmountNum}
          paidAmountNum={paidAmountNum}
          remainingAmountNum={remainingAmountNum}
          copiedKey={copiedKey}
          onCopyBriva={handleCopy}
          saving={saving}
          onSubmit={handleSubmit}
          onCancel={() => navigateTo('bills')}
          handleStudentSelect={handleStudentSelect}
          handleStatusChange={handleStatusChange}
          handleAmountChange={handleAmountChange}
          handlePaidAmountChange={handlePaidAmountChange}
          canManage={can('manage_billing')}
        />
      </div>
    </div>
  );
}

BillEditPage.displayName = 'BillEditPage';
