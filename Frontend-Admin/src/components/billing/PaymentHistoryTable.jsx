import React from 'react';
import { Clock } from 'lucide-react';

/**
 * Tabel ledger riwayat transaksi pembayaran untuk satu tagihan.
 * Props: transactions (array dari API getDetail)
 */
export default function PaymentHistoryTable({ transactions }) {
  if (transactions.length === 0) {
    return (
      <div className="panel-card payment-history-card">
        <div className="payment-history-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Clock size={17} color="var(--brand)" />
            <h3 style={{ fontSize: 15, fontWeight: 700 }}>Riwayat Pembayaran Tagihan (0)</h3>
          </div>
        </div>
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--muted)' }}>
          <Clock size={32} style={{ margin: '0 auto 8px', opacity: 0.3 }} />
          <p style={{ fontSize: 13, fontWeight: 600 }}>
            Belum ada mutasi transaksi pembayaran untuk tagihan ini.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="panel-card payment-history-card">
      <div className="payment-history-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Clock size={17} color="var(--brand)" />
          <h3 style={{ fontSize: 15, fontWeight: 700 }}>
            Riwayat Pembayaran Tagihan Ini ({transactions.length})
          </h3>
        </div>
      </div>

      <div className="table-responsive">
        <table className="data-table">
          <thead>
            <tr>
              <th>Tanggal</th>
              <th>Tipe Mutasi</th>
              <th style={{ textAlign: 'right' }}>Nominal Transaksi</th>
              <th style={{ textAlign: 'right' }}>Akumulasi Terbayar</th>
              <th>Status Tagihan</th>
              <th>Metode &amp; Referensi</th>
              <th>Catatan</th>
              <th>Dicatat Oleh</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((tx) => (
              <tr key={tx.id}>
                <td>
                  <div style={{ fontWeight: 600 }}>{tx.payment_date || '-'}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>{tx.created_at || ''}</div>
                </td>
                <td>
                  <span
                    className={`badge ${
                      tx.transaction_type === 'payment'
                        ? 'badge-success'
                        : tx.transaction_type === 'reversal'
                          ? 'badge-danger'
                          : 'badge-neutral'
                    }`}
                  >
                    {tx.transaction_type === 'payment'
                      ? 'PEMBAYARAN'
                      : tx.transaction_type === 'reversal'
                        ? 'PEMBATALAN'
                        : 'KOREKSI'}
                  </span>
                </td>
                <td
                  style={{
                    textAlign: 'right',
                    fontWeight: 700,
                    color: tx.amount >= 0 ? 'var(--success)' : 'var(--danger)',
                  }}
                >
                  {tx.amount >= 0 ? `+ ${tx.amount_formatted}` : `- ${tx.amount_formatted}`}
                </td>
                <td style={{ textAlign: 'right', fontWeight: 600 }}>
                  {tx.running_paid_total_formatted}
                </td>
                <td>
                  <div style={{ fontSize: 12 }}>
                    <span>{tx.previous_status || 'unpaid'}</span>
                    <span style={{ margin: '0 4px' }}>→</span>
                    <strong>{tx.new_status}</strong>
                  </div>
                </td>
                <td>
                  <div style={{ fontWeight: 600 }}>{tx.payment_method || 'BRIVA'}</div>
                  {tx.reference_number && (
                    <div className="mono-font" style={{ fontSize: 11, color: 'var(--muted)' }}>
                      Ref: {tx.reference_number}
                    </div>
                  )}
                </td>
                <td style={{ fontSize: 12.5, maxWidth: 200 }}>{tx.notes || '-'}</td>
                <td style={{ fontSize: 12 }}>{tx.recorded_by_name || 'Admin SALUT'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

PaymentHistoryTable.displayName = 'PaymentHistoryTable';
