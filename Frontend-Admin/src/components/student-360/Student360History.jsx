import React from 'react';
import { Clock } from 'lucide-react';

export function Student360History({ history, loading, onFetch, pagination }) {
  return (
    <div>
      <h4 style={{ fontSize: 14, fontWeight: 800, color: 'var(--ink)', marginBottom: 10 }}>
        Log Kronologis Pembayaran & Perubahan Status
      </h4>
      {!history.length ? (
        <div className="empty-state-card" style={{ padding: 24, border: '1px solid var(--line)' }}>
          <Clock size={32} color="var(--muted-light)" style={{ marginBottom: 8 }} />
          <p style={{ color: 'var(--muted)', fontSize: 13 }}>
            Belum ada log histori pembayaran yang tercatat untuk mahasiswa ini.
          </p>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Waktu & Tanggal</th>
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
                  <td style={{ fontSize: 12 }}>
                    <div>
                      <strong>{transaction.payment_date}</strong>
                    </div>
                    <span style={{ color: 'var(--muted)', fontSize: 11 }}>
                      {transaction.created_at}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`badge ${transaction.transaction_type === 'payment' ? 'badge-success' : transaction.transaction_type === 'reversal' ? 'badge-danger' : 'badge-warning'}`}
                      style={{ fontSize: 11 }}
                    >
                      {transaction.transaction_type === 'payment'
                        ? 'Pembayaran'
                        : transaction.transaction_type === 'reversal'
                          ? 'Pembatalan'
                          : 'Koreksi'}
                    </span>
                  </td>
                  <td style={{ fontSize: 12 }}>
                    <span style={{ textTransform: 'capitalize' }}>
                      {transaction.previous_status}
                    </span>
                    <span style={{ margin: '0 6px', color: 'var(--muted)' }}>&rarr;</span>
                    <span style={{ textTransform: 'capitalize', fontWeight: 700 }}>
                      {transaction.new_status}
                    </span>
                  </td>
                  <td>
                    <strong
                      style={{
                        color: transaction.amount >= 0 ? 'var(--success)' : 'var(--danger)',
                      }}
                    >
                      {transaction.amount >= 0
                        ? `+${transaction.amount_formatted}`
                        : `-${transaction.amount_formatted}`}
                    </strong>
                  </td>
                  <td>
                    <strong style={{ color: 'var(--ink)' }}>
                      {transaction.running_paid_total_formatted}
                    </strong>
                  </td>
                  <td style={{ fontSize: 12 }}>
                    <div>{transaction.payment_method || 'BRIVA'}</div>
                    {transaction.briva && (
                      <code style={{ fontSize: 11, color: 'var(--muted)' }}>
                        {transaction.briva}
                      </code>
                    )}
                  </td>
                  <td style={{ fontSize: 12, maxWidth: 220 }}>
                    {transaction.reference_number && (
                      <div>
                        <code>{transaction.reference_number}</code>
                      </div>
                    )}
                    <span style={{ color: 'var(--muted)' }}>{transaction.notes || '-'}</span>
                  </td>
                  <td style={{ fontSize: 12 }}>
                    <div>{transaction.recorded_by_name || 'Admin'}</div>
                    <span
                      style={{ color: 'var(--muted)', fontSize: 10, textTransform: 'uppercase' }}
                    >
                      {transaction.source}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="pagination-controls" style={{ marginTop: 12 }}>
            <span style={{ color: 'var(--muted)', fontSize: 12 }}>
              Menampilkan {history.length} dari {pagination.total} transaksi
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
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
