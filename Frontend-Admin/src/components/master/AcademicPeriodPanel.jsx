import React from 'react';
import { Plus, Edit2, CheckCircle2 } from 'lucide-react';

export default function AcademicPeriodPanel({
  periods = [],
  loading = false,
  canManage = false,
  onOpenCreate,
  onOpenEdit,
}) {
  return (
    <div className="panel-card">
      <div className="toolbar-row">
        <div>
          <h3 className="panel-header-title">Daftar Periode / Semester Akademik</h3>
          <p className="panel-header-desc">
            Kalender semester akademik untuk penetapan tagihan berjalan
          </p>
        </div>
        {canManage && (
          <button type="button" className="btn btn-primary" onClick={onOpenCreate}>
            <Plus size={16} />
            <span>Tambah Periode Akademik</span>
          </button>
        )}
      </div>

      {loading ? (
        <div className="panel-loading-state">
          <span>Memuat Periode Akademik...</span>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Kode Semester</th>
                <th>Nama Periode</th>
                <th>Tipe</th>
                <th>Batas Pembayaran Default</th>
                <th>Status</th>
                <th className="text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {periods.map((p) => {
                const semType = p.semester_type || p.period_type || 'ganjil';
                return (
                  <tr key={p.id}>
                    <td>
                      <strong>{p.code}</strong>
                    </td>
                    <td>{p.name}</td>
                    <td>
                      <span
                        className={`badge ${semType === 'ganjil' ? 'badge-info' : 'badge-warning'}`}
                      >
                        {semType}
                      </span>
                    </td>
                    <td>{p.default_due_date || '-'}</td>
                    <td>
                      {p.is_active ? (
                        <span className="badge badge-success badge-active-semester">
                          <CheckCircle2 size={12} />
                          <span>Semester Aktif</span>
                        </span>
                      ) : (
                        <span className="badge badge-neutral">Arsip</span>
                      )}
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
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

AcademicPeriodPanel.displayName = 'AcademicPeriodPanel';
