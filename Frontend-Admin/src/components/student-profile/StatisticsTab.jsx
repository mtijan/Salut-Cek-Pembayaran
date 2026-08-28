import React from 'react';

export function StatisticsTab({ percentPaid, summary, totalOutstanding }) {
  return (
    <div className="profile-tab-pane">
      <div className="mb-4">
        <h3 className="panel-header-title">Ringkasan Statistik Keuangan</h3>
        <p className="panel-header-desc">
          Akumulasi tagihan dan progres penyelesaian kewajiban mahasiswa
        </p>
      </div>
      <div className="kpi-cards-grid">
        <div className="kpi-card">
          <span className="kpi-label">Total Tagihan Terbit</span>
          <span className="kpi-value text-brand-strong">
            {summary.total_amount_formatted || 'Rp 0'}
          </span>
          <span className="kpi-sub">Dari {summary.total_bills || 0} tagihan terdaftar</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">Total Sudah Terbayar</span>
          <span className="kpi-value text-success">{summary.total_paid_formatted || 'Rp 0'}</span>
          <span className="kpi-sub">{percentPaid}% dari total kewajiban</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">Sisa Tunggakan (Outstanding)</span>
          <span className={`kpi-value ${totalOutstanding > 0 ? 'text-danger' : 'text-success'}`}>
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
      <div className="panel-card stats-card-bg">
        <h4 className="card-sub-title mb-3">Progres Pelunasan Tagihan</h4>
        <div className="fin-progress-bar">
          <progress
            className={`fin-progress-semantic-lg ${percentPaid === 100 ? 'success' : ''}`}
            value={percentPaid}
            max={100}
            aria-label={`Progres pelunasan ${percentPaid}%`}
          />
        </div>
        <div className="stats-progress-labels">
          <span className="text-muted">0%</span>
          <span className="text-brand-strong">{percentPaid}% Selesai</span>
          <span className="text-muted">100%</span>
        </div>
        <div className="stats-aggregate-footer">
          <span className="panel-header-desc">Status Pembayaran Agregat:</span>
          <span
            className={`badge badge-aggregate-status ${summary.overall_status === 'paid' ? 'badge-success' : summary.overall_status === 'partial' ? 'badge-warning' : 'badge-danger'}`}
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

StatisticsTab.displayName = 'StatisticsTab';
