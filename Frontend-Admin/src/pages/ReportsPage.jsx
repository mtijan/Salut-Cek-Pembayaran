import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Search, Download, RefreshCw, FileText, CheckCircle2, Clock,
  TrendingUp, Filter, X,
  Copy, Check, User, ChevronLeft, ChevronRight
} from 'lucide-react';
import { reportsApi, masterApi } from '../services/api';
import { useToast } from '../components/common/Toast';
import { toCsv } from '../utils/csv';
import { clampPage } from '../utils/pagination';

const formatRupiah = (val) => {
  const num = Number(val) || 0;
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
};

export default function ReportsPage({ navigateTo }) {
  const { showToast } = useToast();

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  // Filters (Identical to BillsPage & StudentsPage)
  const [query, setQuery] = useState('');
  const [selectedProdi, setSelectedProdi] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState('');
  const [selectedEntryPeriod, setSelectedEntryPeriod] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [sortBy, setSortBy] = useState('amount_desc');

  // Master Options
  const [prodis, setProdis] = useState([]);
  const [periods, setPeriods] = useState([]);

  // Copy state
  const [copiedKey, setCopiedKey] = useState(null);

  // Pagination state
  const [page, setPage] = useState(1);
  const limit = 50;

  const fetchMasterOptions = useCallback(async () => {
    try {
      const [pRes, prRes] = await Promise.all([
        masterApi.listPeriods(),
        masterApi.listProdi(),
      ]);
      setPeriods(pRes.academic_periods || []);
      setProdis(prRes.study_programs || []);
    } catch (err) {
      showToast(err.message || 'Gagal memuat opsi filter laporan.', 'error');
    }
  }, [showToast]);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const data = await reportsApi.getFinancialSummary({
        period: selectedPeriod,
        study_program_id: selectedProdi,
        entry_period: selectedEntryPeriod,
      });
      setReport(data);
    } catch (err) {
      showToast(err.message || 'Gagal memuat rekapitulasi keuangan.', 'error');
    } finally {
      setLoading(false);
    }
  }, [selectedPeriod, selectedProdi, selectedEntryPeriod, showToast]);

  useEffect(() => {
    fetchMasterOptions();
  }, [fetchMasterOptions]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handleCopy = (text, label) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(label);
    showToast(`${label} disalin!`, 'success');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleResetFilters = () => {
    setQuery('');
    setSelectedProdi('');
    setSelectedPeriod('');
    setSelectedEntryPeriod('');
    setSelectedStatus('');
    setSortBy('amount_desc');
    setPage(1);
  };

  const hasActiveFilter = Boolean(
    query || selectedProdi || selectedPeriod || selectedEntryPeriod || selectedStatus || sortBy !== 'amount_desc'
  );

  const rawStudents = report?.by_student || [];

  // Filter & Sort client-side
  const filteredAndSortedStudents = useMemo(() => {
    let list = [...rawStudents];

    // Filter by query (NIM, Name, Prodi, Angkatan, Phone Number)
    if (query.trim()) {
      const q = query.toLowerCase().trim();
      list = list.filter((s) =>
        (s.full_name && s.full_name.toLowerCase().includes(q)) ||
        (s.nim && s.nim.toLowerCase().includes(q)) ||
        (s.phone_number && s.phone_number.toLowerCase().includes(q)) ||
        (s.program_study && s.program_study.toLowerCase().includes(q)) ||
        (s.entry_period && s.entry_period.toLowerCase().includes(q))
      );
    }

    // Filter by status
    if (selectedStatus) {
      list = list.filter((s) => s.status === selectedStatus);
    }

    // Sort
    list.sort((a, b) => {
      if (sortBy === 'amount_desc') return (b.billed_amount || 0) - (a.billed_amount || 0);
      if (sortBy === 'amount_asc') return (a.billed_amount || 0) - (b.billed_amount || 0);
      if (sortBy === 'paid_desc') return (b.paid_amount || 0) - (a.paid_amount || 0);
      if (sortBy === 'outstanding_desc') return (b.outstanding_amount || 0) - (a.outstanding_amount || 0);
      if (sortBy === 'rate_desc') return (b.percentage_paid || 0) - (a.percentage_paid || 0);
      if (sortBy === 'name_asc') return (a.full_name || '').localeCompare(b.full_name || '');
      if (sortBy === 'nim_asc') return (a.nim || '').localeCompare(b.nim || '');
      return 0;
    });

    return list;
  }, [rawStudents, query, selectedStatus, sortBy]);

  // Paginated students
  const totalCount = filteredAndSortedStudents.length;
  const totalPages = Math.ceil(totalCount / limit) || 1;

  useEffect(() => {
    setPage((currentPage) => clampPage(currentPage, totalPages));
  }, [totalPages]);

  const paginatedStudents = useMemo(() => {
    const start = (page - 1) * limit;
    return filteredAndSortedStudents.slice(start, start + limit);
  }, [filteredAndSortedStudents, page, limit]);

  // Statistics calculation for summary cards based on current filtered dataset
  const dynamicStats = useMemo(() => {
    let totalBilled = 0;
    let totalPaid = 0;
    let totalOutstanding = 0;
    let totalBillsCount = 0;

    filteredAndSortedStudents.forEach((s) => {
      totalBilled += Number(s.billed_amount || 0);
      totalPaid += Number(s.paid_amount || 0);
      totalOutstanding += Number(s.outstanding_amount || 0);
      totalBillsCount += Number(s.total_bills || 0);
    });

    const rate = totalBilled > 0 ? Math.round((totalPaid / totalBilled) * 10000) / 100 : 0;

    return {
      totalStudents: filteredAndSortedStudents.length,
      totalBills: totalBillsCount,
      totalBilled,
      totalPaid,
      totalOutstanding,
      percentagePaid: rate,
    };
  }, [filteredAndSortedStudents]);

  const activeProdiObj = prodis.find((p) => p.id === selectedProdi);
  const activePeriodObj = periods.find((p) => p.code === selectedPeriod);

  const handleExportCSV = () => {
    if (!filteredAndSortedStudents.length) {
      showToast('Tidak ada data untuk diekspor.', 'error');
      return;
    }

    const headers = [
      'NIM',
      'Nama',
      'Phone Number',
      'Program Studi',
      'Angkatan Masuk',
      'Jumlah Tagihan',
      'Total Tagihan (Rp)',
      'Total Terbayar (Rp)',
      'Sisa Piutang (Rp)',
      'Realisasi (%)',
      'Status Pembayaran',
    ];

    const rows = filteredAndSortedStudents.map((s) => [
      `'${s.nim || '-'}`,
      s.full_name || '-',
      s.phone_number && s.phone_number !== '-' ? `'${s.phone_number}` : '-',
      s.program_study || '-',
      s.entry_period || '-',
      s.total_bills,
      s.billed_amount,
      s.paid_amount,
      s.outstanding_amount,
      `${s.percentage_paid}%`,
      s.status_label || (s.status === 'paid' ? 'Lunas' : s.status === 'partial' ? 'Sebagian' : 'Belum Bayar'),
    ]);

    const csvContent = toCsv([headers, ...rows]);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    const timestamp = new Date().toISOString().slice(0, 10);
    link.setAttribute('download', `Rekap_Keuangan_SALUT_${timestamp}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast(`Berhasil mengekspor ${filteredAndSortedStudents.length} data ke CSV.`, 'success');
  };

  return (
    <div>
      {/* Summary Statistics Bar (Identical with BillsPage & StudentsPage) */}
      <div className="student-stats-row">
        <div
          className={`student-stat-card ${!selectedStatus ? 'is-active' : ''}`}
          onClick={() => {
            setSelectedStatus('');
            setPage(1);
          }}
          style={{ cursor: 'pointer' }}
          title="Klik untuk menampilkan seluruh data"
        >
          <div className="student-stat-icon" style={{ background: 'var(--brand-surface)', color: 'var(--brand)' }}>
            <FileText size={22} />
          </div>
          <div className="student-stat-meta">
            <span className="student-stat-title">Total Tagihan Terbit</span>
            <strong className="student-stat-number">{formatRupiah(dynamicStats.totalBilled)}</strong>
          </div>
        </div>

        <div
          className={`student-stat-card ${selectedStatus === 'paid' ? 'is-active' : ''}`}
          onClick={() => {
            setSelectedStatus(selectedStatus === 'paid' ? '' : 'paid');
            setPage(1);
          }}
          style={{ cursor: 'pointer' }}
          title="Klik untuk memfilter status Lunas"
        >
          <div className="student-stat-icon" style={{ background: 'var(--success-bg)', color: 'var(--success)' }}>
            <CheckCircle2 size={22} />
          </div>
          <div className="student-stat-meta">
            <span className="student-stat-title">Total Terbayar (Lunas)</span>
            <strong className="student-stat-number" style={{ color: 'var(--success)' }}>
              {formatRupiah(dynamicStats.totalPaid)}
            </strong>
          </div>
        </div>

        <div
          className={`student-stat-card ${selectedStatus === 'partial' || selectedStatus === 'unpaid' ? 'is-active' : ''}`}
          onClick={() => {
            setSelectedStatus(selectedStatus === 'partial' ? 'unpaid' : selectedStatus === 'unpaid' ? '' : 'partial');
            setPage(1);
          }}
          style={{ cursor: 'pointer' }}
          title="Klik untuk beralih filter Belum Lunas / Sebagian"
        >
          <div className="student-stat-icon" style={{ background: 'var(--warning-bg)', color: 'var(--warning)' }}>
            <Clock size={22} />
          </div>
          <div className="student-stat-meta">
            <span className="student-stat-title">Sisa Piutang / Tunggakan</span>
            <strong className="student-stat-number" style={{ color: dynamicStats.totalOutstanding > 0 ? 'var(--danger)' : 'var(--success)' }}>
              {formatRupiah(dynamicStats.totalOutstanding)}
            </strong>
          </div>
        </div>

        <div className="student-stat-card">
          <div className="student-stat-icon" style={{ background: 'var(--info-bg)', color: 'var(--info)' }}>
            <TrendingUp size={22} />
          </div>
          <div className="student-stat-meta">
            <span className="student-stat-title">Tingkat Realisasi</span>
            <strong className="student-stat-number" style={{ color: 'var(--info)' }}>
              {dynamicStats.percentagePaid}%
            </strong>
          </div>
        </div>
      </div>

      {/* Main Panel Card (Table & Toolbar Aligned with BillsPage & StudentsPage) */}
      <div className="panel-card">
        {/* Toolbar & Filters */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
          {/* Top Row: Search Input + Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div className="search-input-wrap" style={{ flex: 1, maxWidth: 440 }}>
              <Search size={16} />
              <input
                type="text"
                placeholder="Cari NIM, nama mahasiswa, prodi, angkatan..."
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    setPage(1);
                  }}
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
                onClick={() => {
                  fetchReport();
                  fetchMasterOptions();
                }}
                title="Segarkan Data"
              >
                <RefreshCw size={15} className={loading ? 'spin' : ''} />
                <span>Segarkan</span>
              </button>

              <button
                type="button"
                className="btn btn-primary"
                style={{ height: 38 }}
                onClick={handleExportCSV}
                disabled={loading || !filteredAndSortedStudents.length}
                title="Ekspor Data Rekapitulasi ke CSV"
              >
                <Download size={15} />
                <span>Ekspor CSV</span>
              </button>
            </div>
          </div>

          {/* Bottom Row: Dedicated Filter Strip (Identical to BillsPage) */}
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10, padding: '10px 14px', background: '#f8fafc', border: '1px solid var(--line)', borderRadius: 'var(--radius-md)' }}>
            <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--muted)', marginRight: 4 }}>
              Filter:
            </span>

            {/* Filter Program Studi */}
            <select
              className="select-filter"
              style={{ minWidth: 180, flex: '1 1 180px' }}
              value={selectedProdi}
              onChange={(e) => {
                setSelectedProdi(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Semua Program Studi</option>
              {prodis.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>

            {/* Filter Periode Tagihan */}
            <select
              className="select-filter"
              style={{ minWidth: 140, flex: '1 1 140px' }}
              value={selectedPeriod}
              onChange={(e) => {
                setSelectedPeriod(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Semua Periode</option>
              {periods.map((p) => (
                <option key={p.id || p.code} value={p.code}>
                  {p.name} ({p.code})
                </option>
              ))}
            </select>

            {/* Filter Periode Masuk / Angkatan */}
            <select
              className="select-filter"
              style={{ minWidth: 150, flex: '1 1 150px' }}
              value={selectedEntryPeriod}
              onChange={(e) => {
                setSelectedEntryPeriod(e.target.value);
                setPage(1);
              }}
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

            {/* Filter Status Pembayaran */}
            <select
              className="select-filter"
              style={{ minWidth: 140, flex: '1 1 140px' }}
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Semua Status</option>
              <option value="unpaid">Belum Lunas</option>
              <option value="partial">Bayar Sebagian</option>
              <option value="paid">Lunas</option>
            </select>

            {/* Urutan / Sorting */}
            <select
              className="select-filter"
              style={{ minWidth: 160, flex: '1 1 160px' }}
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value);
                setPage(1);
              }}
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
                className="btn btn-secondary"
                style={{ height: 38, padding: '0 12px', color: '#b91c1c' }}
                onClick={handleResetFilters}
                title="Reset Semua Filter"
              >
                <X size={14} />
                <span>Reset Filter</span>
              </button>
            )}
          </div>

          {/* Active Filter Chips Bar & Result Count (Identical to BillsPage) */}
          {hasActiveFilter && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, paddingTop: 4 }}>
              <div className="filter-chips-container" style={{ paddingTop: 0 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Filter size={13} /> Filter Aktif:
                </span>

                {query && (
                  <span className="filter-chip">
                    <span className="filter-chip-label">Cari:</span> &ldquo;{query}&rdquo;
                    <button type="button" className="filter-chip-close" onClick={() => { setQuery(''); setPage(1); }}>
                      <X size={12} />
                    </button>
                  </span>
                )}

                {activeProdiObj && (
                  <span className="filter-chip">
                    <span className="filter-chip-label">Prodi:</span> {activeProdiObj.name}
                    <button type="button" className="filter-chip-close" onClick={() => { setSelectedProdi(''); setPage(1); }}>
                      <X size={12} />
                    </button>
                  </span>
                )}

                {activePeriodObj && (
                  <span className="filter-chip">
                    <span className="filter-chip-label">Periode:</span> {activePeriodObj.name}
                    <button type="button" className="filter-chip-close" onClick={() => { setSelectedPeriod(''); setPage(1); }}>
                      <X size={12} />
                    </button>
                  </span>
                )}

                {selectedEntryPeriod && (
                  <span className="filter-chip">
                    <span className="filter-chip-label">Periode Masuk:</span> {selectedEntryPeriod}
                    <button type="button" className="filter-chip-close" onClick={() => { setSelectedEntryPeriod(''); setPage(1); }}>
                      <X size={12} />
                    </button>
                  </span>
                )}

                {selectedStatus && (
                  <span className="filter-chip">
                    <span className="filter-chip-label">Status:</span>{' '}
                    {selectedStatus === 'paid' ? 'Lunas' : selectedStatus === 'partial' ? 'Bayar Sebagian' : 'Belum Lunas'}
                    <button type="button" className="filter-chip-close" onClick={() => { setSelectedStatus(''); setPage(1); }}>
                      <X size={12} />
                    </button>
                  </span>
                )}

                {sortBy !== 'amount_desc' && (
                  <span className="filter-chip">
                    <span className="filter-chip-label">Urutan:</span> {sortBy}
                    <button type="button" className="filter-chip-close" onClick={() => { setSortBy('amount_desc'); setPage(1); }}>
                      <X size={12} />
                    </button>
                  </span>
                )}
              </div>

              <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>
                Menampilkan <strong>{paginatedStudents.length}</strong> dari <strong>{totalCount}</strong> mahasiswa
              </span>
            </div>
          )}
        </div>

        {/* Data Table */}
        {loading ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 32,
                height: 32,
                border: '3px solid var(--line)',
                borderTopColor: 'var(--brand)',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }}
            />
            <p style={{ fontSize: 13, fontWeight: 600 }}>Memuat data rekapitulasi keuangan...</p>
          </div>
        ) : !filteredAndSortedStudents.length ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--muted)' }}>
            <FileText size={48} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
            <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>Tidak ada data rekapitulasi keuangan</p>
            <p style={{ fontSize: 13, marginTop: 4 }}>
              {hasActiveFilter
                ? 'Tidak ditemukan data keuangan yang sesuai dengan kriteria filter.'
                : 'Belum ada data tagihan atau mahasiswa di sistem.'}
            </p>
            {hasActiveFilter && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleResetFilters}
                style={{ marginTop: 12 }}
              >
                Reset Semua Filter
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: 40, textAlign: 'center' }}>No</th>
                    <th>Mahasiswa</th>
                    <th>Program Studi</th>
                    <th>Angkatan</th>
                    <th style={{ textAlign: 'center' }}>Tagihan</th>
                    <th style={{ textAlign: 'right' }}>Total Terbit</th>
                    <th style={{ textAlign: 'right' }}>Total Terbayar</th>
                    <th style={{ textAlign: 'right' }}>Sisa Piutang</th>
                    <th style={{ textAlign: 'center' }}>Status Realisasi</th>
                    <th style={{ width: 80, textAlign: 'center' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedStudents.map((s, idx) => {
                    const rowNum = (page - 1) * limit + idx + 1;
                    const isPaid = s.status === 'paid';
                    const isPartial = s.status === 'partial';

                    return (
                      <tr key={s.student_id || idx}>
                        <td style={{ textAlign: 'center', fontSize: 12, color: 'var(--muted)' }}>
                          {rowNum}
                        </td>
                        <td>
                          <div style={{ fontWeight: 700, color: 'var(--ink)', fontSize: 13.5 }}>
                            {s.full_name}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6, fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                            <span>NIM: <strong className="mono-font">{s.nim}</strong></span>
                            {s.nim && s.nim !== '-' && (
                              <button
                                type="button"
                                className="copy-btn-inline"
                                onClick={() => handleCopy(s.nim, `NIM ${s.full_name}`)}
                                title="Salin NIM"
                              >
                                {copiedKey === `NIM ${s.full_name}` ? <Check size={11} color="var(--success)" /> : <Copy size={11} />}
                              </button>
                            )}
                            {s.phone_number && s.phone_number !== '-' && (
                              <>
                                <span>•</span>
                                <span>WA: <strong className="mono-font">{s.phone_number}</strong></span>
                                <button
                                  type="button"
                                  className="copy-btn-inline"
                                  onClick={() => handleCopy(s.phone_number, `WA ${s.full_name}`)}
                                  title="Salin No. WhatsApp"
                                >
                                  {copiedKey === `WA ${s.full_name}` ? <Check size={11} color="var(--success)" /> : <Copy size={11} />}
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                        <td>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
                            {s.program_study}
                          </div>
                        </td>
                        <td>
                          <span className="badge badge-neutral" style={{ fontSize: 11.5 }}>
                            {s.entry_period}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 600, fontSize: 13 }}>
                          {s.total_bills}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>
                          {s.billed_amount_formatted}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--success)' }}>
                          {s.paid_amount_formatted}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: s.outstanding_amount > 0 ? 'var(--danger)' : 'var(--muted)' }}>
                          {s.outstanding_amount_formatted}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span
                            className={`badge ${isPaid ? 'badge-success' : isPartial ? 'badge-warning' : 'badge-danger'}`}
                            style={{ fontSize: 11.5, padding: '3px 8px' }}
                          >
                            {isPaid ? 'LUNAS' : isPartial ? `SEBAGIAN (${s.percentage_paid}%)` : 'BELUM BAYAR'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'inline-flex', gap: 4 }}>
                            {navigateTo && s.student_id && (
                              <button
                                type="button"
                                className="btn-icon"
                                onClick={() => navigateTo('student-profile', { studentId: s.student_id, initialTab: 'bills' })}
                                title="Buka Profil & Tagihan Mahasiswa"
                              >
                                <User size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls (Identical to BillsPage) */}
            {totalPages > 1 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 12,
                  marginTop: 18,
                  paddingTop: 14,
                  borderTop: '1px solid var(--line)',
                }}
              >
                <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                  Halaman <strong>{page}</strong> dari <strong>{totalPages}</strong> ({totalCount} Total Mahasiswa)
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={page <= 1}
                    onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  >
                    <ChevronLeft size={14} />
                    <span>Sebelumnya</span>
                  </button>

                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                  >
                    <span>Berikutnya</span>
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
