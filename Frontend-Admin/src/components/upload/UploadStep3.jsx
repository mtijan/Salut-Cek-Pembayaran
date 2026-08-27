import React from 'react';
import { CheckCircle2, ArrowRight } from 'lucide-react';

/**
 * Step 3 UploadPage: success state dengan 4 metric card dan navigation buttons.
 * Props: commitResult, onReset, onNavigate
 */
export default function UploadStep3({ commitResult, onReset, onNavigate }) {
  const metrics = [
    { label: 'Data Baru', value: commitResult?.created || 0, color: 'var(--brand)' },
    { label: 'Data Diperbarui', value: commitResult?.updated || 0, color: 'var(--accent)' },
    { label: 'Tidak Berubah', value: commitResult?.unchanged || 0, color: 'var(--muted)' },
    { label: 'Catatan / Warning', value: commitResult?.issues || 0, color: '#ca8a04' },
  ];

  return (
    <div className="panel-card upload-success-panel">
      <CheckCircle2 size={54} color="var(--success)" style={{ margin: '0 auto 16px' }} />
      <h3 style={{ fontSize: 20, fontWeight: 800, color: 'var(--brand-strong)' }}>
        Import Data Berhasil!
      </h3>
      <p style={{ fontSize: 13, color: 'var(--muted)', maxWidth: 480, margin: '8px auto 20px' }}>
        Data mahasiswa dan tagihan dari file Excel telah berhasil diverifikasi dan disimpan secara
        permanen ke dalam database.
      </p>

      <div className="upload-metrics-cards-grid">
        {metrics.map((m) => (
          <div key={m.label} className="upload-metric-cell">
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--muted)',
                textTransform: 'uppercase',
              }}
            >
              {m.label}
            </span>
            <div style={{ fontSize: 18, fontWeight: 800, color: m.color, marginTop: 4 }}>
              {m.value}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
        <button type="button" className="btn btn-secondary" onClick={onReset}>
          Import File Lain
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
