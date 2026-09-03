import React from 'react';
import { Download, RefreshCw, Search, X } from 'lucide-react';
import FilterChips from '../common/FilterChips';

export default function ReportsFilters({
  loading,
  filters,
  options,
  hasActiveFilter,
  activeFilterChips,
  visibleCount,
  totalCount,
  actions,
}) {
  return (
    <div className="reports-filter-container">
      <div className="reports-top-bar">
        <div className="search-input-wrap search-wrap-reports">
          <Search size={16} />
          <input
            type="text"
            placeholder="Cari NIM, nama, No. BRIVA, prodi, angkatan..."
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

        <div className="reports-actions-group">
          <button
            type="button"
            className="btn btn-secondary btn-fixed-h"
            onClick={actions.refresh}
            title="Segarkan Data"
          >
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
            <span>Segarkan</span>
          </button>
          <button
            type="button"
            className="btn btn-primary btn-fixed-h"
            onClick={actions.exportCsv}
            disabled={loading || totalCount === 0}
            title="Ekspor Data Rekapitulasi ke CSV"
          >
            <Download size={15} />
            <span>Ekspor CSV</span>
          </button>
        </div>
      </div>

      <div className="reports-filter-bar">
        <span className="filter-bar-label">Filter:</span>
        <select
          className="select-filter select-prodi"
          value={filters.selectedProdi}
          onChange={(event) => actions.setSelectedProdi(event.target.value)}
        >
          <option value="">Semua Program Studi</option>
          {options.prodis.map((program) => (
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
          <option value="">Semua Periode</option>
          {options.periods.map((period) => (
            <option key={period.id || period.code} value={period.code}>
              {period.name} ({period.code})
            </option>
          ))}
        </select>
        <select
          className="select-filter select-entry-period"
          value={filters.selectedEntryPeriod}
          onChange={(event) => actions.setSelectedEntryPeriod(event.target.value)}
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
          <option value="unpaid">Belum Lunas</option>
          <option value="partial">Bayar Sebagian</option>
          <option value="paid">Lunas</option>
        </select>
        <select
          className="select-filter select-sort"
          value={filters.sortBy}
          onChange={(event) => actions.setSortBy(event.target.value)}
          title="Urutan Data"
        >
          <option value="amount_desc">Urutan: Nominal Tertinggi</option>
          <option value="amount_asc">Urutan: Nominal Terendah</option>
          <option value="paid_desc">Urutan: Terbayar Tertinggi</option>
          <option value="outstanding_desc">Urutan: Sisa Piutang Tertinggi</option>
          <option value="rate_desc">Urutan: Realisasi (%) Tertinggi</option>
          <option value="name_asc">Urutan: Nama (A-Z)</option>
          <option value="nim_asc">Urutan: NIM (A-Z)</option>
        </select>
        {hasActiveFilter && (
          <button
            type="button"
            className="btn btn-secondary btn-reset-danger"
            onClick={actions.resetFilters}
            title="Reset Semua Filter"
          >
            <X size={14} />
            <span>Reset Filter</span>
          </button>
        )}
      </div>

      {hasActiveFilter && (
        <div className="reports-chips-row">
          <FilterChips items={activeFilterChips} />
          <span className="reports-count-text">
            Menampilkan <strong>{visibleCount}</strong> dari <strong>{totalCount}</strong> mahasiswa
          </span>
        </div>
      )}
    </div>
  );
}

ReportsFilters.displayName = 'ReportsFilters';
