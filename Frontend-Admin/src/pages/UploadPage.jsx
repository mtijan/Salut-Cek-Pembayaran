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
  Download,
} from 'lucide-react';
import { importApi, templateApi } from '../services/api';
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
    const token = previewData?.import_token || previewData?.token;
    if (!token) {
      showToast('Token preview tidak ditemukan.', 'error');
      return;
    }
    setCommitting(true);
    try {
      const res = await importApi.commit(token, confirmSensitive);
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

  const s = previewData || {};
  const critical = (s.critical_rows || 0) > 0;
  const hasSensitive = Boolean(s.requires_update_confirmation || (s.amount_change_rows || 0) > 0 || (s.briva_change_rows || 0) > 0);
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--brand-strong)', margin: 0 }}>
                Impor Data Mahasiswa & Tagihan
              </h3>
              <p style={{ fontSize: 13, color: 'var(--muted)', margin: '4px 0 0' }}>
                Upload file Master Data 13 kolom resmi atau data tagihan Excel (.xlsx).
              </p>
            </div>
            <a
              href={templateApi.downloadMasterDataUrl()}
              className="btn btn-secondary"
              download="Template_Master_Data_Mahasiswa.xlsx"
            >
              <Download size={15} />
              <span>Unduh Template Master Data (.xlsx)</span>
            </a>
          </div>

          <div style={{ textAlign: 'center', padding: '36px 20px', border: '2px dashed var(--line-strong)', borderRadius: 'var(--radius-lg)', background: '#f8fafc' }}>
            <UploadCloud size={48} color="var(--brand)" style={{ margin: '0 auto 16px' }} />
            <h4 style={{ fontSize: 16, fontWeight: 800, color: 'var(--brand-strong)' }}>
              Tarik atau Pilih File Excel (.xlsx)
            </h4>
            <p style={{ fontSize: 13, color: 'var(--muted)', maxWidth: 520, margin: '6px auto 20px' }}>
              Mendukung Master Data 13 kolom (<code>NIM</code>, <code>Nama</code>, <code>NO KTP</code>, <code>Tempat/Tgl Lahir</code>, <code>Nama Ibu Kandung</code>, <code>e-Mail</code>, <code>No Kontak</code>, <code>Registrasi Awal</code>, <code>Program Studi</code>, <code>No Rek</code>, <code>Jumlah</code>, <code>Batas Pembayaran</code>).
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
                {s.valid_rows || 0}
              </div>
              <span className="stat-card-subtext">Dari file {s.file_name}</span>
            </div>

            <div className="stat-card">
              <span className="stat-card-title">Tagihan Baru</span>
              <div className="stat-card-value" style={{ color: 'var(--brand)' }}>
                {s.new_rows ?? 0}
              </div>
              <span className="stat-card-subtext">Akan ditambahkan ke sistem</span>
            </div>

            <div className="stat-card">
              <span className="stat-card-title">Tagihan Diperbarui</span>
              <div className="stat-card-value" style={{ color: 'var(--accent)' }}>
                {s.update_rows ?? 0}
              </div>
              <span className="stat-card-subtext">
                {s.amount_change_rows || 0} nominal / {s.briva_change_rows || 0} BRIVA berubah
              </span>
            </div>

            <div className="stat-card">
              <span className="stat-card-title">Baris Kritis</span>
              <div className="stat-card-value" style={{ color: critical ? 'var(--danger)' : 'var(--muted)' }}>
                {s.critical_rows || 0}
              </div>
              <span className="stat-card-subtext">{critical ? 'Commit ditolak' : 'Tidak ada konflik kritis'}</span>
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
                Ditemukan {s.amount_change_rows || 0} perubahan nominal dan {s.briva_change_rows || 0} perubahan nomor BRIVA dari data sebelumnya.
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

          {/* Sample Data Table */}
          {s.sample && s.sample.length > 0 && (
            <div className="panel-card" style={{ marginBottom: 20 }}>
              <h4 style={{ fontSize: 14, fontWeight: 800, color: 'var(--brand-strong)', marginBottom: 12 }}>
                Sampel Data Terbaca (5 Baris Pertama)
              </h4>
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>NIM</th>
                      <th>Nama Mahasiswa</th>
                      <th>Program Studi</th>
                      <th>Nominal Tagihan</th>
                      <th>No Rek / BRIVA</th>
                      <th>Batas Pembayaran</th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.sample.map((row, i) => (
                      <tr key={i}>
                        <td><strong>{row.nim}</strong></td>
                        <td>{row.full_name}</td>
                        <td>{row.program_study || '-'}</td>
                        <td><strong>Rp {Number(row.amount || 0).toLocaleString('id-ID')}</strong></td>
                        <td><code style={{ fontFamily: 'var(--font-mono)' }}>{row.briva}</code></td>
                        <td>{row.due_date || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Warnings and Issues List */}
          {s.errors && s.errors.length > 0 && (
            <div className="panel-card" style={{ marginBottom: 20 }}>
              <h4 style={{ fontSize: 14, fontWeight: 800, color: 'var(--ink)', marginBottom: 12 }}>
                Pemberitahuan & Catatan Validasi ({s.errors.length})
              </h4>
              <div style={{ maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {s.errors.map((err, i) => (
                  <div
                    key={i}
                    style={{
                      padding: '8px 12px',
                      background: err.severity === 'critical' ? 'var(--danger-bg)' : '#fef9c3',
                      borderLeft: `4px solid ${err.severity === 'critical' ? 'var(--danger)' : '#eab308'}`,
                      borderRadius: 4,
                      fontSize: 12,
                      display: 'flex',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span><strong>Baris {err.row_number}:</strong> {err.message}</span>
                    <span style={{ fontWeight: 700, textTransform: 'uppercase', fontSize: 10, color: err.severity === 'critical' ? 'var(--danger)' : '#854d0e' }}>
                      {err.severity}
                    </span>
                  </div>
                ))}
              </div>
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
          <p style={{ fontSize: 13, color: 'var(--muted)', maxWidth: 480, margin: '8px auto 20px' }}>
            Data mahasiswa dan tagihan dari file Excel telah berhasil diverifikasi dan disimpan secara permanen ke dalam database.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, maxWidth: 600, margin: '0 auto 28px' }}>
            <div style={{ padding: 12, background: '#f8fafc', border: '1px solid var(--line)', borderRadius: 'var(--radius-md)' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Data Baru</span>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--brand)', marginTop: 4 }}>
                {commitResult?.created || 0}
              </div>
            </div>
            <div style={{ padding: 12, background: '#f8fafc', border: '1px solid var(--line)', borderRadius: 'var(--radius-md)' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Data Diperbarui</span>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent)', marginTop: 4 }}>
                {commitResult?.updated || 0}
              </div>
            </div>
            <div style={{ padding: 12, background: '#f8fafc', border: '1px solid var(--line)', borderRadius: 'var(--radius-md)' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Tidak Berubah</span>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--muted)', marginTop: 4 }}>
                {commitResult?.unchanged || 0}
              </div>
            </div>
            <div style={{ padding: 12, background: '#f8fafc', border: '1px solid var(--line)', borderRadius: 'var(--radius-md)' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Catatan / Warning</span>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#ca8a04', marginTop: 4 }}>
                {commitResult?.issues || 0}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
            <button type="button" className="btn btn-secondary" onClick={handleReset}>
              Import File Lain
            </button>
            <button type="button" className="btn btn-primary" onClick={() => setActiveView('students')}>
              <span>Lihat Data Mahasiswa</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
