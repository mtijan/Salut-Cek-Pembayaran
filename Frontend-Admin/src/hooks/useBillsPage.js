import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useToast } from '../components/common/Toast';
import { billsApi } from '../services/billsApi.js';
import { isAbortError } from '../services/http.js';
import { useCopyFeedback } from './useCopyFeedback';
import { useMasterOptions } from './useMasterOptions.js';
import { usePagination } from './usePagination.js';

const PAGE_SIZE = 100;

export function useBillsPage() {
  const { showToast } = useToast();
  const [bills, setBills] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [serverPagination, setServerPagination] = useState({ total_pages: 1 });
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [selectedProdi, setSelectedProdi] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState('');
  const [selectedEntryPeriod, setSelectedEntryPeriod] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedActivation, setSelectedActivation] = useState('active');
  const [sortBy, setSortBy] = useState('updated_desc');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [historyTarget, setHistoryTarget] = useState(null);
  const [historyList, setHistoryList] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [activationTarget, setActivationTarget] = useState(null);
  const totalPages = Number(serverPagination.total_pages) || Math.ceil(totalCount / PAGE_SIZE) || 1;
  const { page, setPage } = usePagination(totalPages);
  const { prodis, periods, reloadMasterOptions } = useMasterOptions(
    'Gagal memuat opsi filter tagihan.',
  );
  const { copiedKey, copyToClipboard } = useCopyFeedback();

  const activeRequestRef = useRef(null);

  const fetchBills = useCallback(async () => {
    if (activeRequestRef.current) {
      activeRequestRef.current.abort();
    }
    const controller = new AbortController();
    activeRequestRef.current = controller;

    setLoading(true);
    try {
      const response = await billsApi.list(
        {
          query: query.trim(),
          study_program_id: selectedProdi,
          period: selectedPeriod,
          entry_period: selectedEntryPeriod,
          status: selectedStatus,
          activation: selectedActivation,
          sort_by: sortBy,
          limit: PAGE_SIZE,
          offset: (page - 1) * PAGE_SIZE,
        },
        { signal: controller.signal },
      );

      if (activeRequestRef.current === controller) {
        const pagination = response.pagination || {};
        setBills(response.bills || []);
        setServerPagination(pagination);
        setTotalCount(Number(pagination.total) || 0);
        setSummary(response.summary || null);
      }
    } catch (error) {
      if (isAbortError(error)) return;
      if (activeRequestRef.current === controller) {
        showToast(error.message || 'Gagal memuat daftar tagihan.', 'error');
      }
    } finally {
      if (activeRequestRef.current === controller) {
        setLoading(false);
        activeRequestRef.current = null;
      }
    }
  }, [
    query,
    selectedProdi,
    selectedPeriod,
    selectedEntryPeriod,
    selectedStatus,
    selectedActivation,
    sortBy,
    page,
    showToast,
  ]);

  useEffect(() => {
    fetchBills();
    return () => {
      if (activeRequestRef.current) {
        activeRequestRef.current.abort();
        activeRequestRef.current = null;
      }
    };
  }, [fetchBills]);

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
    const result = bills.reduce(
      (current, bill) => {
        const amount = Number(bill.amount) || 0;
        const paid = Number(bill.paid_amount) || 0;
        const remaining = Number(bill.remaining_amount) || Math.max(0, amount - paid);
        current.totalNominal += amount;
        current.totalPaid += paid;
        current.totalRemaining += remaining;
        if (bill.status === 'paid') current.paidCount += 1;
        else if (bill.status === 'partial') current.partialCount += 1;
        else current.unpaidCount += 1;
        return current;
      },
      {
        totalNominal: 0,
        totalPaid: 0,
        totalRemaining: 0,
        paidCount: 0,
        partialCount: 0,
        unpaidCount: 0,
      },
    );
    return {
      totalCount: totalCount || bills.length,
      studentCount: new Set(bills.map((bill) => bill.student_id).filter(Boolean)).size,
      ...result,
    };
  }, [summary, bills, totalCount]);

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
    setSelectedActivation('active');
    setSortBy('updated_desc');
    setPage(1);
  };
  const hasActiveFilter = Boolean(
    query ||
    selectedProdi ||
    selectedPeriod ||
    selectedEntryPeriod ||
    selectedStatus ||
    selectedActivation !== 'active' ||
    sortBy !== 'updated_desc',
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
    selectedActivation !== 'active' && {
      key: 'activation',
      label: 'Aktivasi',
      value: selectedActivation === 'inactive' ? 'Nonaktif' : 'Semua',
      onRemove: () => updateFilter(setSelectedActivation, 'active'),
    },
    sortBy !== 'updated_desc' && {
      key: 'sort',
      label: 'Urutan',
      value: sortBy,
      onRemove: () => updateFilter(setSortBy, 'updated_desc'),
    },
  ];

  const openHistory = async (bill) => {
    setHistoryTarget(bill);
    setHistoryLoading(true);
    try {
      const response = await billsApi.getTransactions(bill.id);
      setHistoryList(response.transactions || []);
    } catch (error) {
      showToast(error.message || 'Gagal memuat riwayat pembayaran.', 'error');
      setHistoryTarget(null);
    } finally {
      setHistoryLoading(false);
    }
  };
  const confirmDelete = async (reason) => {
    if (!deleteTarget) return;
    try {
      await billsApi.delete(deleteTarget.id, reason);
      showToast(`Tagihan ${deleteTarget.amount_formatted || ''} berhasil dihapus.`, 'success');
      setDeleteTarget(null);
      fetchBills();
    } catch (error) {
      showToast(error.message || 'Gagal menghapus tagihan.', 'error');
    }
  };

  const handleActivationApplied = async (result, isActive) => {
    const isAct =
      isActive !== undefined ? isActive : result?.bill ? Boolean(result.bill.is_active) : true;
    const actionText = isAct ? 'diaktifkan kembali' : 'dinonaktifkan';
    showToast(`Status tagihan berhasil ${actionText}.`, 'success');
    setActivationTarget(null);
    await fetchBills();
  };

  return {
    bills,
    loading,
    totalCount,
    stats,
    copiedKey,
    hasActiveFilter,
    activeFilterChips,
    filters: {
      query,
      selectedProdi,
      selectedPeriod,
      selectedEntryPeriod,
      selectedStatus,
      selectedActivation,
      sortBy,
    },
    options: { prodis, periods },
    pagination: { page, totalPages, pageSize: PAGE_SIZE, setPage },
    history: { target: historyTarget, list: historyList, loading: historyLoading },
    deleteTarget,
    activation: { target: activationTarget },
    actions: {
      setQuery: (value) => updateFilter(setQuery, value),
      setSelectedProdi: (value) => updateFilter(setSelectedProdi, value),
      setSelectedPeriod: (value) => updateFilter(setSelectedPeriod, value),
      setSelectedEntryPeriod: (value) => updateFilter(setSelectedEntryPeriod, value),
      setSelectedStatus: (value) => updateFilter(setSelectedStatus, value),
      setSelectedActivation: (value) => updateFilter(setSelectedActivation, value),
      setSortBy: (value) => updateFilter(setSortBy, value),
      selectAllStatus: () => updateFilter(setSelectedStatus, ''),
      togglePaidStatus: () =>
        updateFilter(setSelectedStatus, selectedStatus === 'paid' ? '' : 'paid'),
      cycleOutstandingStatus: () =>
        updateFilter(
          setSelectedStatus,
          selectedStatus === 'partial' ? 'unpaid' : selectedStatus === 'unpaid' ? '' : 'partial',
        ),
      resetFilters,
      refresh: () => {
        fetchBills();
        reloadMasterOptions();
      },
      copy: (text, label) =>
        copyToClipboard(text, label, () => showToast(`${label} disalin!`, 'success')),
      openHistory,
      closeHistory: () => setHistoryTarget(null),
      setDeleteTarget,
      confirmDelete,
      setActivationTarget,
      closeActivation: () => {
        setActivationTarget(null);
      },
      handleActivationApplied,
    },
  };
}
