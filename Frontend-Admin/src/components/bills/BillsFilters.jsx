import React from 'react';
import { Plus, RefreshCw, Search, X } from 'lucide-react';
import FilterChips from '../common/FilterChips';

export default function BillsFilters({
  filters,
  options,
  hasActiveFilter,
  activeFilterChips,
  canManage,
  actions,
  navigateTo,
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
      <div
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}
      >
        <div className="search-input-wrap" style={{ flex: 1, maxWidth: 440 }}>
          <Search size={16} />
          <input
            type="text"
            placeholder="Cari NIM, nama, no BRIVA, jenis tagihan..."
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ height: 38 }}
            onClick={actions.refresh}
            title="Segarkan Data"
          >
            <RefreshCw size={15} />
            <span>Segarkan</span>
          </button>
          {canManage && (
            <button
              type="button"
              className="btn btn-primary"
              style={{ height: 38 }}
              onClick={() => navigateTo?.('bill-edit', { mode: 'create' })}
            >
              <Plus size={16} />
              <span>Buat Tagihan Baru</span>
            </button>
          )}
        </div>
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
          style={{ minWidth: 180, flex: '1 1 180px' }}
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
          className="select-filter"
          style={{ minWidth: 140, flex: '1 1 140px' }}
          value={filters.selectedPeriod}
          onChange={(event) => actions.setSelectedPeriod(event.target.value)}
        >
          <option value="">Semua Periode</option>
          {options.periods.map((period) => (
            <option key={period.id} value={period.code}>
              {period.name} ({period.code})
            </option>
          ))}
        </select>
        <select
          className="select-filter"
          style={{ minWidth: 150, flex: '1 1 150px' }}
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
          className="select-filter"
          style={{ minWidth: 140, flex: '1 1 140px' }}
          value={filters.selectedStatus}
          onChange={(event) => actions.setSelectedStatus(event.target.value)}
        >
          <option value="">Semua Status</option>
          <option value="unpaid">Belum Lunas</option>
          <option value="partial">Bayar Sebagian</option>
          <option value="paid">Lunas</option>
        </select>
        <select
          className="select-filter"
          style={{ minWidth: 160, flex: '1 1 160px' }}
          value={filters.sortBy}
          onChange={(event) => actions.setSortBy(event.target.value)}
          title="Urutan Data"
        >
          <option value="updated_desc">Urutan: Terakhir Diperbarui</option>
          <option value="created_desc">Urutan: Terbaru Dibuat</option>
          <option value="amount_desc">Urutan: Nominal Tertinggi</option>
          <option value="amount_asc">Urutan: Nominal Terendah</option>
          <option value="due_date_asc">Urutan: Jatuh Tempo Terdekat</option>
          <option value="nim_asc">Urutan: NIM (A-Z)</option>
          <option value="name_asc">Urutan: Nama (A-Z)</option>
        </select>
        {hasActiveFilter && (
          <button
            type="button"
            className="btn btn-secondary"
            style={{ height: 38, padding: '0 12px', color: '#b91c1c' }}
            onClick={actions.resetFilters}
            title="Reset Semua Filter"
          >
            <X size={14} />
            <span>Reset Filter</span>
          </button>
        )}
      </div>
      {hasActiveFilter && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 8,
            paddingTop: 4,
          }}
        >
          <FilterChips items={activeFilterChips} />
        </div>
      )}
    </div>
  );
}
