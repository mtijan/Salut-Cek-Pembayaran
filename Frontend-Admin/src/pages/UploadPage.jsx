import React, { useState } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  ArrowRight,
  RefreshCw,
  FileCheck,
} from 'lucide-react';
import { importApi } from '../services/api';
import { useToast } from '../components/common/Toast';
import { useAuth } from '../context/AuthContext';

export default function UploadPage({ setActiveView }) {
  const { showToast } = useToast();
  const { isViewer } = useAuth();

  const [step, setStep] = useState(1); // 1: Choose, 2: Preview, 3: Success
  const [file, setFile] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [committing, setCommitting] = useState(false);

  // Preview result
  const [previewData, setPreviewData] = useState(null);
  const [confirmSensitive, setConfirmSensitive] = useState(false);
  const [commitResult, setCommitResult] = useState(null);

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    if (selected) {
      if (!selected.name.endsWith('.xlsx')) {
        showToast('Hanya file format .xlsx yang didukung.', 'error');
        return;
      }
      setFile(selected);
    }
  };

  const handleAnalyze = async () => {
    if (!file) {
      showToast('Pilih file Excel terlebih dahulu.', 'error');
      return;
    }
    setAnalyzing(true);
    try {
      const res = await importApi.preview(file);
      setPreviewData(res);
      setConfirmSensitive(false);
      setStep(2);
    } catch (err) {
      showToast(err.message || 'Gagal memproses preview file.', 'error');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleCommit = async () => {
    if (!previewData?.token) return;
    setCommitting(true);
    try {
      const res = await importApi.commit(previewData.token);
      setCommitResult(res);
      setStep(3);
      showToast('Data tagihan berhasil diimpor ke database.');
    } catch (err) {
      showToast(err.message || 'Gagal menyimpan data import.', 'error');
    } finally {
      setCommitting(false);
    }
  };

  const handleReset = () => {
    setStep(1);
    setFile(null);
    setPreviewData(null);
    setCommitResult(null);
    setConfirmSensitive(false);
  };

  if (isViewer) {
    return (
      <div className="panel-card" style={{ textAlign: 'center', padding: 40 }}>
        <AlertCircle size={32} color="var(--muted)" style={{ margin: '0 auto 12px' }} />
        <h3 style={{ fontSize: 16, color: 'var(--ink)' }}>Akses Terbatas</h3>
        <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>
          Role Viewer hanya memiliki hak baca dan tidak diizinkan mengimpor file data.
        </p>
      </div>
    );
  }

  const s = previewData?.summary;
  const critical = s?.critical_rows > 0;
  const hasSensitive = (s?.sensitive_changes || 0) > 0;
  const canCommit = !critical && (!hasSensitive || confirmSensitive);

  return (
    <div>
      {/* Wizard Steps Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 24,
          marginBottom: 24,
          padding: '16px 20px',
          background: '#ffffff',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--line)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: step >= 1 ? 'var(--brand)' : 'var(--muted)' }}>
          <span style={{ width: 26, height: 26, borderRadius: '50%', background: step >= 1 ? 'var(--brand)' : '#e2e8f0', color: step >= 1 ? '#fff' : 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12 }}>
            1
          </span>
          <strong style={{ fontSize: 13 }}>Pilih File</strong>
        </div>

        <div style={{ width: 40, height: 2, background: step >= 2 ? 'var(--brand)' : '#e2e8f0' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: step >= 2 ? 'var(--brand)' : 'var(--muted)' }}>
          <span style={{ width: 26, height: 26, borderRadius: '50%', background: step >= 2 ? 'var(--brand)' : '#e2e8f0', color: step >= 2 ? '#fff' : 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12 }}>
            2
          </span>
          <strong style={{ fontSize: 13 }}>Preview & Validasi</strong>
        </div>

        <div style={{ width: 40, height: 2, background: step >= 3 ? 'var(--brand)' : '#e2e8f0' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: step >= 3 ? 'var(--brand)' : 'var(--muted)' }}>
          <span style={{ width: 26, height: 26, borderRadius: '50%', background: step >= 3 ? 'var(--brand)' : '#e2e8f0', color: step >= 3 ? '#fff' : 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12 }}>
            3
          </span>
          <strong style={{ fontSize: 13 }}>Selesai</strong>
        </div>
      </div>

      {/* STEP 1: CHOOSE FILE */}
      {step === 1 && (
        <div className="panel-card">
          <div style={{ textAlign: 'center', padding: '32px 20px', border: '2px dashed var(--line-strong)', borderRadius: 'var(--radius-lg)', background: '#f8fafc' }}>
            <UploadCloud size={48} color="var(--brand)" style={{ margin: '0 auto 16px' }} />
            <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--brand-strong)' }}>
              Unggah File Tagihan (.xlsx)
            </h3>
            <p style={{ fontSize: 13, color: 'var(--muted)', maxWidth: 460, margin: '6px auto 20px' }}>
              Mendukung template format legacy (sheet Data Sinkron) maupun format terbaru (kolom NIM, Nama, No Rek, Jumlah).
            </p>

            <input
              type="file"
              id="file-upload"
              accept=".xlsx"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />

            <label htmlFor="file-upload" className="btn btn-primary" style={{ cursor: 'pointer' }}>
              <FileSpreadsheet size={16} />
              <span>{file ? file.name : 'Pilih File Excel'}</span>
            </label>

            {file && (
              <div style={{ marginTop: 20 }}>
                <p style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 600 }}>
                  File Terpilih: <strong>{file.name}</strong> ({(file.size / 1024).toFixed(1)} KB)
                </p>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ marginTop: 12 }}
                  onClick={handleAnalyze}
                  disabled={analyzing}
                >
                  <RefreshCw size={14} className={analyzing ? 'spin' : ''} />
                  <span>{analyzing ? 'Menganalisis Format & Data...' : 'Periksa & Analisis File'}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* STEP 2: PREVIEW & VALIDATION */}
      {step === 2 && previewData && (
        <div>
          <div className="stats-grid">
            <div className="stat-card">
              <span className="stat-card-title">Baris Valid</span>
              <div className="stat-card-value" style={{ color: 'var(--success)' }}>
                {s?.valid_rows || 0}
              </div>
              <span className="stat-card-subtext">Dari {s?.total_rows || 0} total baris</span>
            </div>

            <div className="stat-card">
              <span className="stat-card-title">Tagihan Baru</span>
              <div className="stat-card-value" style={{ color: 'var(--brand)' }}>
                {s?.new_bills || 0}
              </div>
              <span className="stat-card-subtext">Akan ditambahkan ke sistem</span>
            </div>

            <div className="stat-card">
              <span className="stat-card-title">Perubahan Tagihan</span>
              <div className="stat-card-value" style={{ color: 'var(--accent)' }}>
                {s?.updated_bills || 0}
              </div>
              <span className="stat-card-subtext">{s?.sensitive_changes || 0} nominal/BRIVA berubah</span>
            </div>

            <div className="stat-card">
              <span className="stat-card-title">Baris Kritis</span>
              <div className="stat-card-value" style={{ color: critical ? 'var(--danger)' : 'var(--muted)' }}>
                {s?.critical_rows || 0}
              </div>
              <span className="stat-card-subtext">{critical ? 'Commit ditolak' : 'Tidak ada anomali'}</span>
            </div>
          </div>

          {critical && (
            <div style={{ padding: 16, background: 'var(--danger-bg)', border: '1px solid #fca5a5', borderRadius: 'var(--radius-md)', marginBottom: 20, color: 'var(--danger)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertCircle size={20} />
                <strong>File memiliki error kritis. Mohon perbaiki file Excel Anda sebelum melanjutkan.</strong>
              </div>
            </div>
          )}

          {hasSensitive && !critical && (
            <div style={{ padding: 16, background: 'var(--warning-bg)', border: '1px solid #fcd34d', borderRadius: 'var(--radius-md)', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#92400e', marginBottom: 8 }}>
                <AlertTriangle size={20} />
                <strong>Persetujuan Perubahan Data Sensitif Diperlukan</strong>
              </div>
              <p style={{ fontSize: 13, color: '#78350f', marginBottom: 12 }}>
                Ditemukan {s?.sensitive_changes} tagihan yang mengalami perubahan nominal atau nomor BRIVA dari data sebelumnya.
              </p>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={confirmSensitive}
                  onChange={(e) => setConfirmSensitive(e.target.checked)}
                />
                <span>Saya menyetujui pembaruan nominal / nomor BRIVA tagihan di atas.</span>
              </label>
            </div>
          )}

          <div className="panel-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button type="button" className="btn btn-secondary" onClick={handleReset} disabled={committing}>
              Batal & Ganti File
            </button>

            <button
              type="button"
              className="btn btn-primary"
              onClick={handleCommit}
              disabled={!canCommit || committing}
            >
              <FileCheck size={16} />
              <span>{committing ? 'Menyimpan ke Database...' : 'Simpan & Terapkan Data Tagihan'}</span>
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: SUCCESS */}
      {step === 3 && (
        <div className="panel-card" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <CheckCircle2 size={54} color="var(--success)" style={{ margin: '0 auto 16px' }} />
          <h3 style={{ fontSize: 20, fontWeight: 800, color: 'var(--brand-strong)' }}>
            Import Data Berhasil!
          </h3>
          <p style={{ fontSize: 13, color: 'var(--muted)', maxWidth: 480, margin: '8px auto 24px' }}>
            Data tagihan dari file Excel telah berhasil diverifikasi dan disimpan secara permanen ke dalam database.
          </p>

          <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
            <button type="button" className="btn btn-secondary" onClick={handleReset}>
              Import File Lain
            </button>
            <button type="button" className="btn btn-primary" onClick={() => setActiveView('bills')}>
              <span>Lihat Daftar Tagihan</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
