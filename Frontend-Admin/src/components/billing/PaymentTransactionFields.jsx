import React from 'react';
import { Calendar, CreditCard, Hash, FileText } from 'lucide-react';

export default function PaymentTransactionFields({
  paymentDate,
  setPaymentDate,
  paymentMethod,
  setPaymentMethod,
  referenceNumber,
  setReferenceNumber,
  notes,
  setNotes,
}) {
  return (
    <div className="payment-tx-grid mt-3">
      <div className="form-group">
        <label className="field-label-iconic">
          <Calendar size={14} className="field-label-icon" />
          <span>Tanggal Transaksi Pembayaran</span>
          <span className="text-danger">*</span>
        </label>
        <input
          type="date"
          value={paymentDate}
          onChange={(event) => setPaymentDate(event.target.value)}
          className="form-input payment-field-input"
          required
        />
      </div>

      <div className="form-group">
        <label className="field-label-iconic">
          <CreditCard size={14} className="field-label-icon" />
          <span>Metode Pembayaran</span>
        </label>
        <select
          value={paymentMethod}
          onChange={(event) => setPaymentMethod(event.target.value)}
          className="form-input payment-field-input payment-field-select"
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
        <label className="field-label-iconic">
          <Hash size={14} className="field-label-icon" />
          <span>Nomor Referensi Transaksi Bank</span>
          <span className="field-optional-tag">(Opsional)</span>
        </label>
        <input
          type="text"
          value={referenceNumber}
          onChange={(event) => setReferenceNumber(event.target.value)}
          className="form-input payment-field-input mono-font"
          placeholder="Contoh: REF-20260825-9988"
        />
      </div>

      <div className="form-group">
        <label className="field-label-iconic">
          <FileText size={14} className="field-label-icon" />
          <span>Catatan / Keterangan Transaksi</span>
          <span className="field-optional-tag">(Opsional)</span>
        </label>
        <input
          type="text"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          className="form-input payment-field-input"
          placeholder="Contoh: Cicilan ke-1 biaya UKT semester ganjil"
        />
      </div>
    </div>
  );
}

PaymentTransactionFields.displayName = 'PaymentTransactionFields';
