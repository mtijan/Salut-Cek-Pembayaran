import { useState, useEffect, useCallback, useRef } from 'react';
import { billsApi } from '../services/billsApi';
import { studentsApi } from '../services/studentsApi';
import { masterApi } from '../services/masterApi';
import { useToast } from '../components/common/Toast';
import { useCopyFeedback } from './useCopyFeedback';
import {
  createBillFormData,
  initialBillFormData,
  selectDefaultPeriodCode,
} from '../features/billing/model/billEditorModel';

/**
 * Feature hook untuk mode create/edit pada halaman kelola tagihan terpadu.
 * Mengelola state, fetch, kalkulasi, dan handler form create/edit tagihan.
 * Container page bertanggung jawab atas navigasi dan layout.
 */
export function useBillEditor({ billId, mode, navigateTo, onSaved, enabled = true }) {
  const { showToast } = useToast();
  const isCreate = mode === 'create' || !billId;

  const [loading, setLoading] = useState(enabled && !isCreate);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const { copiedKey, copyToClipboard } = useCopyFeedback();
  const [formError, setFormError] = useState('');

  // Master data options
  const [periods, setPeriods] = useState([]);
  const [students, setStudents] = useState([]);
  const periodsRef = useRef([]);

  // Loaded bill & student (edit mode)
  const [loadedBill, setLoadedBill] = useState(null);
  const [loadedStudent, setLoadedStudent] = useState(null);

  const [formData, setFormData] = useState(initialBillFormData);

  const fetchMasterOptions = useCallback(async () => {
    if (!enabled) return;
    const [periodResult, studentResult] = await Promise.allSettled([
      masterApi.listPeriods(),
      studentsApi.list({ limit: 1000 }),
    ]);

    if (periodResult.status === 'fulfilled') {
      const nextPeriods = periodResult.value.academic_periods || [];
      periodsRef.current = nextPeriods;
      setPeriods(nextPeriods);
      if (isCreate) {
        setFormData((current) => {
          if (current.period || current.custom_period) return current;
          const defaultPeriod = selectDefaultPeriodCode(nextPeriods);
          return {
            ...current,
            period_mode: defaultPeriod ? 'master' : 'custom',
            period: defaultPeriod,
          };
        });
      }
    } else {
      showToast(periodResult.reason?.message || 'Gagal memuat opsi periode akademik.', 'error');
    }

    if (studentResult.status === 'fulfilled') {
      setStudents(studentResult.value.students || []);
    } else {
      showToast(studentResult.reason?.message || 'Gagal memuat pilihan mahasiswa.', 'error');
    }
  }, [enabled, isCreate, showToast]);

  const fetchBillData = useCallback(async () => {
    if (!enabled || isCreate || !billId) return;
    setLoading(true);
    setLoadError('');
    try {
      const res = await billsApi.getDetail(billId);
      const b = res.bill || {};
      const s = res.student || {};
      setLoadedBill(b);
      setLoadedStudent(s);

      setFormData(createBillFormData({ bill: b, student: s, periods: periodsRef.current }));
    } catch (err) {
      const message = err.message || 'Gagal memuat data tagihan.';
      setLoadError(message);
      showToast(message, 'error');
    } finally {
      setLoading(false);
    }
  }, [billId, enabled, isCreate, showToast]);

  useEffect(() => {
    fetchMasterOptions();
  }, [fetchMasterOptions]);

  useEffect(() => {
    fetchBillData();
  }, [fetchBillData]);

  useEffect(() => {
    if (isCreate || !loadedBill || periods.length === 0) return;
    const normalized = createBillFormData({
      bill: loadedBill,
      student: loadedStudent || {},
      periods,
    });
    if (normalized.period_mode !== 'master') return;

    setFormData((current) => {
      const stillHasOriginalCustomPeriod =
        current.period_mode === 'custom' && current.custom_period === (loadedBill.period || '');
      if (!stillHasOriginalCustomPeriod) return current;
      return {
        ...current,
        period_mode: normalized.period_mode,
        period: normalized.period,
        custom_period: '',
      };
    });
  }, [isCreate, loadedBill, loadedStudent, periods]);

  const handleCopy = (text, label) => {
    copyToClipboard(text, label, () => showToast(`${label} disalin ke clipboard!`, 'success'));
  };

  // Derived calculations
  const totalAmountNum = Number(formData.amount) || 0;
  const paidAmountNum = Number(formData.paid_amount) || 0;
  const remainingAmountNum = Math.max(0, totalAmountNum - paidAmountNum);

  const handleStatusChange = (status) => {
    setFormData((prev) => {
      let paidAmount = prev.paid_amount;
      const totalAmount = Number(prev.amount) || 0;
      if (status === 'paid') {
        paidAmount = String(totalAmount);
      } else if (status === 'unpaid') {
        paidAmount = '0';
      } else if (Number(paidAmount) <= 0 || Number(paidAmount) >= totalAmount) {
        paidAmount = String(Math.round(totalAmount / 2) || 500000);
      }
      return { ...prev, status, paid_amount: paidAmount };
    });
  };

  const handleAmountChange = (e) => {
    const value = e.target.value;
    const numericValue = Number(value) || 0;
    setFormData((prev) => {
      let paidAmount = prev.paid_amount;
      if (prev.status === 'paid') {
        paidAmount = String(numericValue);
      } else if (prev.status === 'partial' && Number(paidAmount) >= numericValue) {
        paidAmount = String(Math.round(numericValue / 2));
      }
      return { ...prev, amount: value, paid_amount: paidAmount };
    });
  };

  const handlePaidAmountChange = (e) => {
    const value = e.target.value;
    const numericValue = Number(value) || 0;
    let nextStatus = formData.status;
    if (numericValue <= 0) {
      nextStatus = 'unpaid';
    } else if (numericValue >= totalAmountNum && totalAmountNum > 0) {
      nextStatus = 'paid';
    } else {
      nextStatus = 'partial';
    }
    setFormData((prev) => ({ ...prev, paid_amount: value, status: nextStatus }));
  };

  const handleStudentSelect = (eventOrStudentId) => {
    const studentId = eventOrStudentId?.target?.value ?? eventOrStudentId;
    const student = students.find((s) => s.id === studentId);
    if (!student) {
      setFormData((prev) => ({ ...prev, student_id: '', nim: '', full_name: '' }));
      return;
    }
    setFormData((prev) => ({
      ...prev,
      student_id: student.id,
      nim: student.nim,
      full_name: student.full_name,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (isCreate && !formData.student_id && (!formData.nim || !formData.full_name)) {
      setFormError('Mahasiswa wajib dipilih atau lengkapi NIM & Nama.');
      return;
    }
    if (!formData.briva.trim()) {
      setFormError('Nomor BRIVA wajib diisi.');
      return;
    }
    if (totalAmountNum <= 0) {
      setFormError('Nominal tagihan harus berupa angka positif lebih dari 0.');
      return;
    }

    const finalPeriod =
      formData.period_mode === 'custom' ? formData.custom_period.trim() : formData.period;
    if (!finalPeriod) {
      setFormError('Periode tagihan wajib diisi.');
      return;
    }

    const finalBillType =
      formData.bill_type_mode === 'Custom'
        ? formData.custom_bill_type.trim()
        : formData.bill_type_mode;
    if (!finalBillType) {
      setFormError('Jenis tagihan wajib diisi.');
      return;
    }

    if (paidAmountNum > totalAmountNum) {
      setFormError('Nominal terbayar tidak boleh melebihi total nominal tagihan.');
      return;
    }

    const payload = {
      student_id: formData.student_id || undefined,
      nim: formData.nim || undefined,
      full_name: formData.full_name || undefined,
      period: finalPeriod,
      bill_type: finalBillType,
      amount: totalAmountNum,
      paid_amount: paidAmountNum,
      briva: formData.briva.trim(),
      status: formData.status,
      due_date: formData.due_date || null,
      instructions: formData.instructions.trim(),
    };

    setSaving(true);
    try {
      if (isCreate) {
        await billsApi.create(payload);
        showToast('Tagihan mahasiswa berhasil dibuat!', 'success');
      } else {
        await billsApi.update(billId, payload);
        showToast('Perubahan tagihan mahasiswa berhasil disimpan!', 'success');
      }
      if (onSaved) {
        await onSaved();
      } else {
        navigateTo('bills');
      }
    } catch (err) {
      setFormError(err.message || 'Gagal menyimpan data tagihan.');
      showToast(err.message || 'Gagal menyimpan data tagihan.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return {
    isCreate,
    loading,
    loadError,
    saving,
    formData,
    setFormData,
    formError,
    periods,
    students,
    loadedBill,
    loadedStudent,
    copiedKey,
    totalAmountNum,
    paidAmountNum,
    remainingAmountNum,
    handleCopy,
    handleStatusChange,
    handleAmountChange,
    handlePaidAmountChange,
    handleStudentSelect,
    handleSubmit,
    fetchBillData,
  };
}
