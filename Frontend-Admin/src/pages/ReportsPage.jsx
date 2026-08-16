import React, { useState, useEffect } from 'react';
import { Download, RefreshCw, FileSpreadsheet, TrendingUp, AlertCircle, CheckCircle2 } from 'lucide-react';
import { reportsApi } from '../services/api';
import { useToast } from '../components/common/Toast';

export default function ReportsPage() {
  const { showToast } = useToast();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const data = await reportsApi.getFinancialSummary();
      setReport(data);
    } catch (err) {
      showToast(err.message || 'Gagal memuat rekapitulasi keuangan.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, []);

  const handleExportCSV = () => {
    if (!report?.by_study_program?.length) return;

    const headers = ['Program Studi', 'Jml Mahasiswa', 'Jml Tagihan', 'Total Terbit (Rp)', 'Total Lunas (Rp)', 'Sisa Piutang (Rp)', 'Realisasi (%)'];
    const rows = report.by_study_program.map((p) => [
      `"${p.program_study || '-'}"`,
      p.total_students,
      p.total_bills,
      p.billed_amount,
      p.paid_amount,
      p.outstanding_amount,
      `"${p.percentage_paid}%"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Rekap_Keuangan_SALUT_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Rekap keuangan berhasil diekspor ke CSV.');
  };

  const totals = report?.totals;
  const prodis = report?.by_study_program || [];

  return (
    <div>
      {/* Summary Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-title">Total Tagihan Terbit</span>
            <FileSpreadsheet size={20} color="var(--brand)" />
          </div>
          <div className="stat-card-value">{totals?.billed_amount_formatted || '-'}</div>
          <div className="stat-card-subtext">Akumulasi seluruh program studi</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-title">Penerimaan / Lunas</span>
            <CheckCircle2 size={20} color="var(--success)" />
          </div>
          <div className="stat-card-value" style={{ color: 'var(--success)' }}>
            {totals?.paid_amount_formatted || '-'}
          </div>
          <div className="stat-card-subtext">Total pembayaran diterima</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-title">Sisa Piutang / Tunggakan</span>
            <AlertCircle size={20} color="var(--danger)" />
          </div>
          <div className="stat-card-value" style={{ color: 'var(--danger)' }}>
            {totals?.outstanding_amount_formatted || '-'}
          </div>
          <div className="stat-card-subtext">Sisa tagihan belum lunas</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-title">Tingkat Realisasi</span>
            <TrendingUp size={20} color="var(--accent)" />
          </div>
          <div className="stat-card-value" style={{ color: 'var(--accent)' }}>
            {totals ? `${totals.percentage_paid}%` : '-'}
          </div>
          <div className="stat-card-subtext">Persentase pelunasan berjalan</div>
        </div>
      </div>

      {/* Main Table */}
      <div className="panel-card">
        <div className="toolbar-row">
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--ink)' }}>
              Rekapitulasi Keuangan per Program Studi
            </h3>
            <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
              Rincian nominal penerimaan dan piutang terbagi per jurusan/program studi
            </p>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={fetchReport}
              disabled={loading}
            >
              <RefreshCw size={14} className={loading ? 'spin' : ''} />
              <span>Muat Ulang</span>
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleExportCSV}
              disabled={loading || !prodis.length}
            >
              <Download size={14} />
              <span>Ekspor ke CSV</span>
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
            <span>Menghitung rekapitulasi keuangan...</span>
          </div>
        ) : !prodis.length ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
            <p>Belum ada data tagihan untuk direkap.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Program Studi</th>
                  <th style={{ textAlign: 'right' }}>Mahasiswa</th>
                  <th style={{ textAlign: 'right' }}>Tagihan</th>
                  <th style={{ textAlign: 'right' }}>Total Terbit</th>
                  <th style={{ textAlign: 'right' }}>Total Lunas</th>
                  <th style={{ textAlign: 'right' }}>Sisa Piutang</th>
                  <th style={{ textAlign: 'right' }}>Realisasi</th>
                </tr>
              </thead>
              <tbody>
                {prodis.map((p, idx) => (
                  <tr key={idx}>
                    <td><strong>{p.program_study}</strong></td>
                    <td style={{ textAlign: 'right' }}>{p.total_students}</td>
                    <td style={{ textAlign: 'right' }}>{p.total_bills}</td>
                    <td style={{ textAlign: 'right' }}>{p.billed_amount_formatted}</td>
                    <td style={{ textAlign: 'right', color: 'var(--success)' }}><strong>{p.paid_amount_formatted}</strong></td>
                    <td style={{ textAlign: 'right', color: 'var(--danger)' }}><strong>{p.outstanding_amount_formatted}</strong></td>
                    <td style={{ textAlign: 'right' }}>
                      <span className={`badge ${p.percentage_paid >= 80 ? 'badge-success' : p.percentage_paid >= 40 ? 'badge-warning' : 'badge-danger'}`}>
                        {p.percentage_paid}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
