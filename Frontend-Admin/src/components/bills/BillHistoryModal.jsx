import React from 'react';
import { RefreshCw, X } from 'lucide-react';
import { formatRupiah } from '../../utils/currency';

export default function BillHistoryModal({ history, onClose }) {
  if (!history.target) return null;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-dialog large"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        style={{ maxWidth: 640, borderRadius: 'var(--radius-lg)', padding: 24 }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingBottom: 14,
            borderBottom: '1px solid var(--line)',
            marginBottom: 16,
          }}
        >
          <div>
            <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: 'var(--ink)' }}>
              Riwayat Mutasi Pembayaran
            </h3>
            <p style={{ fontSize: 13, color: 'var(--muted)', margin: '2px 0 0 0' }}>
              BRIVA:{' '}
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                {history.target.briva}
              </span>{' '}
              &bull; {history.target.student_name || history.target.full_name}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--muted)',
              padding: 4,
            }}
          >
            <X size={20} />
          </button>
        </div>
        {history.loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
            <RefreshCw
              size={24}
              className="spin"
              style={{ color: 'var(--brand)', marginBottom: 8 }}
            />
            <div>Memuat histori transaksi...</div>
          </div>
        ) : history.list.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--muted)' }}>
            <p style={{ margin: 0, fontSize: 14 }}>
              Belum ada catatan mutasi pembayaran untuk tagihan ini.
            </p>
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              maxHeight: 400,
              overflowY: 'auto',
            }}
          >
            {history.list.map((transaction, index) => (
              <div
                key={transaction.id || index}
                style={{
                  background: '#f8fafc',
                  border: '1px solid var(--line)',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px 14px',
                  fontSize: 13,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 4,
                  }}
                >
                  <span style={{ fontWeight: 700, color: 'var(--success)' }}>
                    +{formatRupiah(transaction.amount)}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                    {transaction.payment_date || transaction.created_at?.slice(0, 10) || '-'}
                  </span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 12,
                    color: 'var(--muted)',
                  }}
                >
                  <span>
                    Metode: <strong>{transaction.payment_method || 'BRIVA'}</strong>
                  </span>
                  <span>
                    Ref: <strong>{transaction.reference_number || '-'}</strong>
                  </span>
                </div>
                {transaction.notes && (
                  <div
                    style={{ fontSize: 12, color: 'var(--ink)', marginTop: 4, fontStyle: 'italic' }}
                  >
                    &ldquo;{transaction.notes}&rdquo;
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            marginTop: 20,
            paddingTop: 14,
            borderTop: '1px solid var(--line)',
          }}
        >
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            style={{ padding: '8px 16px', borderRadius: 'var(--radius-md)' }}
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
