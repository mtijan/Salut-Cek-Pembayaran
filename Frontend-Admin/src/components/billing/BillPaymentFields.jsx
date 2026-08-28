import React from 'react';
import { Check, Copy } from 'lucide-react';

export default function BillPaymentFields({
  formData,
  setFormData,
  handleAmountChange,
  handleStatusChange,
  handlePaidAmountChange,
  totalAmountNum,
  copiedKey,
  onCopyBriva,
}) {
  const isPaidOrUnpaid = formData.status === 'unpaid' || formData.status === 'paid';

  return (
    <>
      {/* Total Amount */}
      <div>
        <label className="bill-field-label">
          Total Nominal Tagihan (Rp) <span className="bill-req-star">*</span>
        </label>
        <div className="bill-currency-input-container">
          <span className="bill-currency-prefix-tag">Rp</span>
          <input
            type="number"
            className="form-control bill-currency-field"
            value={formData.amount}
            onChange={handleAmountChange}
            placeholder="Contoh: 1500000"
            min="1"
            required
          />
        </div>
      </div>

      {/* BRIVA */}
      <div>
        <label className="bill-field-label">
          Nomor Rekening BRIVA <span className="bill-req-star">*</span>
        </label>
        <div className="flex-row-gap-6">
          <input
            type="text"
            className="form-control flex-1 font-mono-600"
            value={formData.briva}
            onChange={(e) => setFormData((prev) => ({ ...prev, briva: e.target.value }))}
            placeholder="Contoh: 178100012345"
            required
          />
          {formData.briva && (
            <button
              type="button"
              onClick={() => onCopyBriva(formData.briva, 'BRIVA')}
              className="btn btn-secondary btn-copy-briva"
              title="Salin BRIVA"
            >
              {copiedKey === 'BRIVA' ? (
                <Check size={15} className="icon-primary" />
              ) : (
                <Copy size={15} />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Due Date */}
      <div>
        <label className="bill-field-label">Batas Pembayaran / Jatuh Tempo</label>
        <input
          type="date"
          className="form-control"
          value={formData.due_date}
          onChange={(e) => setFormData((prev) => ({ ...prev, due_date: e.target.value }))}
        />
      </div>

      {/* Status */}
      <div>
        <label className="bill-field-label">
          Status Pembayaran <span className="bill-req-star">*</span>
        </label>
        <select
          className="form-control bill-status-select"
          value={formData.status}
          onChange={(e) => handleStatusChange(e.target.value)}
        >
          <option value="unpaid">Belum Lunas (Unpaid)</option>
          <option value="partial">Bayar Sebagian (Partial)</option>
          <option value="paid">Lunas (Paid)</option>
        </select>
      </div>

      {/* Paid Amount */}
      <div>
        <label className="bill-field-label">Nominal Sudah Terbayar (Rp)</label>
        <div className="bill-currency-input-container">
          <span className="bill-currency-prefix-tag">Rp</span>
          <input
            type="number"
            className={`form-control bill-currency-field ${isPaidOrUnpaid ? 'bg-field-disabled' : 'bg-field-enabled'}`}
            value={formData.paid_amount}
            onChange={handlePaidAmountChange}
            disabled={isPaidOrUnpaid}
            placeholder="0"
            min="0"
            max={totalAmountNum}
          />
        </div>
        <div className="bill-field-hint">
          {formData.status === 'partial'
            ? 'Masukkan nominal cicilan yang sudah dibayarkan mahasiswa'
            : formData.status === 'paid'
              ? 'Otomatis bernilai penuh sesuai total tagihan'
              : 'Bernilai 0 saat status Belum Lunas'}
        </div>
      </div>
    </>
  );
}

BillPaymentFields.displayName = 'BillPaymentFields';
