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
          <div className="flex-row-gap-8">
            <Clock size={17} color="var(--brand)" />
            <h3 className="panel-header-title">Riwayat Pembayaran Tagihan (0)</h3>
          </div>
        </div>
        <div className="history-empty-pad">
          <Clock size={32} className="history-empty-icon" />
          <p className="loading-state-text">
            Belum ada mutasi transaksi pembayaran untuk tagihan ini.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="panel-card payment-history-card">
      <div className="payment-history-header">
        <div className="flex-row-gap-8">
          <Clock size={17} color="var(--brand)" />
          <h3 className="panel-header-title">
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
              <th className="text-right">Nominal Transaksi</th>
              <th className="text-right">Akumulasi Terbayar</th>
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
                  <div className="font-semibold">{tx.payment_date || '-'}</div>
                  <div className="cell-xs text-muted">{tx.created_at || ''}</div>
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
                  className={`text-right font-bold ${tx.amount >= 0 ? 'text-success' : 'text-danger'}`}
                >
                  {tx.amount >= 0 ? `+ ${tx.amount_formatted}` : `- ${tx.amount_formatted}`}
                </td>
                <td className="text-right font-semibold">{tx.running_paid_total_formatted}</td>
                <td>
                  <div className="cell-sm">
                    <span>{tx.previous_status || 'unpaid'}</span>
                    <span className="crumb-sep">→</span>
                    <strong>{tx.new_status}</strong>
                  </div>
                </td>
                <td>
                  <div className="font-semibold">{tx.payment_method || 'BRIVA'}</div>
                  {tx.reference_number && (
                    <div className="mono-font cell-xs text-muted">Ref: {tx.reference_number}</div>
                  )}
                </td>
                <td className="cell-notes">{tx.notes || '-'}</td>
                <td className="cell-sm">{tx.recorded_by_name || 'Admin SALUT'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

PaymentHistoryTable.displayName = 'PaymentHistoryTable';
