import React from 'react';
import { CheckCircle2, ArrowRight, PowerOff } from 'lucide-react';

/**
 * Step 3 UploadPage: success state dengan 4 metric card dan navigation buttons.
 * Props: commitResult, onReset, onNavigate
 */
export default function UploadStep3({ commitResult, onReset, onNavigate, onManageBills }) {
  const metrics = [
    { label: 'Data Baru', value: commitResult?.created || 0, textClass: 'text-brand' },
    { label: 'Data Diperbarui', value: commitResult?.updated || 0, textClass: 'text-accent' },
    { label: 'Tidak Berubah', value: commitResult?.unchanged || 0, textClass: 'text-muted' },
    { label: 'Baris Dikarantina', value: commitResult?.quarantined || 0, textClass: 'text-danger' },
  ];

  return (
    <div className="panel-card upload-success-panel">
      <CheckCircle2 size={54} className="text-success upload-success-icon" />
      <h3 className="upload-success-title">
        {commitResult?.status === 'issues_only'
          ? 'Masalah Import Tersimpan'
          : 'Import Data Berhasil!'}
      </h3>
      <p className="upload-success-desc">
        Batch {commitResult?.batch_id || '-'} untuk periode{' '}
        <strong>{commitResult?.period?.label || commitResult?.period?.code || '-'}</strong> telah
        disimpan. Baris bermasalah tetap tercatat tanpa membentuk tagihan yang tidak aman.
      </p>

      <div className="upload-metrics-cards-grid">
        {metrics.map((m) => (
          <div key={m.label} className="upload-metric-cell">
            <span className="upload-metric-label">{m.label}</span>
            <div className={`upload-metric-val ${m.textClass}`}>{m.value}</div>
          </div>
        ))}
      </div>

      <div className="modal-alert-warning mb-3">
        <PowerOff size={18} />
        <span>
          Import tidak menonaktifkan tagihan lama secara otomatis. Tinjau tagihan periode lama jika
          semester baru sudah diterbitkan.
        </span>
      </div>

      <div className="upload-buttons-center">
        <button type="button" className="btn btn-secondary" onClick={onReset}>
          Import File Lain
        </button>
        <button type="button" className="btn btn-secondary" onClick={onManageBills}>
          <PowerOff size={16} />
          <span>Kelola Tagihan Lama</span>
        </button>
        <button type="button" className="btn btn-primary" onClick={onNavigate}>
          <span>Lihat Data Mahasiswa</span>
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}

UploadStep3.displayName = 'UploadStep3';
