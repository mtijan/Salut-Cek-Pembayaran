import React from 'react';
import { Check, Copy, CreditCard, Calendar, Activity, Coins } from 'lucide-react';

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
  return (
    <>
      {/* Total Amount */}
      <div className="bill-field-group">
        <label htmlFor="bill-total-amount" className="bill-field-label">
          <Coins size={14} className="field-label-icon" />
          <span>Total Nominal Tagihan</span>
          <span className="bill-req-star">*</span>
        </label>
        <div className="bill-currency-input-container">
          <span className="bill-currency-prefix-tag">Rp</span>
          <input
            id="bill-total-amount"
            type="number"
            inputMode="numeric"
            className="form-control bill-currency-field"
            value={formData.amount}
            onChange={handleAmountChange}
            placeholder="Contoh: 1850000"
            min="1"
            step="1"
            required
          />
        </div>
      </div>

      {/* Status */}
      <div className="bill-field-group">
        <label htmlFor="bill-payment-status" className="bill-field-label">
          <Activity size={14} className="field-label-icon" />
          <span>Status Pembayaran</span>
          <span className="bill-req-star">*</span>
        </label>
        <select
          id="bill-payment-status"
          className="form-control bill-select-control bill-status-select"
          value={formData.status}
          onChange={(e) => handleStatusChange(e.target.value)}
        >
          <option value="unpaid">Belum Lunas (Unpaid)</option>
          <option value="partial">Bayar Sebagian (Partial)</option>
          <option value="paid">Lunas (Paid)</option>
        </select>
      </div>

      {/* BRIVA */}
      <div className="bill-field-group">
        <label className="bill-field-label">
          <CreditCard size={14} className="field-label-icon" />
          <span>Nomor Rekening BRIVA</span>
          <span className="bill-req-star">*</span>
        </label>
        <div className="bill-input-btn-wrap">
          <input
            type="text"
            className="form-control font-mono font-semibold"
            value={formData.briva}
            onChange={(e) => setFormData((prev) => ({ ...prev, briva: e.target.value }))}
            placeholder="Contoh: 178100023200085"
            required
          />
          {formData.briva && (
            <button
              type="button"
              onClick={() => onCopyBriva(formData.briva, 'BRIVA')}
              className="btn btn-secondary btn-copy-input"
              title="Salin BRIVA"
            >
              {copiedKey === 'BRIVA' ? (
                <Check size={14} color="var(--success)" />
              ) : (
                <Copy size={14} />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Due Date */}
      <div className="bill-field-group">
        <label className="bill-field-label">
          <Calendar size={14} className="field-label-icon" />
          <span>Batas Pembayaran / Jatuh Tempo</span>
        </label>
        <input
          type="date"
          className="form-control"
          value={formData.due_date}
          onChange={(e) => setFormData((prev) => ({ ...prev, due_date: e.target.value }))}
        />
      </div>

      {/* Paid Amount */}
      <div className="bill-field-full-col">
        <label htmlFor="bill-paid-amount" className="bill-field-label">
          <Coins size={14} className="field-label-icon" />
          <span>Nominal Sudah Terbayar (Rp)</span>
        </label>
        <div className="bill-currency-input-container">
          <span className="bill-currency-prefix-tag">Rp</span>
          <input
            id="bill-paid-amount"
            type="number"
            inputMode="numeric"
            className="form-control bill-currency-field bg-field-enabled"
            value={formData.paid_amount}
            onChange={handlePaidAmountChange}
            placeholder="0"
            min="0"
            max={totalAmountNum}
            step="1"
            required
            aria-describedby="bill-paid-amount-hint"
          />
        </div>
        <div id="bill-paid-amount-hint" className="bill-field-hint">
          Ketik nominal yang sudah dibayarkan dalam rupiah bulat. Status mengikuti nominal: Rp 0
          berarti belum lunas, sama dengan total berarti lunas.
        </div>
      </div>
    </>
  );
}

BillPaymentFields.displayName = 'BillPaymentFields';
