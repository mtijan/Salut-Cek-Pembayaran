import React from 'react';
import { Clock, RefreshCw } from 'lucide-react';

export function TransactionHistoryTab({ historyList, loading, onFetch, pagination, studentName }) {
  return (
    <div className="profile-tab-pane">
      <div className="reports-top-bar mb-3">
        <div>
          <h3 className="panel-header-title">Riwayat Mutasi &amp; Transaksi Pembayaran</h3>
          <p className="panel-header-desc">
            Ledger mutasi pembayaran yang tercatat secara kronologis untuk {studentName} (
            {pagination.total} transaksi)
          </p>
        </div>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => onFetch(pagination.offset)}
          disabled={loading}
          title="Muat Ulang Transaksi"
        >
          <RefreshCw size={13} className={loading ? 'spin' : ''} />
          <span>Segarkan</span>
        </button>
      </div>
      {historyList.length === 0 ? (
        <div className="table-empty-container">
          <Clock size={36} className="empty-state-icon" />
          <p className="empty-state-title">Belum ada riwayat transaksi pembayaran tercatat.</p>
        </div>
      ) : (
        <>
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Waktu &amp; Tanggal</th>
                  <th>Tipe Mutasi</th>
                  <th className="text-right">Nominal Transaksi</th>
                  <th className="text-right">Running Total</th>
                  <th>Status Tagihan</th>
                  <th>Metode &amp; Referensi</th>
                  <th>Catatan</th>
                  <th>Operator</th>
                </tr>
              </thead>
              <tbody>
                {historyList.map((transaction) => (
                  <tr key={transaction.id}>
                    <td>
                      <div className="font-semibold">{transaction.payment_date || '-'}</div>
                      <div className="cell-xs text-muted">{transaction.created_at || ''}</div>
                    </td>
                    <td>
                      <span
                        className={`badge ${transaction.transaction_type === 'payment' ? 'badge-success' : transaction.transaction_type === 'reversal' ? 'badge-danger' : 'badge-neutral'}`}
                      >
                        {transaction.transaction_type === 'payment'
                          ? 'PEMBAYARAN'
                          : transaction.transaction_type === 'reversal'
                            ? 'PEMBATALAN'
                            : 'KOREKSI'}
                      </span>
                    </td>
                    <td
                      className={`text-right font-bold ${transaction.amount >= 0 ? 'text-success' : 'text-danger'}`}
                    >
                      {transaction.amount >= 0
                        ? `+ ${transaction.amount_formatted}`
                        : `- ${transaction.amount_formatted}`}
                    </td>
                    <td className="text-right font-semibold">
                      {transaction.running_paid_total_formatted}
                    </td>
                    <td>
                      <div className="cell-sm">
                        <span>{transaction.previous_status || 'unpaid'}</span>
                        <span className="crumb-sep">&rarr;</span>
                        <strong>{transaction.new_status}</strong>
                      </div>
                    </td>
                    <td>
                      <div className="font-semibold">{transaction.payment_method || 'BRIVA'}</div>
                      {transaction.reference_number && (
                        <div className="mono-font cell-xs text-muted">
                          Ref: {transaction.reference_number}
                        </div>
                      )}
                    </td>
                    <td className="cell-notes">{transaction.notes || '-'}</td>
                    <td className="cell-sm">{transaction.recorded_by_name || 'Admin SALUT'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pagination.total > pagination.limit && (
            <div className="history-pagination-row">
              <span className="cell-sm text-muted">
                Menampilkan {historyList.length} dari {pagination.total} transaksi
              </span>
              <div className="flex-row-gap-8">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={loading || pagination.offset <= 0}
                  onClick={() => onFetch(Math.max(0, pagination.offset - pagination.limit))}
                >
                  Sebelumnya
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={loading || pagination.offset + pagination.limit >= pagination.total}
                  onClick={() => onFetch(pagination.offset + pagination.limit)}
                >
                  Berikutnya
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

TransactionHistoryTab.displayName = 'TransactionHistoryTab';
