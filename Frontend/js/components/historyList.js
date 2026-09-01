// Payment History List Component
// UT SALUT Awwabin Tangerang

import { rupiah } from "../utils/formatters.js";
import { appendTextElement } from "../utils/dom.js";

/**
 * Render payment transaction history list.
 * @param {object} params
 * @param {Array} params.history
 */
export function renderPaymentHistory({ history = [] }) {
  const historyCountBadgeEl = document.querySelector("#history-count-badge");
  const historyContentEl = document.querySelector("#history-content");

  if (historyCountBadgeEl) {
    historyCountBadgeEl.textContent = `${history.length} Transaksi`;
  }

  if (!historyContentEl) return;
  historyContentEl.replaceChildren();

  if (!Array.isArray(history) || history.length === 0) {
    const emptyHistory = document.createElement("div");
    emptyHistory.className = "history-empty";
    appendTextElement(emptyHistory, "p", "history-empty-title", "Belum ada riwayat pembayaran");
    appendTextElement(
      emptyHistory,
      "p",
      "history-empty-desc",
      "Riwayat pembayaran akan otomatis tampil di sini setelah transaksi berhasil diverifikasi oleh sistem administrasi SALUT.",
    );
    historyContentEl.appendChild(emptyHistory);
    return;
  }

  const historyList = document.createElement("div");
  historyList.className = "history-timeline";

  for (const [idx, tx] of history.entries()) {
    const item = document.createElement("div");
    item.className = "history-timeline-item";

    const txDate = tx.payment_date_formatted || tx.payment_date || "Tanggal tidak tercatat";
    const txAmount = tx.amount_formatted || rupiah(tx.amount);
    const txMethod = tx.payment_method || "BRIVA";
    const txType = ["payment", "reversal", "correction"].includes(tx.transaction_type)
      ? tx.transaction_type
      : "correction";
    const amountPrefix = txType === "payment" ? "+ " : txType === "reversal" ? "− " : "";
    const verificationLabel = txType === "payment" ? "✓ Terverifikasi" : "Penyesuaian";

    appendTextElement(item, "div", "history-badge-num", String(idx + 1));
    const infoBox = appendTextElement(item, "div", "history-info-box", "");
    const topLine = appendTextElement(infoBox, "div", "history-top-line", "");
    appendTextElement(
      topLine,
      "strong",
      `history-amount history-amount-${txType}`,
      `${amountPrefix}${txAmount}`,
    );
    appendTextElement(topLine, "span", "method-tag", txMethod);
    appendTextElement(topLine, "span", "verified-tag", verificationLabel);
    const dateLine = appendTextElement(
      infoBox,
      "div",
      "history-date-line",
      "Tanggal Pembayaran: ",
    );
    appendTextElement(dateLine, "strong", "", txDate);
    historyList.appendChild(item);
  }

  historyContentEl.appendChild(historyList);
}
