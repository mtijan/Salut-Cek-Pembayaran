import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Search, Plus, Edit2, Trash2, ChevronLeft, ChevronRight, CheckCircle2,
  RefreshCw, AlertCircle, Info, DollarSign, UserCheck, Clock, X, CreditCard,
  Building, Calendar, Filter, ArrowUpDown, Copy, Check, FileText, Sparkles,
  TrendingUp, AlertTriangle, CheckCheck, Layers, HelpCircle, Eye, Users, UserX
} from 'lucide-react';
import { billsApi, masterApi } from '../services/api';
import { useToast } from '../components/common/Toast';
import { useAuth } from '../context/AuthContext';
import ConfirmModal from '../components/common/ConfirmModal';

const formatRupiah = (val) => {
  const num = Number(val) || 0;
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
};

export default function BillsPage({ navigateTo }) {
  const { showToast } = useToast();
  const { can } = useAuth();

  const [bills, setBills] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [pagination, setPagination] = useState({ total: 0, limit: 100, offset: 0, page: 1, total_pages: 1 });
  const [loading, setLoading] = useState(true);

  // Filters
  const [query, setQuery] = useState('');
  const [selectedProdi, setSelectedProdi] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState('');
  const [selectedEntryPeriod, setSelectedEntryPeriod] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [sortBy, setSortBy] = useState('updated_desc');
  const [page, setPage] = useState(1);
  const limit = 100;

  // Master options
  const [prodis, setProdis] = useState([]);
  const [periods, setPeriods] = useState([]);

  // Copy state
  const [copiedKey, setCopiedKey] = useState(null);

  // Modal / Drawer state
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [historyTarget, setHistoryTarget] = useState(null);
  const [historyList, setHistoryList] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [summary, setSummary] = useState(null);

  const fetchMasterOptions = async () => {
    try {
      const [pRes, prRes] = await Promise.all([
        masterApi.listPeriods(),
        masterApi.listProdi(),
      ]);
      setPeriods(pRes.academic_periods || []);
      setProdis(prRes.study_programs || []);
    } catch {}
  };

  const fetchBills = useCallback(async () => {
    setLoading(true);
    try {
      const offset = (page - 1) * limit;
      const res = await billsApi.list({
        query: query.trim(),
        study_program_id: selectedProdi,
        period: selectedPeriod,
        entry_period: selectedEntryPeriod,
        status: selectedStatus,
        sort_by: sortBy,
        limit,
        offset,
      });
      const pageData = res.pagination || {};
      setBills(res.bills || []);
      setPagination(pageData);
      setTotalCount(Number(pageData.total) || 0);
      setSummary(res.summary || null);
    } catch (err) {
      showToast(err.message || 'Gagal memuat daftar tagihan.', 'error');
    } finally {
      setLoading(false);
    }
  }, [query, selectedProdi, selectedPeriod, selectedEntryPeriod, selectedStatus, sortBy, page, showToast]);

  useEffect(() => {
    fetchMasterOptions();
  }, []);

  useEffect(() => {
    fetchBills();
  }, [fetchBills]);

  // Statistics calculation for summary cards (uses backend aggregated summary when available)
  const stats = useMemo(() => {
    if (summary) {
      return {
        totalCount: Number(summary.total_count) || 0,
        studentCount: Number(summary.student_count) || 0,
        totalNominal: Number(summary.total_amount) || 0,
        totalPaid: Number(summary.total_paid) || 0,
        totalRemaining: Number(summary.total_remaining) || 0,
        paidCount: Number(summary.paid_count) || 0,
        partialCount: Number(summary.partial_count) || 0,
        unpaidCount: Number(summary.unpaid_count) || 0,
      };
    }

    let totalNominal = 0;
    let totalPaid = 0;
    let totalRemaining = 0;
    let paidCount = 0;
    let partialCount = 0;
    let unpaidCount = 0;

    bills.forEach((b) => {
      const amt = Number(b.amount) || 0;
      const paid = Number(b.paid_amount) || 0;
      const rem = Number(b.remaining_amount) || Math.max(0, amt - paid);
      totalNominal += amt;
      totalPaid += paid;
      totalRemaining += rem;

      if (b.status === 'paid') paidCount++;
      else if (b.status === 'partial') partialCount++;
      else unpaidCount++;
    });

    const uniqueStudents = new Set(bills.map((b) => b.student_id).filter(Boolean)).size;

    return {
      totalCount: totalCount || bills.length,
      studentCount: uniqueStudents,
      totalNominal,
      totalPaid,
      totalRemaining,
      paidCount,
      partialCount,
      unpaidCount,
    };
  }, [summary, bills, totalCount]);

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
    setSortBy('updated_desc');
    setPage(1);
  };

  const hasActiveFilter = Boolean(
    query || selectedProdi || selectedPeriod || selectedEntryPeriod || selectedStatus || sortBy !== 'updated_desc'
  );

  // Active filter label helpers for chips
  const activeProdiObj = prodis.find((p) => p.id === selectedProdi);
  const activePeriodObj = periods.find((p) => p.code === selectedPeriod);

  const handleDeleteConfirm = async (reason) => {
    if (!deleteTarget) return;
    try {
      await billsApi.delete(deleteTarget.id, reason);
      showToast(`Tagihan ${deleteTarget.amount_formatted || ''} berhasil dihapus.`, 'success');
      setDeleteTarget(null);
      fetchBills();
    } catch (err) {
      showToast(err.message || 'Gagal menghapus tagihan.', 'error');
    }
  };

  const handleOpenHistory = async (bill) => {
    setHistoryTarget(bill);
    setHistoryLoading(true);
    try {
      const res = await billsApi.getTransactions(bill.id);
      setHistoryList(res.transactions || []);
    } catch (err) {
      showToast(err.message || 'Gagal memuat riwayat pembayaran.', 'error');
      setHistoryTarget(null);
    } finally {
      setHistoryLoading(false);
    }
  };

  const totalPages = Number(pagination.total_pages) || Math.ceil(totalCount / limit) || 1;

  return (
    <div>
      {/* Summary Statistics Bar (Aligned with StudentsPage) */}
      <div className="student-stats-row">
        <div
          className={`student-stat-card ${!selectedStatus ? 'is-active' : ''}`}
          onClick={() => {
            setSelectedStatus('');
            setPage(1);
          }}
          style={{ cursor: 'pointer' }}
          title="Klik untuk menampilkan seluruh tagihan"
        >
          <div className="student-stat-icon" style={{ background: 'var(--brand-surface)', color: 'var(--brand)' }}>
            <FileText size={22} />
          </div>
          <div className="student-stat-meta">
            <span className="student-stat-title">Total Tagihan</span>
            <strong className="student-stat-number">{stats.totalCount.toLocaleString('id-ID')}</strong>
            <span style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>
              {stats.studentCount > 0 ? `Dari ${stats.studentCount.toLocaleString('id-ID')} mahasiswa` : 'Tidak ada data'}
            </span>
          </div>
        </div>

        <div
          className={`student-stat-card ${selectedStatus === 'paid' ? 'is-active' : ''}`}
          onClick={() => {
            setSelectedStatus(selectedStatus === 'paid' ? '' : 'paid');
            setPage(1);
          }}
          style={{ cursor: 'pointer' }}
          title="Klik untuk filter tagihan lunas"
        >
          <div className="student-stat-icon" style={{ background: 'var(--success-bg)', color: 'var(--success)' }}>
            <CheckCircle2 size={22} />
          </div>
          <div className="student-stat-meta">
            <span className="student-stat-title">Total Terbayar</span>
            <strong className="student-stat-number" style={{ color: 'var(--success)' }}>
              {formatRupiah(stats.totalPaid)}
            </strong>
            <span style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>
              {stats.paidCount.toLocaleString('id-ID')} tagihan lunas
            </span>
          </div>
        </div>

        <div
          className={`student-stat-card ${selectedStatus === 'partial' || selectedStatus === 'unpaid' ? 'is-active' : ''}`}
          onClick={() => {
            setSelectedStatus(selectedStatus === 'partial' ? 'unpaid' : selectedStatus === 'unpaid' ? '' : 'partial');
            setPage(1);
          }}
          style={{ cursor: 'pointer' }}
          title="Klik untuk beralih filter Cicilan / Belum Lunas"
        >
          <div className="student-stat-icon" style={{ background: 'var(--warning-bg)', color: 'var(--warning)' }}>
            <Clock size={22} />
          </div>
          <div className="student-stat-meta">
            <span className="student-stat-title">Sisa Tunggakan</span>
            <strong className="student-stat-number" style={{ color: stats.totalRemaining > 0 ? 'var(--warning)' : 'var(--success)' }}>
              {formatRupiah(stats.totalRemaining)}
            </strong>
            <span style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>
              {(stats.unpaidCount + stats.partialCount).toLocaleString('id-ID')} tagihan belum lunas
            </span>
          </div>
        </div>

        <div className="student-stat-card">
          <div className="student-stat-icon" style={{ background: 'var(--info-bg)', color: 'var(--info)' }}>
            <CreditCard size={22} />
          </div>
          <div className="student-stat-meta">
            <span className="student-stat-title">Total Nominal Piutang</span>
            <strong className="student-stat-number" style={{ color: 'var(--info)' }}>
              {formatRupiah(stats.totalNominal)}
            </strong>
            <span style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>
              {hasActiveFilter ? 'Akumulasi sesuai filter aktif' : 'Akumulasi seluruh tagihan'}
            </span>
          </div>
        </div>
      </div>

      {/* Main Panel Card (Table & Toolbar Aligned with StudentsPage) */}
      <div className="panel-card">
        {/* Toolbar & Filters */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
          {/* Top Row: Search Input + Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div className="search-input-wrap" style={{ flex: 1, maxWidth: 440 }}>
              <Search size={16} />
              <input
                type="text"
                placeholder="Cari NIM, nama, no BRIVA, jenis tagihan..."
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
                  fetchBills();
                  fetchMasterOptions();
                }}
                title="Segarkan Data"
              >
                <RefreshCw size={15} />
                <span>Segarkan</span>
              </button>

              {can('manage_billing') && (
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ height: 38 }}
                  onClick={() => {
                    if (navigateTo) navigateTo('bill-edit', { mode: 'create' });
                  }}
                >
                  <Plus size={16} />
                  <span>Buat Tagihan Baru</span>
                </button>
              )}
            </div>
          </div>

          {/* Bottom Row: Dedicated Filter Strip */}
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
                <option key={p.id} value={p.code}>
                  {p.name} ({p.code})
                </option>
              ))}
            </select>

            {/* Filter Periode Masuk */}
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
                onClick={handleResetFilters}
                title="Reset Semua Filter"
              >
                <X size={14} />
                <span>Reset Filter</span>
              </button>
            )}
          </div>

          {/* Active Filter Chips Bar & Result Count */}
          {hasActiveFilter && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, paddingTop: 4 }}>
              <div className="filter-chips-container" style={{ paddingTop: 0 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Filter size={13} /> Filter Aktif:
                </span>

                {query && (
                  <span className="filter-chip">
                    <span className="filter-chip-label">Cari:</span> &ldquo;{query}&rdquo;
                    <button type="button" className="filter-chip-close" onClick={() => setQuery('')}>
                      <X size={12} />
                    </button>
                  </span>
                )}

                {activeProdiObj && (
                  <span className="filter-chip">
                    <span className="filter-chip-label">Prodi:</span> {activeProdiObj.name}
                    <button type="button" className="filter-chip-close" onClick={() => setSelectedProdi('')}>
                      <X size={12} />
                    </button>
                  </span>
                )}

                {activePeriodObj && (
                  <span className="filter-chip">
                    <span className="filter-chip-label">Periode:</span> {activePeriodObj.name}
                    <button type="button" className="filter-chip-close" onClick={() => setSelectedPeriod('')}>
                      <X size={12} />
                    </button>
                  </span>
                )}

                {selectedEntryPeriod && (
                  <span className="filter-chip">
                    <span className="filter-chip-label">Periode Masuk:</span> {selectedEntryPeriod}
                    <button type="button" className="filter-chip-close" onClick={() => setSelectedEntryPeriod('')}>
                      <X size={12} />
                    </button>
                  </span>
                )}

                {selectedStatus && (
                  <span className="filter-chip">
                    <span className="filter-chip-label">Status:</span>{' '}
                    {selectedStatus === 'paid' ? 'Lunas' : selectedStatus === 'partial' ? 'Bayar Sebagian' : 'Belum Lunas'}
                    <button type="button" className="filter-chip-close" onClick={() => setSelectedStatus('')}>
                      <X size={12} />
                    </button>
                  </span>
                )}

                {sortBy !== 'updated_desc' && (
                  <span className="filter-chip">
                    <span className="filter-chip-label">Urutan:</span> {sortBy}
                    <button type="button" className="filter-chip-close" onClick={() => setSortBy('updated_desc')}>
                      <X size={12} />
                    </button>
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Context bar showing matched rows and students */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, padding: '9px 14px', background: 'var(--brand-surface, #f8fafc)', borderRadius: 8, border: '1px solid var(--border-color, #e2e8f0)', fontSize: 12.5, color: 'var(--text-secondary, #475569)', marginBottom: 16 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <FileText size={14} style={{ color: 'var(--brand)' }} />
            <span>
              Menampilkan <strong>{bills.length}</strong> baris dari total <strong>{totalCount.toLocaleString('id-ID')}</strong> tagihan milik <strong>{stats.studentCount.toLocaleString('id-ID')}</strong> mahasiswa{hasActiveFilter ? ' (sesuai filter yang diterapkan)' : ' (seluruh data)'}
            </span>
          </span>
          <span style={{ color: 'var(--muted)', fontWeight: 500, fontSize: 12 }}>
            Halaman {page} dari {totalPages}
          </span>
        </div>

        {/* Data Table */}
        {loading ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <RefreshCw size={28} className="spin" style={{ color: 'var(--brand)' }} />
            <span>Memuat data tagihan...</span>
          </div>
        ) : bills.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--muted)' }}>
            <AlertCircle size={36} style={{ color: 'var(--muted-light)', marginBottom: 10 }} />
            <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)', margin: 0 }}>
              Tidak ada data tagihan yang sesuai
            </h3>
            <p style={{ fontSize: 13, margin: '6px 0 0 0' }}>
              Coba sesuaikan kata kunci pencarian atau ubah filter di atas.
            </p>
            {hasActiveFilter && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="btn btn-secondary"
                style={{ marginTop: 14, fontSize: 13 }}
              >
                Reset Semua Filter
              </button>
            )}
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '28%' }}>MAHASISWA</th>
                  <th style={{ width: '14%' }}>PERIODE & JENIS</th>
                  <th style={{ width: '18%' }}>NOMINAL & TERBAYAR</th>
                  <th style={{ width: '13%', textAlign: 'center' }}>STATUS</th>
                  <th style={{ width: '12%' }}>JATUH TEMPO</th>
                  <th style={{ width: '15%' }}>NOMOR BRIVA</th>
                  <th style={{ width: '10%', textAlign: 'right' }}>AKSI</th>
                </tr>
              </thead>
              <tbody>
                {bills.map((b) => {
                  const amtNum = Number(b.amount) || 0;
                  const paidNum = Number(b.paid_amount) || 0;
                  const pct = amtNum > 0 ? Math.min(100, Math.round((paidNum / amtNum) * 100)) : 0;

                  return (
                    <tr key={b.id} className="table-row-modern">
                      {/* Mahasiswa Info */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: 'var(--radius-md)',
                              background: 'var(--brand-surface)',
                              color: 'var(--brand)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 14,
                              fontWeight: 700,
                              flexShrink: 0,
                            }}
                          >
                            {(b.student_name || b.full_name || 'M').charAt(0).toUpperCase()}
                          </div>

                          <div style={{ minWidth: 0 }}>
                            {b.student_id && navigateTo ? (
                              <button
                                type="button"
                                onClick={() => navigateTo('student-profile', { studentId: b.student_id })}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  padding: 0,
                                  fontWeight: 700,
                                  fontSize: 13.5,
                                  color: 'var(--brand-strong)',
                                  cursor: 'pointer',
                                  textAlign: 'left',
                                  display: 'block',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}
                                title="Buka Profil 360 Mahasiswa"
                              >
                                {b.student_name || b.full_name}
                              </button>
                            ) : (
                              <strong style={{ fontSize: 13.5, color: 'var(--ink)' }}>
                                {b.student_name || b.full_name}
                              </strong>
                            )}
                            <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                                {b.student_nim || b.nim}
                              </span>
                              {b.study_program_name && <span>&bull; {b.study_program_name}</span>}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Periode & Jenis */}
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                          <span
                            style={{
                              display: 'inline-block',
                              width: 'fit-content',
                              padding: '1px 6px',
                              borderRadius: 4,
                              fontSize: 11,
                              fontWeight: 700,
                              background: '#f1f5f9',
                              color: '#334155',
                              border: '1px solid #e2e8f0',
                            }}
                          >
                            {b.period}
                          </span>
                          <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)' }}>
                            {b.bill_type || 'UKT'}
                          </span>
                        </div>
                      </td>

                      {/* Nominal & Terbayar */}
                      <td>
                        <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--ink)' }}>
                          {b.amount_formatted || formatRupiah(b.amount)}
                        </div>
                        {b.status === 'partial' && (
                          <div style={{ fontSize: 11, marginTop: 3 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
                              <span style={{ color: 'var(--success)', fontWeight: 600 }}>
                                Terbayar: {b.paid_amount_formatted || formatRupiah(b.paid_amount)}
                              </span>
                              <span style={{ color: 'var(--warning)', fontWeight: 600 }}>
                                Sisa: {b.remaining_amount_formatted || formatRupiah(b.remaining_amount)}
                              </span>
                            </div>
                            <div className="micro-progress-wrap">
                              <div
                                className="micro-progress-bar"
                                style={{
                                  width: `${pct}%`,
                                  background: 'var(--warning)',
                                }}
                              />
                            </div>
                          </div>
                        )}
                        {b.status === 'paid' && (
                          <div style={{ fontSize: 11, color: 'var(--success)', fontWeight: 600, marginTop: 2 }}>
                            Lunas Penuh (100%)
                          </div>
                        )}
                      </td>

                      {/* Status Badge */}
                      <td style={{ textAlign: 'center' }}>
                        <span
                          className={`badge ${b.status === 'paid' ? 'badge-success' : b.status === 'partial' ? 'badge-warning' : 'badge-danger'}`}
                          style={{ cursor: can('manage_billing') && b.status !== 'paid' && navigateTo ? 'pointer' : 'default' }}
                          onClick={() => {
                            if (can('manage_billing') && b.status !== 'paid' && navigateTo) {
                              navigateTo('bill-payment', { billId: b.id });
                            }
                          }}
                          title={can('manage_billing') && b.status !== 'paid' ? 'Klik untuk bayar di kasir' : undefined}
                        >
                          {b.status === 'paid' ? 'Lunas' : b.status === 'partial' ? 'Bayar Sebagian' : 'Belum Lunas'}
                        </span>
                      </td>

                      {/* Due Date */}
                      <td style={{ fontSize: 12.5, color: 'var(--muted)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <Calendar size={13} style={{ color: 'var(--muted-light)' }} />
                          <span>{b.due_date_formatted || (b.due_date ? String(b.due_date).slice(0, 10) : '-')}</span>
                        </div>
                      </td>

                      {/* BRIVA */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span className="mono-tag">
                            {b.briva}
                          </span>
                          {b.briva && (
                            <button
                              type="button"
                              onClick={() => handleCopy(b.briva, `BRIVA ${b.briva}`)}
                              style={{ background: 'none', border: 'none', padding: 3, cursor: 'pointer', color: 'var(--muted)' }}
                              title="Salin BRIVA"
                            >
                              {copiedKey === `BRIVA ${b.briva}` ? <Check size={14} style={{ color: 'var(--success)' }} /> : <Copy size={14} />}
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                          {/* Bayar button */}
                          {can('manage_billing') && (
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              style={{ height: 30, padding: '0 8px', gap: 4 }}
                              onClick={() => {
                                if (navigateTo) navigateTo('bill-payment', { billId: b.id });
                              }}
                              title="Buka Kasir Pembayaran Tagihan"
                            >
                              <CreditCard size={13} />
                              <span>Bayar</span>
                            </button>
                          )}

                          {/* Riwayat mutasi */}
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{ height: 30, width: 30, padding: 0 }}
                            onClick={() => handleOpenHistory(b)}
                            title="Lihat Riwayat Transaksi"
                          >
                            <Clock size={13} />
                          </button>

                          {/* Edit bill */}
                          {can('manage_billing') && (
                            <>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                style={{ height: 30, width: 30, padding: 0 }}
                                onClick={() => {
                                  if (navigateTo) navigateTo('bill-edit', { billId: b.id });
                                }}
                                title="Edit Data Pokok Tagihan (Halaman Penuh)"
                              >
                                <Edit2 size={13} />
                              </button>

                              <button
                                type="button"
                                className="btn btn-danger btn-sm"
                                style={{ height: 30, width: 30, padding: 0 }}
                                onClick={() => setDeleteTarget(b)}
                                title="Hapus Tagihan"
                              >
                                <Trash2 size={13} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer (Aligned with StudentsPage) */}
        <div className="pagination-wrap">
          <div className="pagination-info">
            Menampilkan <strong>{(page - 1) * limit + 1}</strong> s.d. <strong>{Math.min(page * limit, totalCount)}</strong> dari <strong>{totalCount}</strong> tagihan
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div className="pagination-controls">
              <button
                type="button"
                className="pagination-btn"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft size={16} />
              </button>

              <span style={{ fontSize: 13, fontWeight: 600, padding: '0 8px', color: 'var(--ink)' }}>
                {page} / {totalPages}
              </span>

              <button
                type="button"
                className="pagination-btn"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Transaction History Modal Drawer */}
      {historyTarget && (
        <div className="modal-backdrop" onClick={() => setHistoryTarget(null)}>
          <div
            className="modal-dialog large"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            style={{ maxWidth: 640, borderRadius: 'var(--radius-lg)', padding: 24 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 14, borderBottom: '1px solid var(--line)', marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: 'var(--ink)' }}>
                  Riwayat Mutasi Pembayaran
                </h3>
                <p style={{ fontSize: 13, color: 'var(--muted)', margin: '2px 0 0 0' }}>
                  BRIVA: <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{historyTarget.briva}</span> &bull; {historyTarget.student_name || historyTarget.full_name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setHistoryTarget(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4 }}
              >
                <X size={20} />
              </button>
            </div>

            {historyLoading ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
                <RefreshCw size={24} className="spin" style={{ color: 'var(--brand)', marginBottom: 8 }} />
                <div>Memuat histori transaksi...</div>
              </div>
            ) : historyList.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--muted)' }}>
                <p style={{ margin: 0, fontSize: 14 }}>Belum ada catatan mutasi pembayaran untuk tagihan ini.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 400, overflowY: 'auto' }}>
                {historyList.map((tx, idx) => (
                  <div
                    key={tx.id || idx}
                    style={{
                      background: '#f8fafc',
                      border: '1px solid var(--line)',
                      borderRadius: 'var(--radius-md)',
                      padding: '12px 14px',
                      fontSize: 13,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontWeight: 700, color: 'var(--success)' }}>
                        +{formatRupiah(tx.amount)}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                        {tx.payment_date || tx.created_at?.slice(0, 10) || '-'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--muted)' }}>
                      <span>Metode: <strong>{tx.payment_method || 'BRIVA'}</strong></span>
                      <span>Ref: <strong>{tx.reference_number || '-'}</strong></span>
                    </div>
                    {tx.notes && (
                      <div style={{ fontSize: 12, color: 'var(--ink)', marginTop: 4, fontStyle: 'italic' }}>
                        &ldquo;{tx.notes}&rdquo;
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setHistoryTarget(null)}
                style={{ padding: '8px 16px', borderRadius: 'var(--radius-md)' }}
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <ConfirmModal
          isOpen={Boolean(deleteTarget)}
          title="Hapus Data Tagihan"
          message={`Apakah Anda yakin ingin menghapus tagihan sebesar ${deleteTarget.amount_formatted || formatRupiah(deleteTarget.amount)} untuk ${deleteTarget.student_name || deleteTarget.full_name}? Tindakan ini akan dicatat ke audit log.`}
          confirmLabel="Hapus Tagihan"
          danger
          requireReason
          reasonPlaceholder="Alasan penghapusan data tagihan..."
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
