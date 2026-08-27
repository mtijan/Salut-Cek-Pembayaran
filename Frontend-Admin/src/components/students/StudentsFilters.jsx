import React from 'react';
import { Plus, RefreshCw, Search, X } from 'lucide-react';

export default function StudentsFilters({ filters, prodis, canManage, actions }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
      <div
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}
      >
        <div className="search-input-wrap" style={{ flex: 1, maxWidth: 440 }}>
          <Search size={16} />
          <input
            type="text"
            placeholder="Cari NIM, nama, prodi, NIK, kontak..."
            value={filters.query}
            onChange={(event) => actions.setQuery(event.target.value)}
          />
          {filters.query && (
            <button
              type="button"
              onClick={() => actions.setQuery('')}
              style={{
                position: 'absolute',
                right: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'transparent',
                border: 'none',
                color: 'var(--muted)',
                cursor: 'pointer',
                padding: 4,
              }}
              title="Hapus pencarian"
            >
              <X size={14} />
            </button>
          )}
        </div>
        {canManage && (
          <button
            type="button"
            className="btn btn-primary"
            style={{ height: 38 }}
            onClick={actions.openCreate}
          >
            <Plus size={16} />
            <span>Tambah Mahasiswa</span>
          </button>
        )}
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 10,
          padding: '10px 14px',
          background: '#f8fafc',
          border: '1px solid var(--line)',
          borderRadius: 'var(--radius-md)',
        }}
      >
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            color: 'var(--muted)',
            marginRight: 4,
          }}
        >
          Filter:
        </span>
        <select
          className="select-filter"
          style={{ minWidth: 190, flex: '1 1 190px' }}
          value={filters.selectedProdi}
          onChange={(event) => actions.setSelectedProdi(event.target.value)}
        >
          <option value="">Semua Program Studi</option>
          {prodis.map((program) => (
            <option key={program.id} value={program.id}>
              {program.name}
            </option>
          ))}
        </select>
        <select
          className="select-filter"
          style={{ minWidth: 160, flex: '1 1 160px' }}
          value={filters.selectedPeriod}
          onChange={(event) => actions.setSelectedPeriod(event.target.value)}
        >
          <option value="">Semua Periode Masuk</option>
          <option value="2026.1">2026.1 (Ganjil)</option>
          <option value="2025.2">2025.2 (Genap)</option>
          <option value="2025.1">2025.1 (Ganjil)</option>
          <option value="2024.2">2024.2 (Genap)</option>
          <option value="2024.1">2024.1 (Ganjil)</option>
          <option value="2023.2">2023.2 (Genap)</option>
          <option value="2023.1">2023.1 (Ganjil)</option>
        </select>
        <select
          className="select-filter"
          style={{ minWidth: 130, flex: '1 1 130px' }}
          value={filters.selectedStatus}
          onChange={(event) => actions.setSelectedStatus(event.target.value)}
        >
          <option value="">Semua Status</option>
          <option value="aktif">Aktif</option>
          <option value="cuti">Cuti</option>
          <option value="lulus">Lulus</option>
          <option value="nonaktif">Non-Aktif</option>
          <option value="keluar">Keluar</option>
        </select>
        <select
          className="select-filter"
          style={{ minWidth: 160, flex: '1 1 160px' }}
          value={filters.sortBy}
          onChange={(event) => actions.setSortBy(event.target.value)}
          title="Urutan Data"
        >
          <option value="entry_period_desc">Urut Periode Terbaru</option>
          <option value="entry_period_asc">Urut Periode Terlama</option>
          <option value="nim_asc">Urut NIM (A-Z)</option>
          <option value="name_asc">Urut Nama (A-Z)</option>
        </select>
        <button
          type="button"
          className="btn btn-secondary"
          style={{ height: 38, padding: '0 12px' }}
          onClick={actions.resetFilters}
          title="Reset Filter"
        >
          <RefreshCw size={14} />
          <span>Reset</span>
        </button>
      </div>
    </div>
  );
}
