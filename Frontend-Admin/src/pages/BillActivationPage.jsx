import React from 'react';
import {
  ArrowLeft,
  BookOpen,
  ChevronRight,
  EyeOff,
  History,
  Lock,
  RotateCcw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import BillActivationForm from '../components/bills/BillActivationForm';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/common/Toast';
import { useMasterOptions } from '../hooks/useMasterOptions';

export default function BillActivationPage({
  fixedPeriod = '',
  initialProdi = '',
  initialIsActive = false,
  returnView = 'bills',
  returnParams = {},
  navigateTo,
}) {
  const { can } = useAuth();
  const { showToast } = useToast();
  const { periods, prodis } = useMasterOptions('Gagal memuat periode dan program studi.');

  const goBack = () => navigateTo(returnView, returnParams);

  if (!can('manage_billing')) {
    return (
      <div className="panel-card table-empty-container">
        <ShieldCheck size={38} className="empty-state-icon text-muted" />
        <h2 className="empty-state-title">Akses Pengelolaan Tagihan Diperlukan</h2>
        <p className="empty-state-desc">
          Akun Anda tidak memiliki hak akses (capability) untuk menjalankan aktivasi atau
          penonaktifan tagihan massal.
        </p>
        <button type="button" className="btn btn-secondary mt-3" onClick={goBack}>
          Kembali
        </button>
      </div>
    );
  }

  return (
    <div className="activation-page-container">
      {/* Top Breadcrumb & Navigation */}
      <div className="crumb-header-wrap">
        <div className="crumb-nav-row">
          <button type="button" onClick={goBack} className="crumb-nav-btn">
            {returnView === 'master' ? 'Master Periode Akademik' : 'Tagihan Mahasiswa'}
          </button>
          <ChevronRight size={14} />
          <span className="crumb-active-title">Aktivasi Tagihan Massal</span>
        </div>
        <div className="page-title-row">
          <div className="page-title-left">
            <button type="button" onClick={goBack} className="btn btn-secondary back-btn-compact">
              <ArrowLeft size={16} />
              <span>Kembali</span>
            </button>
            <div>
              <h1 className="page-title-h1">Kelola Aktivasi Tagihan Massal</h1>
              <p className="page-subtitle-p">
                Atur status operasional tagihan (aktif / nonaktif) secara massal dengan aman dan
                tercatat di audit log.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid Layout */}
      <div className="activation-page-layout">
        {/* Left Column: Form Card */}
        <section className="activation-main-card">
          <div className="activation-card-header">
            <div className="card-header-icon-box">
              <Sparkles size={20} />
            </div>
            <div>
              <h2 className="card-header-title">Formulir Perubahan Massal</h2>
              <p className="card-header-desc">
                Tentukan target periode, program studi, dan aksi yang akan dieksekusi secara instan.
              </p>
            </div>
          </div>

          <BillActivationForm
            fixedPeriod={fixedPeriod}
            initialProdi={initialProdi}
            initialIsActive={initialIsActive}
            periods={periods}
            prodis={prodis}
            presentation="page"
            onCancel={goBack}
            onApplied={(result, isActive) => {
              const count = result?.updated_count ?? 0;
              const actionText = isActive ? 'diaktifkan kembali' : 'dinonaktifkan';
              showToast(`${count} tagihan berhasil ${actionText}.`, 'success');
              goBack();
            }}
          />
        </section>

        {/* Right Column: Guidance & Policies Sidebar */}
        <aside className="activation-sidebar-col">
          {/* Card 1: System Rules & Principles */}
          <div className="sidebar-policy-card">
            <div className="policy-card-header">
              <BookOpen size={18} className="text-brand" />
              <h3>Prinsip Siklus Tagihan</h3>
            </div>
            <div className="policy-items-list">
              <div className="policy-item">
                <div className="policy-icon-pill icon-pill-yellow">
                  <EyeOff size={15} />
                </div>
                <div>
                  <strong>Pencarian Publik Tertutup</strong>
                  <p>Tagihan nonaktif tidak akan tampil di portal lookup publik mahasiswa.</p>
                </div>
              </div>

              <div className="policy-item">
                <div className="policy-icon-pill icon-pill-red">
                  <Lock size={15} />
                </div>
                <div>
                  <strong>Pembayaran Baru Ditolak</strong>
                  <p>
                    Kasir pembayaran akan menolak transaksi baru untuk tagihan yang dinonaktifkan.
                  </p>
                </div>
              </div>

              <div className="policy-item">
                <div className="policy-icon-pill icon-pill-green">
                  <History size={15} />
                </div>
                <div>
                  <strong>Histori Keuangan Utuh</strong>
                  <p>
                    Rekapitulasi Keuangan dan riwayat pembayaran tetap tersimpan tanpa data hilang.
                  </p>
                </div>
              </div>

              <div className="policy-item">
                <div className="policy-icon-pill icon-pill-blue">
                  <RotateCcw size={15} />
                </div>
                <div>
                  <strong>Dapat Diaktifkan Kembali</strong>
                  <p>Status tagihan dapat dipulihkan ke aktif kapan saja melalui halaman ini.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Security & Audit Guarantee */}
          <div className="sidebar-safety-badge-card">
            <div className="safety-badge-header">
              <ShieldCheck size={18} className="text-success" />
              <strong>Jaminan Keamanan Sistem</strong>
            </div>
            <p className="safety-badge-desc">
              Seluruh perubahan dieksekusi dalam satu transaksi atomik database dan mencatat nama
              akun serta alasan Anda ke dalam audit log resmi.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

BillActivationPage.displayName = 'BillActivationPage';
