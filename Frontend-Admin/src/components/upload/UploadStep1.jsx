import React from 'react';
import { UploadCloud, FileSpreadsheet, RefreshCw, Download } from 'lucide-react';
import { templateApi } from '../../services/masterApi';

/**
 * Step 1 UploadPage: dropzone + file picker + template download.
 * Props: file, analyzing, onFileChange, onAnalyze
 */
export default function UploadStep1({
  file,
  analyzing,
  billingYear,
  semesterType,
  onBillingYearChange,
  onSemesterTypeChange,
  onFileChange,
  onAnalyze,
}) {
  const periodCode = billingYear ? `${billingYear}.${semesterType === 'genap' ? '2' : '1'}` : '-';
  const periodLabel = billingYear
    ? `${billingYear} ${semesterType === 'genap' ? 'Genap' : 'Ganjil'}`
    : '-';

  return (
    <div className="panel-card">
      <div className="upload-header-row">
        <div>
          <h3 className="card-sub-title mb-0">Impor Data Mahasiswa &amp; Tagihan</h3>
          <p className="panel-header-desc">
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

      <div className="upload-period-panel">
        <div className="upload-period-fields">
          <div className="form-group upload-period-field">
            <label htmlFor="billing-year">Tahun Tagihan</label>
            <input
              id="billing-year"
              className="form-control"
              type="number"
              min="2000"
              max="2100"
              value={billingYear}
              onChange={onBillingYearChange}
              required
            />
          </div>
          <div className="form-group upload-period-field">
            <label htmlFor="semester-type">Semester</label>
            <select
              id="semester-type"
              className="form-control"
              value={semesterType}
              onChange={onSemesterTypeChange}
            >
              <option value="ganjil">Ganjil</option>
              <option value="genap">Genap</option>
            </select>
          </div>
        </div>
        <div className="upload-period-preview" aria-live="polite">
          <span>Periode yang akan dikunci pada preview</span>
          <strong>{periodLabel}</strong>
          <code>{periodCode}</code>
        </div>
      </div>

      <div className="upload-dropzone-box">
        <UploadCloud size={48} className="text-brand upload-success-icon" />
        <h4 className="upload-title text-brand-strong">Tarik atau Pilih File Excel (.xlsx)</h4>
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
          className="hidden-file-input"
          onChange={onFileChange}
        />

        <label htmlFor="file-upload" className="btn btn-primary cursor-pointer">
          <FileSpreadsheet size={16} />
          <span>{file ? file.name : 'Pilih File Excel'}</span>
        </label>

        {file && (
          <div className="upload-selected-file-info">
            <p className="selected-file-name">
              File Terpilih: <strong>{file.name}</strong> ({(file.size / 1024).toFixed(1)} KB)
            </p>
            <button
              type="button"
              className="btn btn-primary mt-3"
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
