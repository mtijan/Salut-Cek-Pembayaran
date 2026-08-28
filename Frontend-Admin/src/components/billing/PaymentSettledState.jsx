import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { formatRupiah } from '../../utils/currency';

export default function PaymentSettledState({ totalAmount }) {
  return (
    <div className="paid-celebration-box">
      <CheckCircle2 size={42} className="celebration-icon text-success" />
      <h4 className="celebration-title">Tagihan Ini Sudah Lunas Sepenuhnya</h4>
      <p className="empty-state-desc">
        Total tagihan sebesar {formatRupiah(totalAmount)} telah terbayar lunas. Tidak ada sisa
        tunggakan yang perlu dibayarkan.
      </p>
    </div>
  );
}

PaymentSettledState.displayName = 'PaymentSettledState';
