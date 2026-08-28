import React from 'react';
import { formatRupiah } from '../../utils/currency';

export default function BillCalculationPreview({
  formData,
  totalAmountNum,
  paidAmountNum,
  remainingAmountNum,
}) {
  return (
    <div
      className={`bill-live-calc-box ${
        formData.status === 'paid' ? 'paid' : formData.status === 'partial' ? 'partial' : 'unpaid'
      }`}
    >
      <div>
        <div className="bill-calc-title">Kalkulasi Sisa Tagihan Real-Time</div>
        <div className="bill-calc-math">
          {formatRupiah(totalAmountNum)} - {formatRupiah(paidAmountNum)} ={' '}
          <span className={remainingAmountNum > 0 ? 'text-amber' : 'text-emerald'}>
            {formatRupiah(remainingAmountNum)}
          </span>
        </div>
      </div>

      <div className="bill-calc-status-row">
        <span className="bill-calc-status-label">Status Akhir:</span>
        <span
          className={`bill-status-pill ${
            formData.status === 'paid'
              ? 'paid'
              : formData.status === 'partial'
                ? 'partial'
                : 'unpaid'
          }`}
        >
          {formData.status === 'paid'
            ? 'LUNAS'
            : formData.status === 'partial'
              ? 'BAYAR SEBAGIAN'
              : 'BELUM LUNAS'}
        </span>
      </div>
    </div>
  );
}

BillCalculationPreview.displayName = 'BillCalculationPreview';
