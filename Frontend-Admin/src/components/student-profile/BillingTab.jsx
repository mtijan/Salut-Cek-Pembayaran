import React from 'react';
import { Check, Copy, CreditCard, Plus } from 'lucide-react';

export function BillingTab({
  bills,
  canManageBilling,
  copiedKey,
  navigateTo,
  onCopy,
  studentName,
}) {
  return (
    <div className="profile-tab-pane">
      <div className="reports-top-bar mb-3">
        <div>
          <h3 className="panel-header-title">Daftar Tagihan Mahasiswa</h3>
          <p className="panel-header-desc">
            Daftar seluruh tagihan yang diterbitkan untuk {studentName}
          </p>
        </div>
        {canManageBilling && (
          <button
            type="button"
            className="btn btn-sm btn-brand"
            onClick={() => navigateTo('bills')}
          >
            <Plus size={14} />
            <span>Buat Tagihan Baru</span>
          </button>
        )}
      </div>
      {bills.length === 0 ? (
        <div className="table-empty-container">
          <CreditCard size={36} className="empty-state-icon" />
          <p className="empty-state-title">Belum ada data tagihan untuk mahasiswa ini.</p>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Periode</th>
                <th>Jenis Tagihan</th>
                <th>Nomor BRIVA</th>
                <th className="text-right">Total Tagihan</th>
                <th className="text-right">Terbayar</th>
                <th className="text-right">Sisa</th>
                <th>Jatuh Tempo</th>
                <th>Status</th>
                <th className="text-center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {bills.map((bill) => (
                <tr key={bill.id}>
                  <td className="font-semibold">{bill.period || '-'}</td>
                  <td>{bill.bill_type || '-'}</td>
                  <td>
                    <div className="mono-font flex-row-gap-6">
                      <span>{bill.briva || '-'}</span>
                      {bill.briva && (
                        <button
                          type="button"
                          className="copy-btn-inline"
                          onClick={() => onCopy(bill.briva, 'BRIVA')}
                          title="Salin BRIVA"
                        >
                          {copiedKey === 'BRIVA' ? (
                            <Check size={12} className="text-success" />
                          ) : (
                            <Copy size={12} />
                          )}
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="text-right font-bold">{bill.amount_formatted}</td>
                  <td className="text-right text-success font-semibold">
                    {bill.paid_amount_formatted}
                  </td>
                  <td
                    className={`text-right font-semibold ${bill.remaining_amount > 0 ? 'text-danger' : 'text-muted'}`}
                  >
                    {bill.remaining_amount_formatted}
                  </td>
                  <td className="cell-notes">{bill.due_date_formatted || '-'}</td>
                  <td>
                    <span
                      className={`badge ${bill.status === 'paid' ? 'badge-success' : bill.status === 'partial' ? 'badge-warning' : 'badge-danger'}`}
                    >
                      {bill.status === 'paid'
                        ? 'LUNAS'
                        : bill.status === 'partial'
                          ? 'SEBAGIAN'
                          : 'BELUM BAYAR'}
                    </span>
                  </td>
                  <td className="text-center">
                    {canManageBilling && (
                      <button
                        type="button"
                        className="btn btn-sm btn-brand"
                        onClick={() => navigateTo('bill-payment', { billId: bill.id })}
                        title="Catat Pembayaran Tagihan Ini"
                      >
                        <CreditCard size={13} />
                        <span>Bayar</span>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

BillingTab.displayName = 'BillingTab';
