import React from 'react';
import { AlertCircle, AlertTriangle, FileCheck } from 'lucide-react';

/**
 * Step 2 UploadPage: stats cards, error/warning alerts, sample table, issue list, action bar.
 * Props: previewData, critical, hasSensitive, confirmSensitive, onConfirmChange,
 *        committing, canCommit, onBack, onCommit
 */
export default function UploadStep2({
  previewData,
  critical,
  hasSensitive,
  confirmSensitive,
  onConfirmChange,
  committing,
  canCommit,
  onBack,
  onCommit,
}) {
  const s = previewData || {};

  return (
    <div>
      {/* Stats Cards */}
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
          <div
            className="stat-card-value"
            style={{ color: critical ? 'var(--danger)' : 'var(--muted)' }}
          >
            {s.critical_rows || 0}
          </div>
          <span className="stat-card-subtext">
            {critical ? 'Commit ditolak' : 'Tidak ada konflik kritis'}
          </span>
        </div>
      </div>

      {/* Critical Error Alert */}
      {critical && (
        <div className="upload-critical-box">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertCircle size={20} />
            <strong>
              File memiliki error kritis. Mohon perbaiki file Excel Anda sebelum melanjutkan.
            </strong>
          </div>
        </div>
      )}

      {/* Sensitive Confirmation Warning */}
      {hasSensitive && !critical && (
        <div className="upload-warning-box">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              color: '#92400e',
              marginBottom: 8,
            }}
          >
            <AlertTriangle size={20} />
            <strong>Persetujuan Perubahan Data Sensitif Diperlukan</strong>
          </div>
          <p style={{ fontSize: 13, color: '#78350f', marginBottom: 12 }}>
            Ditemukan {s.amount_change_rows || 0} perubahan nominal dan {s.briva_change_rows || 0}{' '}
            perubahan nomor BRIVA dari data sebelumnya.
          </p>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <input type="checkbox" checked={confirmSensitive} onChange={onConfirmChange} />
            <span>Saya menyetujui pembaruan nominal / nomor BRIVA tagihan di atas.</span>
          </label>
        </div>
      )}

      {/* Sample Data Table */}
      {s.sample && s.sample.length > 0 && (
        <div className="panel-card" style={{ marginBottom: 20 }}>
          <h4
            style={{
              fontSize: 14,
              fontWeight: 800,
              color: 'var(--brand-strong)',
              marginBottom: 12,
            }}
          >
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
                    <td>
                      <strong>{row.nim}</strong>
                    </td>
                    <td>{row.full_name}</td>
                    <td>{row.program_study || '-'}</td>
                    <td>
                      <strong>Rp {Number(row.amount || 0).toLocaleString('id-ID')}</strong>
                    </td>
                    <td>
                      <code style={{ fontFamily: 'var(--font-mono)' }}>{row.briva}</code>
                    </td>
                    <td>{row.due_date || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Issue / Warning List */}
      {s.errors && s.errors.length > 0 && (
        <div className="panel-card" style={{ marginBottom: 20 }}>
          <h4 style={{ fontSize: 14, fontWeight: 800, color: 'var(--ink)', marginBottom: 12 }}>
            Pemberitahuan &amp; Catatan Validasi ({s.errors.length})
          </h4>
          <div className="upload-issues-list">
            {s.errors.map((err, i) => (
              <div
                key={i}
                className={`upload-issue-entry ${err.severity === 'critical' ? 'critical' : 'warning'}`}
              >
                <span>
                  <strong>Baris {err.row_number}:</strong> {err.message}
                </span>
                <span
                  style={{
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    fontSize: 10,
                    color: err.severity === 'critical' ? 'var(--danger)' : '#854d0e',
                  }}
                >
                  {err.severity}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Bar */}
      <div
        className="panel-card"
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
      >
        <button type="button" className="btn btn-secondary" onClick={onBack} disabled={committing}>
          Batal &amp; Ganti File
        </button>

        <button
          type="button"
          className="btn btn-primary"
          onClick={onCommit}
          disabled={!canCommit || committing}
        >
          <FileCheck size={16} />
          <span>{committing ? 'Menyimpan ke Database...' : 'Simpan & Terapkan Data Tagihan'}</span>
        </button>
      </div>
    </div>
  );
}

UploadStep2.displayName = 'UploadStep2';
