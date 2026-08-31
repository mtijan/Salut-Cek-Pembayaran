import { useState } from 'react';
import { importApi } from '../services/importApi';
import { useToast } from '../components/common/Toast';

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
      const res = await importApi.preview(file);
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

  const handleReset = () => {
    setStep(1);
    setFile(null);
    setPreviewData(null);
    setCommitResult(null);
    setConfirmSensitive(false);
  };

  // Derived flags from previewData
  const s = previewData || {};
  const critical = (s.critical_rows || 0) > 0;
  const hasSensitive = Boolean(
    s.requires_update_confirmation ||
    (s.amount_change_rows || 0) > 0 ||
    (s.briva_change_rows || 0) > 0,
  );
  const canCommit = !critical && (!hasSensitive || confirmSensitive);

  return {
    step,
    file,
    analyzing,
    committing,
    previewData,
    confirmSensitive,
    setConfirmSensitive,
    commitResult,
    critical,
    hasSensitive,
    canCommit,
    handleFileChange,
    handleAnalyze,
    handleCommit,
    handleReset,
  };
}
