import React from 'react';

export default function BillIdentityFields({ formData, setFormData, periods = [] }) {
  return (
    <>
      {/* Bill Type */}
      <div>
        <label className="bill-field-label">
          Jenis Tagihan <span className="bill-req-star">*</span>
        </label>
        <div className="flex-row-gap-8">
          <select
            className="form-control flex-1"
            value={formData.bill_type_mode}
            onChange={(e) => setFormData((prev) => ({ ...prev, bill_type_mode: e.target.value }))}
          >
            <option value="UKT">UKT (Uang Kuliah Tunggal)</option>
            <option value="WISUDA">WISUDA</option>
            <option value="PRAKTIKUM">PRAKTIKUM</option>
            <option value="REGISTRASI">REGISTRASI AWAL</option>
            <option value="Custom">Custom / Lainnya</option>
          </select>
          {formData.bill_type_mode === 'Custom' && (
            <input
              type="text"
              className="form-control flex-1"
              placeholder="Nama jenis tagihan..."
              value={formData.custom_bill_type}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, custom_bill_type: e.target.value }))
              }
              required
            />
          )}
        </div>
      </div>

      {/* Academic Period */}
      <div>
        <label className="bill-field-label">
          Periode Tagihan <span className="bill-req-star">*</span>
        </label>
        <div className="flex-row-gap-8">
          <select
            className="form-control flex-1"
            value={formData.period_mode === 'custom' ? 'custom' : formData.period}
            onChange={(e) => {
              const val = e.target.value;
              if (val === 'custom') {
                setFormData((prev) => ({ ...prev, period_mode: 'custom' }));
              } else {
                setFormData((prev) => ({ ...prev, period_mode: 'master', period: val }));
              }
            }}
          >
            {periods.map((p) => (
              <option key={p.id} value={p.code}>
                {p.name} ({p.code})
              </option>
            ))}
            <option value="custom">+ Entri Periode Kustom</option>
          </select>
          {formData.period_mode === 'custom' && (
            <input
              type="text"
              className="form-control flex-1"
              placeholder="Contoh: 2026.1 atau 20261"
              value={formData.custom_period}
              onChange={(e) => setFormData((prev) => ({ ...prev, custom_period: e.target.value }))}
              required
            />
          )}
        </div>
      </div>
    </>
  );
}

BillIdentityFields.displayName = 'BillIdentityFields';
