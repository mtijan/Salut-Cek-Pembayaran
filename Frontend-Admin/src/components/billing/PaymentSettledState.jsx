import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { formatRupiah } from '../../utils/currency';

export default function PaymentSettledState({ totalAmount }) {
  return (
    <div className="paid-celebration-box">
      <CheckCircle2 size={42} color="var(--success)" style={{ margin: '0 auto 12px' }} />
      <h4 style={{ fontSize: 17, fontWeight: 800, color: 'var(--success)' }}>
        Tagihan Ini Sudah Lunas Sepenuhnya
      </h4>
      <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
        Total tagihan sebesar {formatRupiah(totalAmount)} telah terbayar lunas. Tidak ada sisa
        tunggakan yang perlu dibayarkan.
      </p>
    </div>
  );
}
