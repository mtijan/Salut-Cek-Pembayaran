import React, { useState, useEffect } from 'react';
import { Layers, Trash2, RefreshCw, FileText, Calendar, Users, Receipt } from 'lucide-react';
import { importApi } from '../services/api';
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
            <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--ink)' }}>
              Riwayat Kumpulan File Import Tagihan
            </h3>
            <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
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
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
            <span>Memuat data file import...</span>
          </div>
        ) : !files.length ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
            <p>Belum ada file Excel yang diimpor ke dalam sistem.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
            {files.map((f, idx) => (
              <div
                key={f.file_name || idx}
                style={{
                  background: '#ffffff',
                  border: '1px solid var(--line)',
                  borderRadius: 'var(--radius-lg)',
                  padding: 20,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ padding: 8, background: '#f1f5f9', borderRadius: 'var(--radius-md)', color: 'var(--brand)' }}>
                        <FileText size={20} />
                      </div>
                      <div>
                        <strong style={{ fontSize: 14, color: 'var(--brand-strong)', wordBreak: 'break-all' }}>
                          {f.file_name}
                        </strong>
                        <div style={{ fontSize: 11, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                          <Calendar size={12} />
                          <span>Diimpor: {f.imported_at || '-'}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, margin: '16px 0', padding: 12, background: '#f8fafc', borderRadius: 'var(--radius-md)' }}>
                    <div>
                      <span style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase' }}>Mahasiswa</span>
                      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>{f.student_count}</div>
                    </div>
                    <div>
                      <span style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase' }}>Total Tagihan</span>
                      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>{f.bill_count}</div>
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <span style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase' }}>Total Nominal</span>
                      <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--brand-strong)' }}>{f.total_amount_formatted}</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
                    <span className="badge badge-success">{f.paid_bills || 0} Lunas</span>
                    <span className="badge badge-warning">{f.partial_bills || 0} Cicilan</span>
                    <span className="badge badge-danger">{f.unpaid_bills || 0} Belum</span>
                  </div>
                </div>

                {can('import') && (
                  <div style={{ borderTop: '1px solid var(--line)', paddingTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
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
