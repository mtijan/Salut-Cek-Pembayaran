import { useCallback, useEffect, useRef, useState } from 'react';
import { useToast } from '../components/common/Toast';
import { studentsApi } from '../services/studentsApi';
import { useCopyFeedback } from './useCopyFeedback';

export function useStudent360({ isOpen, onClose, studentId }) {
  const { showToast } = useToast();
  const { copiedKey, copyToClipboard } = useCopyFeedback();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('bio');
  const [historyData, setHistoryData] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    try {
      setData(await studentsApi.getDetail(studentId));
    } catch (error) {
      showToast(error.message || 'Gagal memuat profil mahasiswa.', 'error');
      onCloseRef.current();
    } finally {
      setLoading(false);
    }
  }, [showToast, studentId]);

  const fetchPaymentHistory = useCallback(
    async (offset = 0) => {
      setHistoryLoading(true);
      try {
        setHistoryData(await studentsApi.getTransactions(studentId, { limit: 50, offset }));
      } catch (error) {
        showToast(error.message || 'Gagal memuat riwayat pembayaran.', 'error');
      } finally {
        setHistoryLoading(false);
      }
    },
    [showToast, studentId],
  );

  useEffect(() => {
    if (isOpen && studentId) {
      setActiveTab('bio');
      setHistoryData(null);
      fetchDetail();
    } else {
      setData(null);
    }
  }, [fetchDetail, isOpen, studentId]);

  useEffect(() => {
    if (isOpen && studentId && activeTab === 'history') fetchPaymentHistory(0);
  }, [activeTab, fetchPaymentHistory, isOpen, studentId]);

  const handleCopy = useCallback(
    (text, keyName) => {
      copyToClipboard(text, keyName, () =>
        showToast(`${keyName} berhasil disalin ke clipboard!`, 'success'),
      );
    },
    [copyToClipboard, showToast],
  );

  const paymentHistory = historyData?.transactions || data?.payment_history || [];
  const historyPagination = historyData?.pagination ||
    data?.payment_history_pagination || {
      total: paymentHistory.length,
      limit: 50,
      offset: 0,
    };

  return {
    activeTab,
    copiedKey,
    data,
    fetchPaymentHistory,
    handleCopy,
    historyLoading,
    historyPagination,
    loading,
    paymentHistory,
    setActiveTab,
  };
}
