import React from 'react';
import { Check, Copy, CreditCard } from 'lucide-react';

function FinancialStat({ textClass, label, value }) {
  return (
    <div className="bio-stat-item">
      <span className="bio-stat-label">{label}</span>
      <div className={`bio-stat-val ${textClass}`}>{value}</div>
    </div>
  );
}

export function Student360Financial({ bills, copiedKey, onCopy, percentPaid, summary }) {
  return (
    <div>
      <div className="fin-360-grid">
        <FinancialStat
          textClass="text-brand-strong"
          label="Total Tagihan"
          value={summary?.total_amount_formatted || 'Rp 0'}
        />
        <FinancialStat
          textClass="text-success"
          label="Sudah Terbayar"
          value={summary?.total_paid_formatted || 'Rp 0'}
        />
        <FinancialStat
          textClass="text-danger"
          label="Sisa Tunggakan"
          value={summary?.total_outstanding_formatted || 'Rp 0'}
        />
        <div className="bio-stat-item">
          <span className="bio-stat-label">Status Pelunasan</span>
          <div className="mt-1">
            <span
              className={`badge ${summary?.overall_status === 'paid' ? 'badge-success' : summary?.overall_status === 'partial' ? 'badge-warning' : 'badge-danger'}`}
            >
              {summary?.overall_status === 'paid'
                ? 'Lunas'
                : summary?.overall_status === 'partial'
                  ? 'Sebagian'
                  : 'Belum Lunas'}
            </span>
          </div>
        </div>
      </div>
      <div className="fin-progress-banner">
        <div className="fin-progress-title-row">
          <span className="text-muted">Progres Pelunasan Mahasiswa</span>
          <span className={percentPaid === 100 ? 'text-success' : 'text-brand-strong'}>
            {percentPaid}% Terbayar
          </span>
        </div>
        <div className="fin-progress-bar mt-2">
          <progress
            className={`fin-progress-semantic ${percentPaid === 100 ? 'success' : ''}`}
            value={percentPaid}
            max={100}
            aria-label={`Progres pelunasan ${percentPaid}%`}
          />
        </div>
      </div>
      <h4 className="card-sub-title mb-2">Daftar Tagihan &amp; Rekening BRIVA</h4>
      {!bills.length ? (
        <div className="empty-state-card empty-state-360">
          <CreditCard size={32} className="empty-state-icon" />
          <p className="empty-state-desc">
            Belum ada riwayat tagihan terdaftar untuk mahasiswa ini.
          </p>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Periode</th>
                <th>Jenis Tagihan</th>
                <th>Nominal</th>
                <th>Status</th>
                <th>Batas Pembayaran</th>
                <th>Nomor BRIVA</th>
              </tr>
            </thead>
            <tbody>
              {bills.map((bill) => {
                const copyKey = `BRIVA (${bill.briva})`;
                return (
                  <tr key={bill.id}>
                    <td>
                      <strong>{bill.period}</strong>
                    </td>
                    <td>{bill.bill_type}</td>
                    <td>
                      <div>
                        <strong className="text-brand-strong">{bill.amount_formatted}</strong>
                      </div>
                      {bill.status === 'partial' && (
                        <div className="cell-xs mt-1">
                          <span className="text-success">
                            Dibayar: {bill.paid_amount_formatted}
                          </span>{' '}
                          &bull;{' '}
                          <span className="text-danger">
                            Sisa: {bill.remaining_amount_formatted}
                          </span>
                        </div>
                      )}
                    </td>
                    <td>
                      <span
                        className={`badge ${bill.status === 'paid' ? 'badge-success' : bill.status === 'partial' ? 'badge-warning' : 'badge-danger'}`}
                      >
                        {bill.status === 'paid'
                          ? 'Lunas'
                          : bill.status === 'partial'
                            ? 'Bayar Sebagian'
                            : 'Belum Lunas'}
                      </span>
                    </td>
                    <td>{bill.due_date_formatted || '-'}</td>
                    <td>
                      <div className="flex-row-center">
                        <code className="font-mono-600 text-ink">{bill.briva}</code>
                        {bill.briva && (
                          <button
                            type="button"
                            className="copy-btn-inline"
                            onClick={() => onCopy(bill.briva, copyKey)}
                            title="Salin BRIVA"
                          >
                            {copiedKey === copyKey ? (
                              <Check size={13} className="text-success" />
                            ) : (
                              <Copy size={13} />
                            )}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

Student360Financial.displayName = 'Student360Financial';
