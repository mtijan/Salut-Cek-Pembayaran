import React from 'react';
import { Plus, RefreshCw, Search, X } from 'lucide-react';

export default function StudentsFilters({ filters, prodis, canManage, actions }) {
  return (
    <div className="reports-filter-container">
      <div className="reports-top-bar">
        <div className="search-input-wrap search-wrap-reports">
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
              className="search-clear-btn"
              title="Hapus pencarian"
            >
              <X size={14} />
            </button>
          )}
        </div>
        {canManage && (
          <button
            type="button"
            className="btn btn-primary btn-fixed-h"
            onClick={actions.openCreate}
          >
            <Plus size={16} />
            <span>Tambah Mahasiswa</span>
          </button>
        )}
      </div>
      <div className="reports-filter-bar">
        <span className="filter-bar-label">Filter:</span>
        <select
          className="select-filter select-prodi"
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
          className="select-filter select-period"
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
          className="select-filter select-status"
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
          className="select-filter select-sort"
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
          className="btn btn-secondary btn-fixed-h"
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

StudentsFilters.displayName = 'StudentsFilters';
