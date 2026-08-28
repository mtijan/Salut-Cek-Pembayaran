import React from 'react';
import { Filter, X } from 'lucide-react';

export default function FilterChips({ items }) {
  const visibleItems = items.filter(Boolean);
  if (visibleItems.length === 0) return null;

  return (
    <div className="filter-chips-container filter-chips-no-pt">
      <span className="filter-chips-title">
        <Filter size={13} /> Filter Aktif:
      </span>

      {visibleItems.map((item) => (
        <span className="filter-chip" key={item.key}>
          <span className="filter-chip-label">{item.label}:</span> {item.value}
          <button
            type="button"
            className="filter-chip-close"
            onClick={item.onRemove}
            aria-label={`Hapus filter ${item.label}`}
          >
            <X size={12} />
          </button>
        </span>
      ))}
    </div>
  );
}

FilterChips.displayName = 'FilterChips';
