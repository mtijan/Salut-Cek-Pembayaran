import React from 'react';

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
    <div className="form-grid-2 mt-3">
      <div className="form-group">
        <label>
          Tanggal Transaksi Pembayaran <span className="text-danger">*</span>
        </label>
        <input
          type="date"
          value={paymentDate}
          onChange={(event) => setPaymentDate(event.target.value)}
          className="form-input"
          required
        />
      </div>

      <div className="form-group">
        <label>Metode Pembayaran</label>
        <select
          value={paymentMethod}
          onChange={(event) => setPaymentMethod(event.target.value)}
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
          onChange={(event) => setReferenceNumber(event.target.value)}
          className="form-input"
          placeholder="Contoh: REF-20260825-9988"
        />
      </div>

      <div className="form-group">
        <label>Catatan / Keterangan Pembayaran (Opsional)</label>
        <input
          type="text"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          className="form-input"
          placeholder="Contoh: Cicilan ke-1 biaya UKT semester genap"
        />
      </div>
    </div>
  );
}

PaymentTransactionFields.displayName = 'PaymentTransactionFields';
