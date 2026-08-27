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
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700 }}>Daftar Tagihan Mahasiswa</h3>
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>
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
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
          <CreditCard size={36} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
          <p style={{ fontWeight: 600 }}>Belum ada data tagihan untuk mahasiswa ini.</p>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Periode</th>
                <th>Jenis Tagihan</th>
                <th>Nomor BRIVA</th>
                <th style={{ textAlign: 'right' }}>Total Tagihan</th>
                <th style={{ textAlign: 'right' }}>Terbayar</th>
                <th style={{ textAlign: 'right' }}>Sisa</th>
                <th>Jatuh Tempo</th>
                <th>Status</th>
                <th style={{ textAlign: 'center' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {bills.map((bill) => (
                <tr key={bill.id}>
                  <td style={{ fontWeight: 600 }}>{bill.period || '-'}</td>
                  <td>{bill.bill_type || '-'}</td>
                  <td>
                    <div
                      className="mono-font"
                      style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                      <span>{bill.briva || '-'}</span>
                      {bill.briva && (
                        <button
                          type="button"
                          className="copy-btn-inline"
                          onClick={() => onCopy(bill.briva, 'BRIVA')}
                          title="Salin BRIVA"
                        >
                          {copiedKey === 'BRIVA' ? (
                            <Check size={12} color="var(--success)" />
                          ) : (
                            <Copy size={12} />
                          )}
                        </button>
                      )}
                    </div>
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>{bill.amount_formatted}</td>
                  <td style={{ textAlign: 'right', color: 'var(--success)', fontWeight: 600 }}>
                    {bill.paid_amount_formatted}
                  </td>
                  <td
                    style={{
                      textAlign: 'right',
                      color: bill.remaining_amount > 0 ? 'var(--danger)' : 'var(--muted)',
                      fontWeight: 600,
                    }}
                  >
                    {bill.remaining_amount_formatted}
                  </td>
                  <td style={{ fontSize: 12.5 }}>{bill.due_date_formatted || '-'}</td>
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
                  <td style={{ textAlign: 'center' }}>
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
