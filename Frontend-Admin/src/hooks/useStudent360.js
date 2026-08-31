import { useCallback, useEffect, useRef, useState } from 'react';
import { useToast } from '../components/common/Toast';
import { studentsApi } from '../services/studentsApi.js';
import { isAbortError } from '../services/http.js';
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
  const detailRequestRef = useRef(null);
  const historyRequestRef = useRef(null);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const fetchDetail = useCallback(async () => {
    if (detailRequestRef.current) {
      detailRequestRef.current.abort();
    }
    const controller = new AbortController();
    detailRequestRef.current = controller;

    setLoading(true);
    try {
      const detail = await studentsApi.getDetail(studentId, { signal: controller.signal });
      if (detailRequestRef.current === controller) {
        setData(detail);
      }
    } catch (error) {
      if (isAbortError(error)) return;
      if (detailRequestRef.current === controller) {
        showToast(error.message || 'Gagal memuat profil mahasiswa.', 'error');
        onCloseRef.current();
      }
    } finally {
      if (detailRequestRef.current === controller) {
        setLoading(false);
        detailRequestRef.current = null;
      }
    }
  }, [showToast, studentId]);

  const fetchPaymentHistory = useCallback(
    async (offset = 0) => {
      if (historyRequestRef.current) {
        historyRequestRef.current.abort();
      }
      const controller = new AbortController();
      historyRequestRef.current = controller;

      setHistoryLoading(true);
      try {
        const history = await studentsApi.getTransactions(
          studentId,
          { limit: 50, offset },
          { signal: controller.signal },
        );
        if (historyRequestRef.current === controller) {
          setHistoryData(history);
        }
      } catch (error) {
        if (isAbortError(error)) return;
        if (historyRequestRef.current === controller) {
          showToast(error.message || 'Gagal memuat riwayat pembayaran.', 'error');
        }
      } finally {
        if (historyRequestRef.current === controller) {
          setHistoryLoading(false);
          historyRequestRef.current = null;
        }
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
    return () => {
      if (detailRequestRef.current) {
        detailRequestRef.current.abort();
        detailRequestRef.current = null;
      }
      if (historyRequestRef.current) {
        historyRequestRef.current.abort();
        historyRequestRef.current = null;
      }
    };
  }, [fetchDetail, isOpen, studentId]);

  useEffect(() => {
    if (isOpen && studentId && activeTab === 'history') fetchPaymentHistory(0);
    return () => {
      if (historyRequestRef.current) {
        historyRequestRef.current.abort();
        historyRequestRef.current = null;
      }
    };
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
