import React from 'react';
import { Clock, RefreshCw } from 'lucide-react';

export function TransactionHistoryTab({ historyList, loading, onFetch, pagination, studentName }) {
  return (
    <div className="profile-tab-pane">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700 }}>Riwayat Mutasi & Transaksi Pembayaran</h3>
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>
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
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
          <Clock size={36} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
          <p style={{ fontWeight: 600 }}>Belum ada riwayat transaksi pembayaran tercatat.</p>
        </div>
      ) : (
        <>
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Waktu & Tanggal</th>
                  <th>Tipe Mutasi</th>
                  <th style={{ textAlign: 'right' }}>Nominal Transaksi</th>
                  <th style={{ textAlign: 'right' }}>Running Total</th>
                  <th>Status Tagihan</th>
                  <th>Metode & Referensi</th>
                  <th>Catatan</th>
                  <th>Operator</th>
                </tr>
              </thead>
              <tbody>
                {historyList.map((transaction) => (
                  <tr key={transaction.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{transaction.payment_date || '-'}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                        {transaction.created_at || ''}
                      </div>
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
                      style={{
                        textAlign: 'right',
                        fontWeight: 700,
                        color: transaction.amount >= 0 ? 'var(--success)' : 'var(--danger)',
                      }}
                    >
                      {transaction.amount >= 0
                        ? `+ ${transaction.amount_formatted}`
                        : `- ${transaction.amount_formatted}`}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>
                      {transaction.running_paid_total_formatted}
                    </td>
                    <td style={{ fontSize: 12 }}>
                      <span>{transaction.previous_status || 'unpaid'}</span>
                      <span style={{ margin: '0 4px' }}>&rarr;</span>
                      <strong>{transaction.new_status}</strong>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{transaction.payment_method || 'BRIVA'}</div>
                      {transaction.reference_number && (
                        <div className="mono-font" style={{ fontSize: 11, color: 'var(--muted)' }}>
                          Ref: {transaction.reference_number}
                        </div>
                      )}
                    </td>
                    <td style={{ fontSize: 12.5, maxWidth: 200 }}>{transaction.notes || '-'}</td>
                    <td style={{ fontSize: 12 }}>
                      {transaction.recorded_by_name || 'Admin SALUT'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pagination.total > pagination.limit && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: 14,
                paddingTop: 12,
                borderTop: '1px solid var(--line)',
              }}
            >
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                Menampilkan {historyList.length} dari {pagination.total} transaksi
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
          )}
        </>
      )}
    </div>
  );
}
