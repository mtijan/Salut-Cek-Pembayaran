import React from 'react';
import { Check, Copy, CreditCard } from 'lucide-react';

function FinancialStat({ color, label, value }) {
  return (
    <div
      style={{
        padding: 14,
        background: '#ffffff',
        border: '1px solid var(--line)',
        borderRadius: 'var(--radius-md)',
      }}
    >
      <span
        style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)' }}
      >
        {label}
      </span>
      <div style={{ fontSize: 18, fontWeight: 800, color, marginTop: 4 }}>{value}</div>
    </div>
  );
}

export function Student360Financial({ bills, copiedKey, onCopy, percentPaid, summary }) {
  return (
    <div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 12,
          marginBottom: 18,
        }}
      >
        <FinancialStat
          color="var(--brand-strong)"
          label="Total Tagihan"
          value={summary?.total_amount_formatted || 'Rp 0'}
        />
        <FinancialStat
          color="var(--success)"
          label="Sudah Terbayar"
          value={summary?.total_paid_formatted || 'Rp 0'}
        />
        <FinancialStat
          color="var(--danger)"
          label="Sisa Tunggakan"
          value={summary?.total_outstanding_formatted || 'Rp 0'}
        />
        <div
          style={{
            padding: 14,
            background: '#ffffff',
            border: '1px solid var(--line)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              textTransform: 'uppercase',
              color: 'var(--muted)',
            }}
          >
            Status Pelunasan
          </span>
          <div style={{ marginTop: 6 }}>
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
      <div
        style={{
          padding: 14,
          background: '#f8fafc',
          border: '1px solid var(--line)',
          borderRadius: 'var(--radius-md)',
          marginBottom: 20,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          <span style={{ color: 'var(--muted)' }}>Progres Pelunasan Mahasiswa</span>
          <span style={{ color: percentPaid === 100 ? 'var(--success)' : 'var(--brand-strong)' }}>
            {percentPaid}% Terbayar
          </span>
        </div>
        <div className="progress-track" style={{ height: 8, marginTop: 8 }}>
          <div className="progress-fill" style={{ width: `${percentPaid}%` }} />
        </div>
      </div>
      <h4 style={{ fontSize: 14, fontWeight: 800, color: 'var(--ink)', marginBottom: 10 }}>
        Daftar Tagihan & Rekening BRIVA
      </h4>
      {!bills.length ? (
        <div className="empty-state-card" style={{ padding: 24, border: '1px solid var(--line)' }}>
          <CreditCard size={32} color="var(--muted-light)" style={{ marginBottom: 8 }} />
          <p style={{ color: 'var(--muted)', fontSize: 13 }}>
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
                        <strong style={{ color: 'var(--brand-strong)' }}>
                          {bill.amount_formatted}
                        </strong>
                      </div>
                      {bill.status === 'partial' && (
                        <div style={{ fontSize: 11, marginTop: 2 }}>
                          <span style={{ color: 'var(--success)' }}>
                            Dibayar: {bill.paid_amount_formatted}
                          </span>{' '}
                          &bull;{' '}
                          <span style={{ color: 'var(--danger)' }}>
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
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <code
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontWeight: 700,
                            color: 'var(--ink)',
                          }}
                        >
                          {bill.briva}
                        </code>
                        {bill.briva && (
                          <button
                            type="button"
                            className="copy-btn-inline"
                            onClick={() => onCopy(bill.briva, copyKey)}
                            title="Salin BRIVA"
                          >
                            {copiedKey === copyKey ? (
                              <Check size={13} color="var(--success)" />
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
