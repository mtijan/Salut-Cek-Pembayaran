import React from 'react';
import { Plus, Edit2 } from 'lucide-react';

export default function ProgramStudyPanel({
  prodis = [],
  loading = false,
  canManage = false,
  onOpenCreate,
  onOpenEdit,
}) {
  return (
    <div className="panel-card">
      <div className="toolbar-row">
        <div>
          <h3 className="panel-header-title">Daftar Program Studi Terdaftar</h3>
          <p className="panel-header-desc">
            Master data program studi untuk relasi mahasiswa dan laporan keuangan
          </p>
        </div>
        {canManage && (
          <button type="button" className="btn btn-primary" onClick={onOpenCreate}>
            <Plus size={16} />
            <span>Tambah Program Studi</span>
          </button>
        )}
      </div>

      {loading ? (
        <div className="panel-loading-state">
          <span>Memuat Program Studi...</span>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Kode</th>
                <th>Nama Program Studi</th>
                <th>Jenjang</th>
                <th>Fakultas</th>
                <th className="text-right">Mahasiswa</th>
                <th>Status</th>
                <th className="text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {prodis.map((p) => (
                <tr key={p.id}>
                  <td>
                    <strong>{p.code}</strong>
                  </td>
                  <td>{p.name}</td>
                  <td>
                    <span className="badge badge-info">{p.degree}</span>
                  </td>
                  <td>{p.faculty || '-'}</td>
                  <td className="text-right">
                    <strong>{p.student_count || 0}</strong>
                  </td>
                  <td>
                    <span className={`badge ${p.is_active ? 'badge-success' : 'badge-neutral'}`}>
                      {p.is_active ? 'Aktif' : 'Non-Aktif'}
                    </span>
                  </td>
                  <td className="text-right">
                    {canManage && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => onOpenEdit(p)}
                      >
                        <Edit2 size={14} />
                        <span>Edit</span>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

ProgramStudyPanel.displayName = 'ProgramStudyPanel';
