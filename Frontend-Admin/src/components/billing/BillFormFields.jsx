import React from 'react';
import { AlertCircle, RefreshCw, Save, FileEdit, PlusCircle, FileText } from 'lucide-react';
import BillStudentField from './BillStudentField';
import BillIdentityFields from './BillIdentityFields';
import BillPaymentFields from './BillPaymentFields';
import BillCalculationPreview from './BillCalculationPreview';

export default function BillFormFields({
  isCreate,
  formData,
  setFormData,
  formError,
  periods,
  students,
  loadedStudent,
  totalAmountNum,
  paidAmountNum,
  remainingAmountNum,
  copiedKey,
  onCopyBriva,
  saving,
  onSubmit,
  onCancel,
  handleStudentSelect,
  handleStatusChange,
  handleAmountChange,
  handlePaidAmountChange,
  canManage,
}) {
  return (
    <div className="panel-card bill-form-main-card">
      <form onSubmit={onSubmit}>
        {/* Form Header */}
        <div className="bill-form-top-bar">
          <div className="flex-row-gap-12">
            <div className="icon-badge-brand">
              {isCreate ? <PlusCircle size={20} /> : <FileEdit size={20} />}
            </div>
            <div>
              <h3 className="bill-form-title">
                {isCreate ? 'Formulir Tagihan Baru' : 'Formulir Edit Data Tagihan'}
              </h3>
              <p className="bill-form-desc">
                Lengkapi seluruh informasi tagihan dengan teliti untuk sinkronisasi sistem keuangan.
              </p>
            </div>
          </div>
          <span className={`badge ${isCreate ? 'badge-info' : 'badge-success'}`}>
            {isCreate ? 'Mode Buat Baru' : 'Mode Perbarui'}
          </span>
        </div>

        {/* Error Alert */}
        {formError && (
          <div className="alert-box alert-danger bill-alert-error">
            <AlertCircle size={18} className="flex-shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        <div className="bill-fields-grid">
          {/* Student Picker (Create) or Read-Only (Edit) */}
          <BillStudentField
            isCreate={isCreate}
            formData={formData}
            handleStudentSelect={handleStudentSelect}
            students={students}
            loadedStudent={loadedStudent}
          />

          {/* Bill Type and Period */}
          <BillIdentityFields formData={formData} setFormData={setFormData} periods={periods} />

          {/* Amount, BRIVA, Due Date, Status, Paid Amount */}
          <BillPaymentFields
            formData={formData}
            setFormData={setFormData}
            handleAmountChange={handleAmountChange}
            handleStatusChange={handleStatusChange}
            handlePaidAmountChange={handlePaidAmountChange}
            totalAmountNum={totalAmountNum}
            copiedKey={copiedKey}
            onCopyBriva={onCopyBriva}
          />

          {/* Live Calculation Preview */}
          <BillCalculationPreview
            formData={formData}
            totalAmountNum={totalAmountNum}
            paidAmountNum={paidAmountNum}
            remainingAmountNum={remainingAmountNum}
          />

          {/* Instructions */}
          <div className="bill-field-full-col">
            <label className="bill-field-label">
              <FileText size={14} className="field-label-icon" />
              <span>Petunjuk Pembayaran / Catatan</span>
              <span className="field-optional-tag">(Opsional)</span>
            </label>
            <textarea
              className="form-control w-full-box bill-textarea"
              rows={3}
              value={formData.instructions}
              onChange={(e) => setFormData((prev) => ({ ...prev, instructions: e.target.value }))}
              placeholder="Petunjuk cara pembayaran untuk mahasiswa..."
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="bill-form-actions-row">
          <button type="button" onClick={onCancel} className="btn btn-secondary" disabled={saving}>
            Batal
          </button>

          <button
            type="submit"
            className="btn btn-primary btn-submit-bill"
            disabled={saving || !canManage}
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
  );
}

BillFormFields.displayName = 'BillFormFields';
