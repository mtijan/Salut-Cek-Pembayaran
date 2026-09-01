import React from 'react';
import { ArrowLeft, ChevronRight, ShieldCheck } from 'lucide-react';
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
        <ShieldCheck size={38} className="empty-state-icon" />
        <h2 className="empty-state-title">Akses pengelolaan tagihan diperlukan</h2>
        <p className="empty-state-desc">
          Akun Anda tidak memiliki capability untuk menjalankan aktivasi massal.
        </p>
        <button type="button" className="btn btn-secondary" onClick={goBack}>
          Kembali
        </button>
      </div>
    );
  }

  return (
    <div className="activation-page-container">
      <div className="crumb-header-wrap">
        <div className="crumb-nav-row">
          <button type="button" onClick={goBack} className="crumb-nav-btn">
            {returnView === 'master' ? 'Master Periode Akademik' : 'Tagihan Mahasiswa'}
          </button>
          <ChevronRight size={14} />
          <span className="crumb-active-title">Kelola Aktivasi Massal</span>
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
                Preview dan konfirmasi perubahan tagihan berdasarkan periode serta program studi.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="activation-page-layout">
        <section className="panel-card activation-page-main-card">
          <div className="activation-page-section-heading">
            <div>
              <h2>Ruang Lingkup Aktivasi</h2>
              <p>Informasi lengkap tetap terlihat dan tidak dipadatkan ke dalam modal.</p>
            </div>
          </div>
          <BillActivationForm
            fixedPeriod={fixedPeriod}
            initialProdi={initialProdi}
            initialIsActive={initialIsActive}
            periods={periods}
            prodis={prodis}
            requireProdi={returnView === 'bills'}
            presentation="page"
            onCancel={goBack}
            onApplied={(result) => {
              showToast(
                `${result.updated_count || 0} tagihan berhasil diperbarui status aktivasinya.`,
                'success',
              );
            }}
          />
        </section>

        <aside className="activation-page-guidance panel-card">
          <h2>Panduan Aman</h2>
          <ol>
            <li>Pilih periode lama dan program studi yang tepat.</li>
            <li>
              Gunakan mode tagihan pengganti agar mahasiswa tanpa tagihan baru tidak kehilangan
              akses tagihan lama.
            </li>
            <li>Periksa jumlah mahasiswa, tagihan, status, dan nominal pada preview.</li>
            <li>Masukkan alasan operasional yang dapat dipahami saat audit.</li>
          </ol>
          <div className="activation-page-history-note">
            Status nonaktif tidak menghapus tagihan dan tidak membatalkan piutang. Rekapitulasi
            Keuangan tetap menyimpan histori seluruh tagihan yang belum dihapus.
          </div>
        </aside>
      </div>
    </div>
  );
}

BillActivationPage.displayName = 'BillActivationPage';
