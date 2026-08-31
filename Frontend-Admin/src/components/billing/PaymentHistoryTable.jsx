import React from 'react';
import { History, ArrowRight, UserCheck, Receipt } from 'lucide-react';

/**
 * Tabel ledger riwayat transaksi pembayaran untuk satu tagihan.
 * Props: transactions (array dari API getDetail)
 */
export default function PaymentHistoryTable({ transactions = [] }) {
  if (transactions.length === 0) {
    return (
      <div className="panel-card payment-history-card">
        <div className="payment-history-header">
          <div className="flex-row-gap-8">
            <div className="icon-badge-brand-sm">
              <History size={16} />
            </div>
            <h3 className="panel-header-title">Riwayat Pembayaran Tagihan</h3>
            <span className="badge badge-sm badge-neutral">0 Transaksi</span>
          </div>
        </div>
        <div className="history-empty-pad">
          <div className="history-empty-circle">
            <Receipt size={28} className="history-empty-icon" />
          </div>
          <h4 className="empty-state-title">Belum Ada Transaksi</h4>
          <p className="empty-state-desc">
            Belum ada mutasi transaksi pembayaran yang tercatat untuk tagihan ini.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="panel-card payment-history-card">
      <div className="payment-history-header">
        <div className="flex-row-gap-8">
          <div className="icon-badge-brand-sm">
            <History size={16} />
          </div>
          <h3 className="panel-header-title">Riwayat Mutasi Pembayaran</h3>
          <span className="badge badge-sm badge-success">{transactions.length} Transaksi</span>
        </div>
      </div>

      <div className="table-responsive payment-history-table-wrap">
        <table className="data-table payment-history-table">
          <thead>
            <tr>
              <th>Tanggal &amp; Waktu</th>
              <th>Tipe Mutasi</th>
              <th className="text-right">Nominal Transaksi</th>
              <th className="text-right">Akumulasi Terbayar</th>
              <th>Status Tagihan</th>
              <th>Metode &amp; Ref</th>
              <th>Catatan</th>
              <th>Dicatat Oleh</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((tx) => (
              <tr key={tx.id}>
                <td>
                  <div className="tx-date-main">{tx.payment_date || '-'}</div>
                  <div className="cell-xs text-muted mono-font">{tx.created_at || ''}</div>
                </td>
                <td>
                  <span
                    className={`badge badge-sm ${
                      tx.transaction_type === 'payment'
                        ? 'badge-success'
                        : tx.transaction_type === 'reversal'
                          ? 'badge-danger'
                          : 'badge-warning'
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
                  className={`text-right font-bold font-mono ${tx.amount >= 0 ? 'text-success' : 'text-danger'}`}
                >
                  {tx.amount >= 0 ? `+ ${tx.amount_formatted}` : `- ${tx.amount_formatted}`}
                </td>
                <td className="text-right font-semibold font-mono text-ink">
                  {tx.running_paid_total_formatted}
                </td>
                <td>
                  <div className="tx-status-transition">
                    <span className="status-crumb-from">{tx.previous_status || 'unpaid'}</span>
                    <ArrowRight size={11} className="text-muted" />
                    <span className="status-crumb-to font-bold">{tx.new_status}</span>
                  </div>
                </td>
                <td>
                  <span className="badge badge-sm badge-neutral">{tx.payment_method || 'BRIVA'}</span>
                  {tx.reference_number && (
                    <div className="mono-font cell-xs text-muted mt-1">Ref: {tx.reference_number}</div>
                  )}
                </td>
                <td className="cell-notes">{tx.notes || '-'}</td>
                <td>
                  <div className="tx-admin-cell">
                    <UserCheck size={13} className="text-emerald flex-shrink-0" />
                    <span className="cell-sm">{tx.recorded_by_name || 'Admin SALUT'}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

PaymentHistoryTable.displayName = 'PaymentHistoryTable';
