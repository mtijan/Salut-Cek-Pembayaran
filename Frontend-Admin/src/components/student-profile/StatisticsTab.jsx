import React from 'react';

export function StatisticsTab({ percentPaid, summary, totalOutstanding }) {
  return (
    <div className="profile-tab-pane">
      <div style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700 }}>Ringkasan Statistik Keuangan</h3>
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>
          Akumulasi tagihan dan progres penyelesaian kewajiban mahasiswa
        </p>
      </div>
      <div className="kpi-cards-grid">
        <div className="kpi-card">
          <span className="kpi-label">Total Tagihan Terbit</span>
          <span className="kpi-value" style={{ color: 'var(--brand-strong)' }}>
            {summary.total_amount_formatted || 'Rp 0'}
          </span>
          <span className="kpi-sub">Dari {summary.total_bills || 0} tagihan terdaftar</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">Total Sudah Terbayar</span>
          <span className="kpi-value" style={{ color: 'var(--success)' }}>
            {summary.total_paid_formatted || 'Rp 0'}
          </span>
          <span className="kpi-sub">{percentPaid}% dari total kewajiban</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">Sisa Tunggakan (Outstanding)</span>
          <span
            className="kpi-value"
            style={{ color: totalOutstanding > 0 ? 'var(--danger)' : 'var(--success)' }}
          >
            {summary.total_outstanding_formatted || 'Rp 0'}
          </span>
          <span className="kpi-sub">
            {totalOutstanding > 0 ? 'Belum diselesaikan' : 'Lunas sepenuhnya'}
          </span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">Jumlah Tagihan</span>
          <span className="kpi-value">{summary.total_bills || 0}</span>
          <span className="kpi-sub">Kewajiban aktif</span>
        </div>
      </div>
      <div className="panel-card" style={{ marginTop: 24, padding: 20, background: '#f8fafc' }}>
        <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>
          Progres Pelunasan Tagihan
        </h4>
        <div className="fin-progress-bar" style={{ height: 12, borderRadius: 6 }}>
          <div
            className="fin-progress-fill"
            style={{
              width: `${percentPaid}%`,
              background:
                percentPaid === 100
                  ? 'var(--success)'
                  : 'linear-gradient(90deg, var(--brand) 0%, #10b981 100%)',
            }}
          />
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: 8,
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          <span style={{ color: 'var(--muted)' }}>0%</span>
          <span style={{ color: 'var(--brand-strong)' }}>{percentPaid}% Selesai</span>
          <span style={{ color: 'var(--muted)' }}>100%</span>
        </div>
        <div
          style={{
            marginTop: 16,
            paddingTop: 14,
            borderTop: '1px solid var(--line)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>Status Pembayaran Agregat:</span>
          <span
            className={`badge ${summary.overall_status === 'paid' ? 'badge-success' : summary.overall_status === 'partial' ? 'badge-warning' : 'badge-danger'}`}
            style={{ padding: '6px 14px', fontSize: 13 }}
          >
            Status Keseluruhan:{' '}
            {summary.overall_status === 'paid'
              ? 'LUNAS'
              : summary.overall_status === 'partial'
                ? 'BAYAR SEBAGIAN'
                : 'BELUM LUNAS'}
          </span>
        </div>
      </div>
    </div>
  );
}
