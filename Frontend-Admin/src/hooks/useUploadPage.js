import { useState } from 'react';
import { importApi } from '../services/importApi';
import { useToast } from '../components/common/Toast';

const currentBillingYear = () =>
  Number(
    new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      timeZone: 'Asia/Jakarta',
    }).format(new Date()),
  );

/**
 * Feature hook untuk UploadPage.
 * Mengelola state wizard (step), file, analyze, commit, dan reset.
 */
export function useUploadPage() {
  const { showToast } = useToast();

  const [step, setStep] = useState(1);
  const [file, setFile] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [confirmSensitive, setConfirmSensitive] = useState(false);
  const [commitResult, setCommitResult] = useState(null);
  const [loadingIssues, setLoadingIssues] = useState(false);
  const [billingYear, setBillingYear] = useState(currentBillingYear);
  const [semesterType, setSemesterType] = useState('ganjil');

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    if (selected) {
      if (!selected.name.toLowerCase().endsWith('.xlsx')) {
        showToast('Hanya file format .xlsx yang didukung.', 'error');
        return;
      }
      setFile(selected);
    }
  };

  const handleAnalyze = async () => {
    if (!file) {
      showToast('Pilih file Excel terlebih dahulu.', 'error');
      return;
    }
    setAnalyzing(true);
    try {
      const res = await importApi.preview(file, billingYear, semesterType);
      setPreviewData(res);
      setConfirmSensitive(false);
      setStep(2);
    } catch (err) {
      showToast(err.message || 'Gagal memproses preview file.', 'error');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleCommit = async () => {
    const token = previewData?.import_token || previewData?.token;
    if (!token) {
      showToast('Token preview tidak ditemukan.', 'error');
      return;
    }
    setCommitting(true);
    try {
      const res = await importApi.commit(token, confirmSensitive);
      setCommitResult(res);
      setStep(3);
      showToast('Data tagihan berhasil diimpor ke database.');
    } catch (err) {
      showToast(err.message || 'Gagal menyimpan data import.', 'error');
    } finally {
      setCommitting(false);
    }
  };

  const handleLoadMoreIssues = async () => {
    const token = previewData?.import_token || previewData?.token;
    const currentIssues = previewData?.issues || previewData?.errors || [];
    if (!token || loadingIssues) return;
    setLoadingIssues(true);
    try {
      const page = Math.floor(currentIssues.length / 50) + 1;
      const res = await importApi.getPreviewIssues(token, { page, limit: 50 });
      setPreviewData((current) => ({
        ...current,
        issues: [...(current?.issues || current?.errors || []), ...(res.issues || [])],
        issue_pagination: res.pagination,
      }));
    } catch (err) {
      showToast(err.message || 'Gagal memuat detail masalah berikutnya.', 'error');
    } finally {
      setLoadingIssues(false);
    }
  };

  const handleReset = () => {
    setStep(1);
    setFile(null);
    setPreviewData(null);
    setCommitResult(null);
    setConfirmSensitive(false);
    setBillingYear(currentBillingYear());
    setSemesterType('ganjil');
  };

  // Derived flags from previewData
  const s = previewData || {};
  const critical = (s.critical_rows || 0) > 0;
  const hasSensitive = Boolean(
    s.requires_update_confirmation ||
    (s.amount_change_rows || 0) > 0 ||
    (s.briva_change_rows || 0) > 0,
  );
  const canCommit = !hasSensitive || confirmSensitive;

  return {
    step,
    file,
    analyzing,
    committing,
    loadingIssues,
    previewData,
    confirmSensitive,
    setConfirmSensitive,
    commitResult,
    billingYear,
    setBillingYear,
    semesterType,
    setSemesterType,
    critical,
    hasSensitive,
    canCommit,
    handleFileChange,
    handleAnalyze,
    handleCommit,
    handleLoadMoreIssues,
    handleReset,
  };
}
