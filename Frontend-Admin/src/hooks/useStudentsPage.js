import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useToast } from '../components/common/Toast';
import { studentsApi } from '../services/studentsApi.js';
import { masterApi } from '../services/masterApi.js';
import { isAbortError } from '../services/http.js';
import { useCopyFeedback } from './useCopyFeedback';

const emptyStudent = {
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
  initial_registration: '',
  phone_number: '',
  email: '',
  address: '',
};

export function useStudentsPage() {
  const { showToast } = useToast();
  const [students, setStudents] = useState([]);
  const [prodis, setProdis] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [selectedProdi, setSelectedProdi] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState('');
  const [sortBy, setSortBy] = useState('entry_period_desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selected360Id, setSelected360Id] = useState(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [formData, setFormData] = useState(emptyStudent);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const { copiedKey, copyToClipboard } = useCopyFeedback();

  const activeRequestRef = useRef(null);

  const fetchStudents = useCallback(async () => {
    if (activeRequestRef.current) {
      activeRequestRef.current.abort();
    }
    const controller = new AbortController();
    activeRequestRef.current = controller;

    setLoading(true);
    try {
      const response = await studentsApi.list(
        {
          query: query.trim(),
          study_program_id: selectedProdi,
          academic_status: selectedStatus,
          entry_period: selectedPeriod,
          sort_by: sortBy,
        },
        { signal: controller.signal },
      );

      if (activeRequestRef.current === controller) {
        setStudents(response.students || []);
        setCurrentPage(1);
      }
    } catch (error) {
      if (isAbortError(error)) return;
      if (activeRequestRef.current === controller) {
        showToast(error.message || 'Gagal memuat data mahasiswa.', 'error');
      }
    } finally {
      if (activeRequestRef.current === controller) {
        setLoading(false);
        activeRequestRef.current = null;
      }
    }
  }, [query, selectedProdi, selectedStatus, selectedPeriod, sortBy, showToast]);

  useEffect(() => {
    const prodiController = new AbortController();
    masterApi
      .listProdi({ signal: prodiController.signal })
      .then((response) => setProdis(response.study_programs || []))
      .catch((err) => {
        if (!isAbortError(err)) {
          // Silent fallback for prodi options
        }
      });
    return () => prodiController.abort();
  }, []);

  useEffect(() => {
    fetchStudents();
    return () => {
      if (activeRequestRef.current) {
        activeRequestRef.current.abort();
        activeRequestRef.current = null;
      }
    };
  }, [fetchStudents]);

  const stats = useMemo(
    () => ({
      total: students.length,
      active: students.filter((student) => student.academic_status === 'aktif').length,
      nonActive: students.filter(
        (student) => student.academic_status && student.academic_status !== 'aktif',
      ).length,
      withBills: students.filter((student) => Number(student.bill_count || 0) > 0).length,
    }),
    [students],
  );
  const totalPages = Math.max(1, Math.ceil(students.length / pageSize));
  const paginatedStudents = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return students.slice(start, start + pageSize);
  }, [students, currentPage, pageSize]);

  const resetFilters = () => {
    setQuery('');
    setSelectedProdi('');
    setSelectedStatus('');
    setSelectedPeriod('');
    setSortBy('entry_period_desc');
  };
  const openCreate = () => {
    const year = new Date().getFullYear().toString();
    setEditingStudent(null);
    setFormData({
      ...emptyStudent,
      study_program_id: prodis[0]?.id || '',
      entry_year: year,
      entry_period: `${year}.1`,
      initial_registration: `UNIVERSITAS TERBUKA ${year}.1`,
    });
    setFormError('');
    setEditorOpen(true);
  };
  const openEdit = (student) => {
    setEditingStudent(student);
    setFormData({
      nim: student.nim,
      full_name: student.full_name,
      no_ktp: student.no_ktp || '',
      tempat_lahir: student.tempat_lahir || '',
      tanggal_lahir: student.tanggal_lahir || '',
      nama_ibu_kandung: student.nama_ibu_kandung || '',
      study_program_id: student.study_program_id || '',
      academic_status: student.academic_status || 'aktif',
      entry_year: student.entry_year ? String(student.entry_year) : '',
      entry_semester: student.entry_semester || 'ganjil',
      entry_period: student.entry_period || '',
      initial_registration: student.initial_registration || '',
      phone_number: student.phone_number || '',
      email: student.email || '',
      address: student.address || '',
    });
    setFormError('');
    setEditorOpen(true);
  };
  const saveStudent = async (event) => {
    event.preventDefault();
    if (!formData.nim || !formData.full_name) {
      setFormError('NIM dan Nama Lengkap wajib diisi.');
      return;
    }
    setFormError('');
    setSaving(true);
    const nullable = (value) => value || null;
    const payload = {
      ...formData,
      entry_year: formData.entry_year ? Number(formData.entry_year) : null,
      study_program_id: nullable(formData.study_program_id),
      phone_number: nullable(formData.phone_number),
      email: nullable(formData.email),
      address: nullable(formData.address),
      no_ktp: nullable(formData.no_ktp),
      tempat_lahir: nullable(formData.tempat_lahir),
      tanggal_lahir: nullable(formData.tanggal_lahir),
      nama_ibu_kandung: nullable(formData.nama_ibu_kandung),
      entry_semester: nullable(formData.entry_semester),
      entry_period: nullable(formData.entry_period),
      initial_registration: nullable(formData.initial_registration),
    };
    try {
      if (editingStudent) {
        await studentsApi.update(editingStudent.id, payload);
        showToast('Data mahasiswa berhasil diperbarui.');
      } else {
        await studentsApi.create(payload);
        showToast('Mahasiswa baru berhasil ditambahkan.');
      }
      setEditorOpen(false);
      fetchStudents();
    } catch (error) {
      setFormError(error.message || 'Gagal menyimpan mahasiswa.');
    } finally {
      setSaving(false);
    }
  };
  const confirmDelete = async (reason) => {
    if (!deleteTarget) return;
    await studentsApi.delete(deleteTarget.id, reason);
    showToast(`Mahasiswa ${deleteTarget.full_name} berhasil dihapus.`);
    setDeleteTarget(null);
    fetchStudents();
  };
  const updateEntryPeriod = (value) => {
    const match = value.match(/(20\d{2})\.([12])/);
    setFormData((current) => ({
      ...current,
      entry_period: value,
      entry_year: match ? match[1] : current.entry_year,
      entry_semester: match ? (match[2] === '1' ? 'ganjil' : 'genap') : current.entry_semester,
    }));
  };

  return {
    students,
    paginatedStudents,
    prodis,
    loading,
    stats,
    copiedKey,
    filters: { query, selectedProdi, selectedStatus, selectedPeriod, sortBy },
    pagination: { currentPage, pageSize, totalPages, setCurrentPage, setPageSize },
    modal: { selected360Id, editorOpen, editingStudent, deleteTarget },
    editor: { formData, formError, saving },
    actions: {
      setQuery,
      setSelectedProdi,
      setSelectedStatus,
      setSelectedPeriod,
      setSortBy,
      resetFilters,
      resetSearchFilters: () => {
        setQuery('');
        setSelectedProdi('');
        setSelectedStatus('');
        setSelectedPeriod('');
      },
      setPageSize: (value) => {
        setPageSize(value);
        setCurrentPage(1);
      },
      setSelected360Id,
      openCreate,
      openEdit,
      closeEditor: () => setEditorOpen(false),
      setFormData,
      updateEntryPeriod,
      saveStudent,
      setDeleteTarget,
      confirmDelete,
      copy: (text, label) =>
        copyToClipboard(text, label, () => showToast(`${label} disalin!`, 'success')),
    },
  };
}
