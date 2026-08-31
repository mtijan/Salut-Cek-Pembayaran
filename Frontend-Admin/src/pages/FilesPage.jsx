import React, { useState, useEffect } from 'react';
import { Trash2, RefreshCw, FileText, Calendar } from 'lucide-react';
import { importApi } from '../services/importApi';
import { useToast } from '../components/common/Toast';
import { useAuth } from '../context/AuthContext';
import ConfirmModal from '../components/common/ConfirmModal';

export default function FilesPage() {
  const { showToast } = useToast();
  const { can } = useAuth();

  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const fetchFiles = async () => {
    setLoading(true);
    try {
      const data = await importApi.getGroups();
      setFiles(data.files || []);
    } catch (err) {
      showToast(err.message || 'Gagal memuat riwayat file import.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  const handleDeleteConfirm = async (reason) => {
    if (!deleteTarget) return;
    await importApi.deleteFile(deleteTarget.file_name, reason);
    showToast(`Kumpulan tagihan dari file "${deleteTarget.file_name}" berhasil dihapus.`);
    setDeleteTarget(null);
    fetchFiles();
  };

  return (
    <div>
      <div className="panel-card">
        <div className="toolbar-row">
          <div>
            <h3 className="panel-header-title">Riwayat Kumpulan File Import Tagihan</h3>
            <p className="panel-header-desc">
              Daftar file Excel yang telah diimpor ke sistem beserta ringkasan status tagihannya
            </p>
          </div>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={fetchFiles}
            disabled={loading}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            <span>Muat Ulang</span>
          </button>
        </div>

        {loading ? (
          <div className="panel-loading-state">
            <span>Memuat data file import...</span>
          </div>
        ) : !files.length ? (
          <div className="panel-loading-state">
            <p>Belum ada file Excel yang diimpor ke dalam sistem.</p>
          </div>
        ) : (
          <div className="files-grid">
            {files.map((f, idx) => (
              <div key={f.file_name || idx} className="file-card">
                <div>
                  <div className="file-card-top">
                    <div className="flex-row-gap-8">
                      <div className="file-icon-box">
                        <FileText size={20} />
                      </div>
                      <div>
                        <strong className="file-name-title">{f.file_name}</strong>
                        <div className="file-meta-row">
                          <Calendar size={12} />
                          <span>Diimpor: {f.imported_at || '-'}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="file-stats-grid">
                    <div>
                      <span className="file-stat-label">Mahasiswa</span>
                      <div className="file-stat-val">{f.student_count}</div>
                    </div>
                    <div>
                      <span className="file-stat-label">Total Tagihan</span>
                      <div className="file-stat-val">{f.bill_count}</div>
                    </div>
                    <div className="form-group-full">
                      <span className="file-stat-label">Total Nominal</span>
                      <div className="stat-value-lg text-brand-strong">
                        {f.total_amount_formatted}
                      </div>
                    </div>
                  </div>

                  <div className="file-badges-row">
                    <span className="badge badge-success">{f.paid_bills || 0} Lunas</span>
                    <span className="badge badge-warning">{f.partial_bills || 0} Cicilan</span>
                    <span className="badge badge-danger">{f.unpaid_bills || 0} Belum</span>
                  </div>
                </div>

                {can('import') && (
                  <div className="file-card-footer">
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={() => setDeleteTarget(f)}
                    >
                      <Trash2 size={14} />
                      <span>Hapus Batch File</span>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        title="Hapus Kumpulan Tagihan File"
        description={`Apakah Anda yakin ingin menghapus seluruh tagihan (${deleteTarget?.bill_count} tagihan) yang berasal dari file "${deleteTarget?.file_name}"?`}
        confirmText="Hapus File Batch"
        onConfirm={handleDeleteConfirm}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}

FilesPage.displayName = 'FilesPage';
