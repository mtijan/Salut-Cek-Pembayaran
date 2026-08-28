import React from 'react';
import { Clock } from 'lucide-react';

export function Student360History({ history, loading, onFetch, pagination }) {
  return (
    <div>
      <h4 className="card-sub-title mb-2">Log Kronologis Pembayaran &amp; Perubahan Status</h4>
      {!history.length ? (
        <div className="empty-state-card empty-state-360">
          <Clock size={32} className="empty-state-icon" />
          <p className="empty-state-desc">
            Belum ada log histori pembayaran yang tercatat untuk mahasiswa ini.
          </p>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Waktu &amp; Tanggal</th>
                <th>Tipe</th>
                <th>Perubahan Status</th>
                <th>Nominal</th>
                <th>Total Terbayar</th>
                <th>Metode / BRIVA</th>
                <th>Referensi / Catatan</th>
                <th>Dicatat Oleh</th>
              </tr>
            </thead>
            <tbody>
              {history.map((transaction) => (
                <tr key={transaction.id}>
                  <td className="cell-sm">
                    <div>
                      <strong>{transaction.payment_date}</strong>
                    </div>
                    <span className="cell-xs text-muted">{transaction.created_at}</span>
                  </td>
                  <td>
                    <span
                      className={`badge badge-sm ${transaction.transaction_type === 'payment' ? 'badge-success' : transaction.transaction_type === 'reversal' ? 'badge-danger' : 'badge-warning'}`}
                    >
                      {transaction.transaction_type === 'payment'
                        ? 'Pembayaran'
                        : transaction.transaction_type === 'reversal'
                          ? 'Pembatalan'
                          : 'Koreksi'}
                    </span>
                  </td>
                  <td className="cell-sm">
                    <span className="capitalize">{transaction.previous_status}</span>
                    <span className="crumb-sep">&rarr;</span>
                    <span className="capitalize font-bold">{transaction.new_status}</span>
                  </td>
                  <td>
                    <strong className={transaction.amount >= 0 ? 'text-success' : 'text-danger'}>
                      {transaction.amount >= 0
                        ? `+${transaction.amount_formatted}`
                        : `-${transaction.amount_formatted}`}
                    </strong>
                  </td>
                  <td>
                    <strong className="text-ink">{transaction.running_paid_total_formatted}</strong>
                  </td>
                  <td className="cell-sm">
                    <div>{transaction.payment_method || 'BRIVA'}</div>
                    {transaction.briva && (
                      <code className="cell-xs text-muted">{transaction.briva}</code>
                    )}
                  </td>
                  <td className="cell-notes">
                    {transaction.reference_number && (
                      <div>
                        <code>{transaction.reference_number}</code>
                      </div>
                    )}
                    <span className="text-muted">{transaction.notes || '-'}</span>
                  </td>
                  <td className="cell-sm">
                    <div>{transaction.recorded_by_name || 'Admin'}</div>
                    <span className="cell-source">{transaction.source}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="pagination-controls pagination-360-row">
            <span className="cell-sm text-muted">
              Menampilkan {history.length} dari {pagination.total} transaksi
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
        </div>
      )}
    </div>
  );
}

Student360History.displayName = 'Student360History';
