import { useState, useEffect, useCallback } from 'react';
import { masterApi } from '../services/api';
import { useToast } from '../components/common/Toast';

/**
 * Feature hook untuk MasterPage.
 * Mengelola state dan handlers untuk dua domain: Program Studi dan Periode Akademik.
 */
export function useMasterPage() {
  const { showToast } = useToast();

  // ── Program Studi ──────────────────────────────────────────────
  const [prodis, setProdis] = useState([]);
  const [prodiLoading, setProdiLoading] = useState(true);
  const [prodiModalOpen, setProdiModalOpen] = useState(false);
  const [editingProdi, setEditingProdi] = useState(null);
  const [prodiForm, setProdiForm] = useState({
    code: '',
    name: '',
    degree: 'S1',
    faculty: '',
    is_active: 1,
  });
  const [prodiError, setProdiError] = useState('');
  const [prodiSaving, setProdiSaving] = useState(false);

  // ── Periode Akademik ───────────────────────────────────────────
  const [periods, setPeriods] = useState([]);
  const [periodLoading, setPeriodLoading] = useState(true);
  const [periodModalOpen, setPeriodModalOpen] = useState(false);
  const [editingPeriod, setEditingPeriod] = useState(null);
  const [periodForm, setPeriodForm] = useState({
    code: '',
    name: '',
    semester_type: 'ganjil',
    default_due_date: '',
    is_active: 1,
  });
  const [periodError, setPeriodError] = useState('');
  const [periodSaving, setPeriodSaving] = useState(false);

  const fetchProdis = useCallback(async () => {
    setProdiLoading(true);
    try {
      const res = await masterApi.listProdi();
      setProdis(res.study_programs || []);
    } catch (err) {
      showToast(err.message || 'Gagal memuat Program Studi.', 'error');
    } finally {
      setProdiLoading(false);
    }
  }, [showToast]);

  const fetchPeriods = useCallback(async () => {
    setPeriodLoading(true);
    try {
      const res = await masterApi.listPeriods();
      setPeriods(res.academic_periods || []);
    } catch (err) {
      showToast(err.message || 'Gagal memuat Periode Akademik.', 'error');
    } finally {
      setPeriodLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchProdis();
    fetchPeriods();
  }, [fetchProdis, fetchPeriods]);

  // Prodi handlers
  const handleOpenProdiCreate = () => {
    setEditingProdi(null);
    setProdiForm({
      code: '',
      name: '',
      degree: 'S1',
      faculty: 'Fakultas Hukum, Ilmu Sosial, dan Ilmu Politik',
      is_active: 1,
    });
    setProdiError('');
    setProdiModalOpen(true);
  };

  const handleOpenProdiEdit = (p) => {
    setEditingProdi(p);
    setProdiForm({
      code: p.code,
      name: p.name,
      degree: p.degree || 'S1',
      faculty: p.faculty || '',
      is_active: p.is_active ? 1 : 0,
    });
    setProdiError('');
    setProdiModalOpen(true);
  };

  const handleSaveProdi = async (e) => {
    e.preventDefault();
    if (!prodiForm.code || !prodiForm.name) {
      setProdiError('Kode dan Nama Program Studi wajib diisi.');
      return;
    }
    setProdiError('');
    setProdiSaving(true);
    try {
      if (editingProdi) {
        await masterApi.updateProdi(editingProdi.id, prodiForm);
        showToast('Program Studi berhasil diperbarui.');
      } else {
        await masterApi.createProdi(prodiForm);
        showToast('Program Studi baru berhasil ditambahkan.');
      }
      setProdiModalOpen(false);
      fetchProdis();
    } catch (err) {
      setProdiError(err.message || 'Gagal menyimpan Program Studi.');
    } finally {
      setProdiSaving(false);
    }
  };

  // Period handlers
  const handleOpenPeriodCreate = () => {
    setEditingPeriod(null);
    setPeriodForm({
      code: '',
      name: '',
      semester_type: 'ganjil',
      default_due_date: '',
      is_active: 0,
    });
    setPeriodError('');
    setPeriodModalOpen(true);
  };

  const handleOpenPeriodEdit = (p) => {
    setEditingPeriod(p);
    setPeriodForm({
      code: p.code,
      name: p.name,
      semester_type: p.semester_type || p.period_type || 'ganjil',
      default_due_date: p.default_due_date || '',
      is_active: p.is_active ? 1 : 0,
    });
    setPeriodError('');
    setPeriodModalOpen(true);
  };

  const handleSavePeriod = async (e) => {
    e.preventDefault();
    if (!periodForm.code || !periodForm.name) {
      setPeriodError('Kode dan Nama Periode Akademik wajib diisi.');
      return;
    }
    setPeriodError('');
    setPeriodSaving(true);
    try {
      if (editingPeriod) {
        await masterApi.updatePeriod(editingPeriod.id, periodForm);
        showToast('Periode Akademik berhasil diperbarui.');
      } else {
        await masterApi.createPeriod(periodForm);
        showToast('Periode Akademik baru berhasil ditambahkan.');
      }
      setPeriodModalOpen(false);
      fetchPeriods();
    } catch (err) {
      setPeriodError(err.message || 'Gagal menyimpan Periode Akademik.');
    } finally {
      setPeriodSaving(false);
    }
  };

  return {
    // Prodi
    prodis,
    prodiLoading,
    prodiModalOpen,
    setProdiModalOpen,
    editingProdi,
    prodiForm,
    setProdiForm,
    prodiError,
    prodiSaving,
    handleOpenProdiCreate,
    handleOpenProdiEdit,
    handleSaveProdi,
    // Period
    periods,
    periodLoading,
    periodModalOpen,
    setPeriodModalOpen,
    editingPeriod,
    periodForm,
    setPeriodForm,
    periodError,
    periodSaving,
    handleOpenPeriodCreate,
    handleOpenPeriodEdit,
    handleSavePeriod,
  };
}
