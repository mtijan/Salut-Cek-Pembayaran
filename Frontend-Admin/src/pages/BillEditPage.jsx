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
          <RefreshCw size={36} className="spin" style={{ color: 'var(--brand-primary, #059669)' }} />
          <p style={{ color: 'var(--text-muted, #6b7280)', fontSize: '15px' }}>
            Memuat formulir data tagihan...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="content-container">
      {/* Header & Breadcrumb */}
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

      {/* 2-Column Layout */}
      <div className="profile-layout-grid" style={{ alignItems: 'start' }}>
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
