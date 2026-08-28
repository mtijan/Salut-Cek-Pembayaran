import React from 'react';
import { RefreshCw, X } from 'lucide-react';
import { formatRupiah } from '../../utils/currency';

export default function BillHistoryModal({ history, onClose }) {
  if (!history.target) return null;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-dialog large history-modal-dialog"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="history-modal-header">
          <div>
            <h3 className="panel-header-title">Riwayat Mutasi Pembayaran</h3>
            <p className="panel-header-desc">
              BRIVA: <span className="font-mono-600">{history.target.briva}</span> &bull;{' '}
              {history.target.student_name || history.target.full_name}
            </p>
          </div>
          <button type="button" onClick={onClose} className="search-clear-btn">
            <X size={20} />
          </button>
        </div>
        {history.loading ? (
          <div className="panel-loading-state">
            <RefreshCw size={24} className="spin celebration-icon icon-primary" />
            <div>Memuat histori transaksi...</div>
          </div>
        ) : history.list.length === 0 ? (
          <div className="table-empty-container">
            <p className="empty-state-title">
              Belum ada catatan mutasi pembayaran untuk tagihan ini.
            </p>
          </div>
        ) : (
          <div className="history-items-list">
            {history.list.map((transaction, index) => (
              <div key={transaction.id || index} className="history-item-card">
                <div className="history-item-top">
                  <span className="font-bold text-success">
                    +{formatRupiah(transaction.amount)}
                  </span>
                  <span className="cell-xs text-muted">
                    {transaction.payment_date || transaction.created_at?.slice(0, 10) || '-'}
                  </span>
                </div>
                <div className="history-item-meta">
                  <span>
                    Metode: <strong>{transaction.payment_method || 'BRIVA'}</strong>
                  </span>
                  <span>
                    Ref: <strong>{transaction.reference_number || '-'}</strong>
                  </span>
                </div>
                {transaction.notes && (
                  <div className="history-item-notes">&ldquo;{transaction.notes}&rdquo;</div>
                )}
              </div>
            ))}
          </div>
        )}
        <div className="history-modal-footer">
          <button type="button" className="btn btn-secondary back-btn-compact" onClick={onClose}>
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}

BillHistoryModal.displayName = 'BillHistoryModal';
