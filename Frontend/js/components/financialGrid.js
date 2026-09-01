// Financial Summary 3-Card Grid Component
// UT SALUT Awwabin Tangerang

import { rupiah, normalizeStatus } from "../utils/formatters.js";

/**
 * Calculate financial totals from bills and summary object.
 * @param {object} params
 * @param {Array} params.bills
 * @param {object} [params.summary]
 * @returns {{ totalAmount: number, paidAmount: number, remainingAmount: number }}
 */
export function calculateFinancials({ bills = [], summary = {} }) {
  const calculatedTotal = bills.reduce((sum, b) => sum + Number(b.amount || 0), 0);
  const calculatedPaid = bills.reduce((sum, b) => {
    const st = normalizeStatus(b.status);
    if (st === "paid") return sum + Number(b.amount || 0);
    if (st === "partial") return sum + Number(b.paid_amount || 0);
    return sum;
  }, 0);
  const calculatedRemaining = Math.max(0, calculatedTotal - calculatedPaid);

  const totalAmount =
    summary.total_amount !== undefined ? Number(summary.total_amount) : calculatedTotal;
  const paidAmount =
    summary.paid_amount !== undefined ? Number(summary.paid_amount) : calculatedPaid;
  const remainingAmount =
    summary.remaining_amount !== undefined ? Number(summary.remaining_amount) : calculatedRemaining;

  return { totalAmount, paidAmount, remainingAmount };
}

/**
 * Render the 3-card financial summary grid.
 * @param {object} params
 * @param {Array} params.bills
 * @param {object} [params.summary]
 * @returns {{ totalAmount: number, paidAmount: number, remainingAmount: number }}
 */
export function renderFinancialSummary({ bills = [], summary = {} }) {
  const finTotalAmountEl = document.querySelector("#fin-total-amount");
  const finPaidAmountEl = document.querySelector("#fin-paid-amount");
  const finPaidHintEl = document.querySelector("#fin-paid-hint");
  const finRemainingCardEl = document.querySelector("#fin-remaining-card");
  const finRemainingAmountEl = document.querySelector("#fin-remaining-amount");
  const finRemainingHintEl = document.querySelector("#fin-remaining-hint");

  const { totalAmount, paidAmount, remainingAmount } = calculateFinancials({ bills, summary });

  if (finTotalAmountEl) {
    finTotalAmountEl.textContent = summary.total_amount_formatted || rupiah(totalAmount);
  }
  if (finPaidAmountEl) {
    finPaidAmountEl.textContent = summary.paid_amount_formatted || rupiah(paidAmount);
  }
  if (finRemainingAmountEl) {
    finRemainingAmountEl.textContent =
      summary.remaining_amount_formatted || rupiah(remainingAmount);
  }

  if (finPaidHintEl) {
    finPaidHintEl.textContent =
      paidAmount > 0 ? "Tercatat di sistem SALUT" : "Belum ada pembayaran";
  }

  if (finRemainingCardEl && finRemainingHintEl) {
    if (remainingAmount === 0 && totalAmount > 0) {
      finRemainingHintEl.textContent = "Lunas sepenuhnya";
      finRemainingCardEl.classList.add("is-settled");
    } else {
      finRemainingHintEl.textContent = "Nominal yang harus dilunasi";
      finRemainingCardEl.classList.remove("is-settled");
    }
  }

  return { totalAmount, paidAmount, remainingAmount };
}
