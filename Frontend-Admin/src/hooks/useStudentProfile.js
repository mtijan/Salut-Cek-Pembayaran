import { useCallback, useEffect, useState } from 'react';
import { useToast } from '../components/common/Toast';
import { studentsApi } from '../services/studentsApi';
import { masterApi } from '../services/masterApi';
import { useCopyFeedback } from './useCopyFeedback';

const EMPTY_EDIT_FORM = {
  nim: '',
  full_name: '',
  no_ktp: '',
  tempat_lahir: '',
  tanggal_lahir: '',
  nama_ibu_kandung: '',
  study_program_id: '',
  academic_status: 'aktif',
  entry_year: '',
  entry_semester: 'ganjil',
  entry_period: '',
  phone_number: '',
  email: '',
  address: '',
};

function toEditForm(student = {}) {
  return {
    nim: student.nim || '',
    full_name: student.full_name || '',
    no_ktp: student.no_ktp || '',
    tempat_lahir: student.tempat_lahir || '',
    tanggal_lahir: student.tanggal_lahir || '',
    nama_ibu_kandung: student.nama_ibu_kandung || '',
    study_program_id: student.study_program_id || '',
    academic_status: student.academic_status || 'aktif',
    entry_year: student.entry_year ? String(student.entry_year) : '',
    entry_semester: student.entry_semester || 'ganjil',
    entry_period: student.entry_period || '',
    phone_number: student.phone_number || '',
    email: student.email || '',
    address: student.address || '',
  };
}

export function useStudentProfile({ studentId, initialTab = 'profile' }) {
  const { showToast } = useToast();
  const { copiedKey, copyToClipboard } = useCopyFeedback();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(initialTab || 'profile');
  const [prodis, setProdis] = useState([]);
  const [historyList, setHistoryList] = useState([]);
  const [historyPagination, setHistoryPagination] = useState({ total: 0, limit: 50, offset: 0 });
  const [historyLoading, setHistoryLoading] = useState(false);
  const [editForm, setEditForm] = useState(EMPTY_EDIT_FORM);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState('');

  const fetchStudentData = useCallback(async () => {
    if (!studentId) return;
    setLoading(true);
    try {
      const result = await studentsApi.getDetail(studentId);
      const initialHistory = result?.payment_history || [];
      setData(result);
      setHistoryList(initialHistory);
      setHistoryPagination(
        result?.payment_history_pagination || {
          total: initialHistory.length,
          limit: 50,
          offset: 0,
        },
      );
      setEditForm(toEditForm(result?.student));
    } catch (error) {
      showToast(error.message || 'Gagal memuat profil mahasiswa.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast, studentId]);

  const fetchHistory = useCallback(
    async (offset = 0) => {
      if (!studentId) return;
      setHistoryLoading(true);
      try {
        const result = await studentsApi.getTransactions(studentId, { limit: 50, offset });
        const transactions = result.transactions || [];
        setHistoryList(transactions);
        setHistoryPagination(
          result.pagination || { total: transactions.length, limit: 50, offset },
        );
      } catch (error) {
        showToast(error.message || 'Gagal memuat riwayat mutasi pembayaran.', 'error');
      } finally {
        setHistoryLoading(false);
      }
    },
    [showToast, studentId],
  );

  useEffect(() => {
    fetchStudentData();
    masterApi
      .listProdi()
      .then((result) => setProdis(result.study_programs || []))
      .catch(() => {});
  }, [fetchStudentData]);

  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);

  const handleCopy = useCallback(
    (text, label) => {
      copyToClipboard(text, label, () => showToast(`${label} disalin ke clipboard!`, 'success'));
    },
    [copyToClipboard, showToast],
  );

  const saveEdit = async (event) => {
    event.preventDefault();
    if (!editForm.full_name.trim()) {
      setEditError('Nama lengkap mahasiswa wajib diisi.');
      return;
    }
    setSavingEdit(true);
    setEditError('');
    try {
      await studentsApi.update(studentId, {
        full_name: editForm.full_name.trim(),
        no_ktp: editForm.no_ktp.trim(),
        tempat_lahir: editForm.tempat_lahir.trim(),
        tanggal_lahir: editForm.tanggal_lahir.trim(),
        nama_ibu_kandung: editForm.nama_ibu_kandung.trim(),
        study_program_id: editForm.study_program_id || null,
        academic_status: editForm.academic_status,
        entry_year: editForm.entry_year ? Number(editForm.entry_year) : null,
        entry_semester: editForm.entry_semester,
        entry_period: editForm.entry_period.trim(),
        phone_number: editForm.phone_number.trim(),
        email: editForm.email.trim(),
        address: editForm.address.trim(),
      });
      showToast('Data mahasiswa berhasil diperbarui.', 'success');
      await fetchStudentData();
      setActiveTab('profile');
    } catch (error) {
      setEditError(error.message || 'Gagal memperbarui data mahasiswa.');
    } finally {
      setSavingEdit(false);
    }
  };

  return {
    activeTab,
    copiedKey,
    data,
    editError,
    editForm,
    fetchHistory,
    fetchStudentData,
    handleCopy,
    historyList,
    historyLoading,
    historyPagination,
    loading,
    prodis,
    saveEdit,
    savingEdit,
    setActiveTab,
    setEditForm,
  };
}
