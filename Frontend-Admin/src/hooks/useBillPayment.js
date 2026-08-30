import { useState, useEffect, useCallback } from 'react';
import { billsApi } from '../services/api';
import { useToast } from '../components/common/Toast';
import { useCopyFeedback } from './useCopyFeedback';
import { toLocalDateInputValue } from '../utils/date';

/**
 * Feature hook untuk BillPaymentPage.
 * Mengelola state, fetch, payment mode, quick amount chips, dan submit transaksi.
 * Container page bertanggung jawab atas layout.
 */
export function useBillPayment({ billId }) {
  const { showToast } = useToast();
  const { copiedKey, copyToClipboard } = useCopyFeedback();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const [paymentMode, setPaymentMode] = useState('full');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(() => toLocalDateInputValue());
  const [paymentMethod, setPaymentMethod] = useState('BRIVA');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const fetchBillDetail = useCallback(async () => {
    if (!billId) return;
    setLoading(true);
    try {
      const res = await billsApi.getDetail(billId);
      setData(res);
      const bill = res?.bill || {};
      const rem = Number(bill.remaining_amount || 0);
      if (rem > 0) {
        setPaymentAmount(String(rem));
        setPaymentMode('full');
      } else {
        setPaymentAmount('');
      }
    } catch (err) {
      showToast(err.message || 'Gagal memuat data tagihan.', 'error');
    } finally {
      setLoading(false);
    }
  }, [billId, showToast]);

  useEffect(() => {
    fetchBillDetail();
  }, [fetchBillDetail]);

  const bill = data?.bill || {};
  const student = data?.student || {};
  const transactions = data?.transactions || [];

  const totalAmount = Number(bill.amount || 0);
  const currentPaid = Number(bill.paid_amount || 0);
  const remainingAmount = Number(bill.remaining_amount || 0);

  const handleCopy = (text, label) => {
    copyToClipboard(text, label, () => showToast(`${label} disalin ke clipboard!`, 'success'));
  };

  const handleModeChange = (mode) => {
    setPaymentMode(mode);
    setFormError('');
    if (mode === 'full') {
      setPaymentAmount(String(remainingAmount));
    } else {
      const suggest = remainingAmount > 500000 ? 500000 : Math.round(remainingAmount / 2);
      setPaymentAmount(String(suggest));
    }
  };

  const handleQuickAmount = (val) => {
    setPaymentMode('partial');
    setPaymentAmount(String(val));
    setFormError('');
  };

  // Real-time calculation
  const numericPayment = Number(paymentAmount) || 0;
  const newRemaining = Math.max(0, remainingAmount - numericPayment);
  const willBePaid = numericPayment >= remainingAmount && remainingAmount > 0;

  const handleSubmitPayment = async (e) => {
    e.preventDefault();
    if (remainingAmount <= 0 || bill.status === 'paid') {
      setFormError('Tagihan ini sudah lunas.');
      return;
    }
    if (!paymentAmount || numericPayment <= 0) {
      setFormError('Nominal pembayaran transaksi wajib diisi dan lebih dari 0.');
      return;
    }
    if (numericPayment > remainingAmount) {
      setFormError(`Nominal pembayaran melebihi sisa tagihan.`);
      return;
    }

    setSubmitting(true);
    setFormError('');
    try {
      await billsApi.recordPayment(billId, {
        payment_amount: numericPayment,
        payment_date: paymentDate || null,
        payment_method: paymentMethod || 'BRIVA',
        reference_number: referenceNumber.trim() || null,
        notes: notes.trim() || null,
      });
      showToast(`Transaksi pembayaran berhasil dicatat!`, 'success');
      setReferenceNumber('');
      setNotes('');
      await fetchBillDetail();
    } catch (err) {
      setFormError(err.message || 'Gagal menyimpan transaksi pembayaran.');
    } finally {
      setSubmitting(false);
    }
  };

  return {
    data,
    loading,
    bill,
    student,
    transactions,
    totalAmount,
    currentPaid,
    remainingAmount,
    paymentMode,
    paymentAmount,
    setPaymentAmount,
    paymentDate,
    setPaymentDate,
    paymentMethod,
    setPaymentMethod,
    referenceNumber,
    setReferenceNumber,
    notes,
    setNotes,
    submitting,
    formError,
    numericPayment,
    newRemaining,
    willBePaid,
    copiedKey,
    handleCopy,
    handleModeChange,
    handleQuickAmount,
    handleSubmitPayment,
    fetchBillDetail,
  };
}
