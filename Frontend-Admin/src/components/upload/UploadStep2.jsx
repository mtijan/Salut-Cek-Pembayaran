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
  loadingIssues,
  onLoadMoreIssues,
}) {
  const s = previewData || {};
  const issues = s.issues || s.errors || [];

  return (
    <div>
      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-card-title">Baris Valid</span>
          <div className="stat-card-value text-success">{s.valid_rows || 0}</div>
          <span className="stat-card-subtext">
            {s.safe_rows ?? s.valid_rows ?? 0} aman dari file {s.file_name}
          </span>
        </div>

        <div className="stat-card">
          <span className="stat-card-title">Tagihan Baru</span>
          <div className="stat-card-value text-brand">{s.new_rows ?? 0}</div>
          <span className="stat-card-subtext">Akan ditambahkan ke sistem</span>
        </div>

        <div className="stat-card">
          <span className="stat-card-title">Tagihan Diperbarui</span>
          <div className="stat-card-value text-accent">{s.update_rows ?? 0}</div>
          <span className="stat-card-subtext">
            {s.amount_change_rows || 0} nominal / {s.briva_change_rows || 0} BRIVA berubah
          </span>
        </div>

        <div className="stat-card">
          <span className="stat-card-title">Baris Kritis</span>
          <div className={`stat-card-value ${critical ? 'text-danger' : 'text-muted'}`}>
            {s.critical_rows || 0}
          </div>
          <span className="stat-card-subtext">
            {critical ? 'Dikarantina, tidak membentuk tagihan' : 'Tidak ada konflik kritis'}
          </span>
        </div>
      </div>

      {/* Critical Error Alert */}
      {critical && (
        <div className="upload-critical-box">
          <div className="flex-row-gap-8">
            <AlertCircle size={20} />
            <strong>
              {s.critical_rows || 0} baris kritis akan dikarantina. Baris yang aman tetap dapat
              disimpan ke sistem.
            </strong>
          </div>
        </div>
      )}

      {/* Sensitive Confirmation Warning */}
      {hasSensitive && (
        <div className="upload-warning-box">
          <div className="upload-warning-title">
            <AlertTriangle size={20} />
            <strong>Persetujuan Perubahan Data Sensitif Diperlukan</strong>
          </div>
          <p className="upload-warning-text">
            Ditemukan {s.amount_change_rows || 0} perubahan nominal dan {s.briva_change_rows || 0}{' '}
            perubahan nomor BRIVA dari data sebelumnya.
          </p>
          <label className="upload-confirm-label">
            <input type="checkbox" checked={confirmSensitive} onChange={onConfirmChange} />
            <span>Saya menyetujui pembaruan nominal / nomor BRIVA tagihan di atas.</span>
          </label>
        </div>
      )}

      {/* Sample Data Table */}
      {s.sample && s.sample.length > 0 && (
        <div className="panel-card mb-4">
          <h4 className="card-sub-title mb-3">Sampel Data Terbaca (5 Baris Pertama)</h4>
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
                      <code className="font-mono">{row.briva}</code>
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
      {issues.length > 0 && (
        <div className="panel-card mb-4">
          <h4 className="card-sub-title mb-3">
            Detail Baris Bermasalah ({s.issue_pagination?.total ?? issues.length})
          </h4>
          <p className="panel-header-desc upload-issue-help">
            Baris kritis tidak diproses menjadi tagihan. Data mentah ditampilkan agar dapat langsung
            ditelusuri dan diperbaiki.
          </p>
          <div className="table-responsive upload-issues-table-wrap">
            <table className="data-table upload-issues-table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Lokasi</th>
                  <th>NIM</th>
                  <th>Nama</th>
                  <th>BRIVA</th>
                  <th>Jumlah Mentah</th>
                  <th>Kode &amp; Keterangan</th>
                </tr>
              </thead>
              <tbody>
                {issues.map((err, i) => (
                  <tr
                    key={`${err.sheet_name || err.sheet}-${err.row_number}-${err.issue_code}-${i}`}
                  >
                    <td>
                      <span
                        className={`upload-issue-badge ${err.severity === 'critical' ? 'critical' : 'warning'}`}
                      >
                        {err.severity === 'critical' ? 'Kritis' : 'Peringatan'}
                      </span>
                    </td>
                    <td>
                      <strong>{err.sheet_name || err.sheet || '-'}</strong>
                      <span className="upload-issue-row">Baris {err.row_number || '-'}</span>
                    </td>
                    <td>{err.nim || '-'}</td>
                    <td>{err.full_name || '-'}</td>
                    <td>
                      <code>{err.briva || '-'}</code>
                    </td>
                    <td>{err.amount || '-'}</td>
                    <td>
                      <code className="upload-issue-code">
                        {err.issue_code || 'VALIDATION_ISSUE'}
                      </code>
                      <span className="upload-issue-message">{err.note || err.message}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {(s.issue_pagination?.total || 0) > issues.length && (
            <div className="upload-issue-footer">
              <p className="upload-issue-footnote">
                Menampilkan {issues.length} dari {s.issue_pagination.total} masalah.
              </p>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onLoadMoreIssues}
                disabled={loadingIssues}
              >
                {loadingIssues ? 'Memuat Detail...' : 'Muat Masalah Berikutnya'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Action Bar */}
      <div className="panel-card upload-actions-bar">
        <button type="button" className="btn btn-secondary" onClick={onBack} disabled={committing}>
          Batal &amp; Ganti File
        </button>

        <button
          type="submit"
          className="btn btn-primary"
          onClick={onCommit}
          disabled={!canCommit || committing}
        >
          <FileCheck size={16} />
          <span>
            {committing
              ? 'Menyimpan ke Database...'
              : critical
                ? 'Simpan Baris Aman & Karantina Masalah'
                : 'Simpan & Terapkan Data Tagihan'}
          </span>
        </button>
      </div>
    </div>
  );
}

UploadStep2.displayName = 'UploadStep2';
