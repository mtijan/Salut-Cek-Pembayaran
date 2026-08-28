import React, { useState, useEffect } from 'react';
import {
  Users,
  Receipt,
  TrendingUp,
  AlertCircle,
  UploadCloud,
  FileSpreadsheet,
  RefreshCw,
} from 'lucide-react';
import { dashboardApi } from '../services/api';
import { useToast } from '../components/common/Toast';

export default function DashboardPage({ setActiveView }) {
  const { showToast } = useToast();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const data = await dashboardApi.getStats();
      setStats(data);
    } catch (err) {
      showToast(err.message || 'Gagal memuat statistik dashboard.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  return (
    <div>
      <div className="dashboard-header-row">
        <div>
          <h2 className="dashboard-title">Ringkasan Operasional &amp; Keuangan</h2>
          <p className="dashboard-subtitle">Metrik agregat semester aktif SALUT Awwabin</p>
        </div>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={fetchStats}
          disabled={loading}
        >
          <RefreshCw size={14} className={loading ? 'spin' : ''} />
          <span>Muat Ulang</span>
        </button>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-title">Total Mahasiswa</span>
            <Users size={20} className="text-brand" />
          </div>
          <div className="stat-card-value">
            {stats ? stats.total_students.toLocaleString('id-ID') : '-'}
          </div>
          <div className="stat-card-subtext">
            <strong>{stats ? stats.active_students.toLocaleString('id-ID') : '-'}</strong> Mahasiswa
            Aktif
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-title">Total Tagihan</span>
            <Receipt size={20} className="text-accent" />
          </div>
          <div className="stat-card-value">
            {stats ? stats.total_bills.toLocaleString('id-ID') : '-'}
          </div>
          <div className="stat-card-subtext">
            <span className="text-success">{stats ? stats.paid_bills : '-'} Lunas</span> |{' '}
            <span className="text-danger">{stats ? stats.unpaid_bills : '-'} Belum</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-title">Realisasi Penerimaan</span>
            <TrendingUp size={20} className="text-success" />
          </div>
          <div className="stat-card-value text-success">
            {stats ? stats.total_paid_amount_formatted : '-'}
          </div>
          <div className="stat-card-subtext">
            Dari total {stats ? stats.total_billed_amount_formatted : '-'}
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-title">Sisa Piutang / Tunggakan</span>
            <AlertCircle size={20} className="text-danger" />
          </div>
          <div className="stat-card-value text-danger">
            {stats ? stats.total_outstanding_amount_formatted : '-'}
          </div>
          <div className="stat-card-subtext">
            {stats ? `${stats.payment_rate_percentage}% Realisasi Pelunasan` : '-'}
          </div>
        </div>
      </div>

      {/* Progress Bar Section */}
      <div className="progress-card">
        <div className="progress-header-row">
          <div>
            <strong className="progress-title">Persentase Realisasi Pembayaran</strong>
            <p className="progress-desc">
              Perbandingan tagihan yang telah diselesaikan terhadap total piutang berjalan
            </p>
          </div>
          <span className="progress-percent-label">
            {stats ? `${stats.payment_rate_percentage}%` : '0%'}
          </span>
        </div>
        <div className="progress-track">
          <progress
            className="fin-progress-semantic-lg"
            value={Math.min(100, Math.max(0, stats?.payment_rate_percentage || 0))}
            max={100}
            aria-label={`Realisasi pembayaran ${stats?.payment_rate_percentage || 0}%`}
          />
        </div>
      </div>

      {/* Quick Action Shortcuts */}
      <div className="panel-card mt-4">
        <h3 className="panel-header-title mb-3">Tindakan &amp; Navigasi Cepat</h3>
        <div className="quick-action-grid">
          <button
            type="button"
            className="quick-action-button"
            onClick={() => setActiveView('students')}
          >
            <Users size={22} className="text-brand" />
            <strong>Kelola Data Mahasiswa</strong>
            <span>Profil 360, status akademik &amp; angkatan</span>
          </button>

          <button
            type="button"
            className="quick-action-button"
            onClick={() => setActiveView('bills')}
          >
            <Receipt size={22} className="text-accent" />
            <strong>Kelola Tagihan</strong>
            <span>Status pembayaran, batas aktif &amp; BRIVA</span>
          </button>

          <button
            type="button"
            className="quick-action-button"
            onClick={() => setActiveView('reports')}
          >
            <FileSpreadsheet size={22} className="text-success" />
            <strong>Rekap Keuangan</strong>
            <span>Evaluasi penerimaan per Program Studi</span>
          </button>

          <button
            type="button"
            className="quick-action-button"
            onClick={() => setActiveView('upload')}
          >
            <UploadCloud size={22} className="text-info" />
            <strong>Upload Tagihan Baru</strong>
            <span>Import file XLSX dengan validasi otomatis</span>
          </button>
        </div>
      </div>
    </div>
  );
}

DashboardPage.displayName = 'DashboardPage';
