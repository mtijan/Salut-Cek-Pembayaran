import React from 'react';
import { UploadCloud, FileSpreadsheet, RefreshCw, Download } from 'lucide-react';
import { templateApi } from '../../services/api';

/**
 * Step 1 UploadPage: dropzone + file picker + template download.
 * Props: file, analyzing, onFileChange, onAnalyze
 */
export default function UploadStep1({ file, analyzing, onFileChange, onAnalyze }) {
  return (
    <div className="panel-card">
      <div className="upload-header-row">
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--brand-strong)', margin: 0 }}>
            Impor Data Mahasiswa &amp; Tagihan
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

      <div className="upload-dropzone-box">
        <UploadCloud size={48} color="var(--brand)" style={{ margin: '0 auto 16px' }} />
        <h4 style={{ fontSize: 16, fontWeight: 800, color: 'var(--brand-strong)' }}>
          Tarik atau Pilih File Excel (.xlsx)
        </h4>
        <p className="upload-dropzone-desc">
          Mendukung Master Data 13 kolom (<code>NIM</code>, <code>Nama</code>, <code>NO KTP</code>,{' '}
          <code>Tempat/Tgl Lahir</code>, <code>Nama Ibu Kandung</code>, <code>e-Mail</code>,{' '}
          <code>No Kontak</code>, <code>Registrasi Awal</code>, <code>Program Studi</code>,{' '}
          <code>No Rek</code>, <code>Jumlah</code>, <code>Batas Pembayaran</code>).
        </p>

        <input
          type="file"
          id="file-upload"
          accept=".xlsx"
          style={{ display: 'none' }}
          onChange={onFileChange}
        />

        <label htmlFor="file-upload" className="btn btn-primary" style={{ cursor: 'pointer' }}>
          <FileSpreadsheet size={16} />
          <span>{file ? file.name : 'Pilih File Excel'}</span>
        </label>

        {file && (
          <div className="upload-selected-file-info">
            <p style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 600 }}>
              File Terpilih: <strong>{file.name}</strong> ({(file.size / 1024).toFixed(1)} KB)
            </p>
            <button
              type="button"
              className="btn btn-primary"
              style={{ marginTop: 12 }}
              onClick={onAnalyze}
              disabled={analyzing}
            >
              <RefreshCw size={14} className={analyzing ? 'spin' : ''} />
              <span>{analyzing ? 'Menganalisis Format & Data...' : 'Periksa & Analisis File'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

UploadStep1.displayName = 'UploadStep1';
