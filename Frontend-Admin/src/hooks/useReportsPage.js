import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useToast } from '../components/common/Toast';
import { reportsApi } from '../services/reportsApi.js';
import { isAbortError } from '../services/http.js';
import {
  calculateReportStats,
  createFinancialReportCsv,
  filterAndSortReportStudents,
} from '../utils/reports.js';
import { useCopyFeedback } from './useCopyFeedback';
import { useMasterOptions } from './useMasterOptions.js';
import { usePagination } from './usePagination.js';

const PAGE_SIZE = 50;

export function useReportsPage() {
  const { showToast } = useToast();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [selectedProdi, setSelectedProdi] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState('');
  const [selectedEntryPeriod, setSelectedEntryPeriod] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [sortBy, setSortBy] = useState('amount_desc');
  const { prodis, periods, reloadMasterOptions } = useMasterOptions(
    'Gagal memuat opsi filter laporan.',
  );
  const { copiedKey, copyToClipboard } = useCopyFeedback();

  const activeRequestRef = useRef(null);

  const fetchReport = useCallback(async () => {
    if (activeRequestRef.current) {
      activeRequestRef.current.abort();
    }
    const controller = new AbortController();
    activeRequestRef.current = controller;

    setLoading(true);
    try {
      const data = await reportsApi.getFinancialSummary(
        {
          period: selectedPeriod,
          study_program_id: selectedProdi,
          entry_period: selectedEntryPeriod,
        },
        { signal: controller.signal },
      );

      if (activeRequestRef.current === controller) {
        setReport(data);
      }
    } catch (error) {
      if (isAbortError(error)) return;
      if (activeRequestRef.current === controller) {
        showToast(error.message || 'Gagal memuat rekapitulasi keuangan.', 'error');
      }
    } finally {
      if (activeRequestRef.current === controller) {
        setLoading(false);
        activeRequestRef.current = null;
      }
    }
  }, [selectedPeriod, selectedProdi, selectedEntryPeriod, showToast]);

  useEffect(() => {
    fetchReport();
    return () => {
      if (activeRequestRef.current) {
        activeRequestRef.current.abort();
        activeRequestRef.current = null;
      }
    };
  }, [fetchReport]);

  const students = useMemo(
    () =>
      filterAndSortReportStudents(report?.by_student || [], {
        query,
        selectedStatus,
        sortBy,
      }),
    [report, query, selectedStatus, sortBy],
  );
  const totalCount = students.length;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE) || 1;
  const { page, setPage } = usePagination(totalPages);
  const paginatedStudents = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return students.slice(start, start + PAGE_SIZE);
  }, [students, page]);
  const stats = useMemo(() => calculateReportStats(students), [students]);
  const hasActiveFilter = Boolean(
    query ||
    selectedProdi ||
    selectedPeriod ||
    selectedEntryPeriod ||
    selectedStatus ||
    sortBy !== 'amount_desc',
  );

  const updateFilter = (setter, value) => {
    setter(value);
    setPage(1);
  };
  const resetFilters = () => {
    setQuery('');
    setSelectedProdi('');
    setSelectedPeriod('');
    setSelectedEntryPeriod('');
    setSelectedStatus('');
    setSortBy('amount_desc');
    setPage(1);
  };
  const refresh = () => {
    fetchReport();
    reloadMasterOptions();
  };
  const copy = (text, label) => {
    copyToClipboard(text, label, () => showToast(`${label} disalin!`, 'success'));
  };
  const selectAllStatus = () => updateFilter(setSelectedStatus, '');
  const togglePaidStatus = () =>
    updateFilter(setSelectedStatus, selectedStatus === 'paid' ? '' : 'paid');
  const cycleOutstandingStatus = () =>
    updateFilter(
      setSelectedStatus,
      selectedStatus === 'partial' ? 'unpaid' : selectedStatus === 'unpaid' ? '' : 'partial',
    );

  const activeProdi = prodis.find((item) => item.id === selectedProdi);
  const activePeriod = periods.find((item) => item.code === selectedPeriod);
  const activeFilterChips = [
    query && {
      key: 'query',
      label: 'Cari',
      value: `“${query}”`,
      onRemove: () => updateFilter(setQuery, ''),
    },
    activeProdi && {
      key: 'study-program',
      label: 'Prodi',
      value: activeProdi.name,
      onRemove: () => updateFilter(setSelectedProdi, ''),
    },
    activePeriod && {
      key: 'academic-period',
      label: 'Periode',
      value: activePeriod.name,
      onRemove: () => updateFilter(setSelectedPeriod, ''),
    },
    selectedEntryPeriod && {
      key: 'entry-period',
      label: 'Periode Masuk',
      value: selectedEntryPeriod,
      onRemove: () => updateFilter(setSelectedEntryPeriod, ''),
    },
    selectedStatus && {
      key: 'status',
      label: 'Status',
      value:
        selectedStatus === 'paid'
          ? 'Lunas'
          : selectedStatus === 'partial'
            ? 'Bayar Sebagian'
            : 'Belum Lunas',
      onRemove: () => updateFilter(setSelectedStatus, ''),
    },
    sortBy !== 'amount_desc' && {
      key: 'sort',
      label: 'Urutan',
      value: sortBy,
      onRemove: () => updateFilter(setSortBy, 'amount_desc'),
    },
  ];

  const exportCsv = () => {
    if (!students.length) {
      showToast('Tidak ada data untuk diekspor.', 'error');
      return;
    }
    const blob = new Blob([createFinancialReportCsv(students)], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `Rekap_Keuangan_SALUT_${new Date().toISOString().slice(0, 10)}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast(`Berhasil mengekspor ${students.length} data ke CSV.`, 'success');
  };

  return {
    loading,
    filters: { query, selectedProdi, selectedPeriod, selectedEntryPeriod, selectedStatus, sortBy },
    options: { prodis, periods },
    students,
    paginatedStudents,
    stats,
    copiedKey,
    hasActiveFilter,
    activeFilterChips,
    pagination: { page, totalPages, totalCount, pageSize: PAGE_SIZE, setPage },
    actions: {
      setQuery: (value) => updateFilter(setQuery, value),
      setSelectedProdi: (value) => updateFilter(setSelectedProdi, value),
      setSelectedPeriod: (value) => updateFilter(setSelectedPeriod, value),
      setSelectedEntryPeriod: (value) => updateFilter(setSelectedEntryPeriod, value),
      setSelectedStatus: (value) => updateFilter(setSelectedStatus, value),
      setSortBy: (value) => updateFilter(setSortBy, value),
      resetFilters,
      refresh,
      copy,
      exportCsv,
      selectAllStatus,
      togglePaidStatus,
      cycleOutstandingStatus,
    },
  };
}
