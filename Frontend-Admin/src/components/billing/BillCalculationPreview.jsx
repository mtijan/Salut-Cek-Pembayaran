import React from 'react';
import { Calculator } from 'lucide-react';
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
      <div className="bill-calc-left-col">
        <div className="bill-calc-title-row">
          <Calculator size={14} className="text-muted" />
          <span className="bill-calc-title">Kalkulasi Sisa Tagihan Real-Time</span>
        </div>
        <div className="bill-calc-math">
          <span>{formatRupiah(totalAmountNum)}</span>
          <span className="calc-math-op">-</span>
          <span>{formatRupiah(paidAmountNum)}</span>
          <span className="calc-math-op">=</span>
          <span
            className={`font-bold ${remainingAmountNum > 0 ? 'text-amber' : 'text-emerald'}`}
          >
            {formatRupiah(remainingAmountNum)}
          </span>
        </div>
      </div>

      <div className="bill-calc-status-row">
        <span className="bill-calc-status-label">Status Akhir:</span>
        <span
          className={`badge badge-sm ${
            formData.status === 'paid'
              ? 'badge-success'
              : formData.status === 'partial'
                ? 'badge-warning'
                : 'badge-danger'
          }`}
        >
          {formData.status === 'paid'
            ? 'LUNAS (PAID)'
            : formData.status === 'partial'
              ? 'BAYAR SEBAGIAN'
              : 'BELUM LUNAS'}
        </span>
      </div>
    </div>
  );
}

BillCalculationPreview.displayName = 'BillCalculationPreview';
