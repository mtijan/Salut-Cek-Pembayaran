// Share / Copy Billing Summary for WhatsApp Component
// UT SALUT Awwabin Tangerang

import { rupiah } from "../utils/formatters.js";
import { showToast } from "../utils/toast.js";

/**
 * Build structured text message suitable for WhatsApp sharing.
 * @param {object} lookupData
 * @param {string} [statusText="Belum Lunas"]
 * @returns {string}
 */
export function buildShareSummaryText(lookupData, statusText = "Belum Lunas") {
  if (!lookupData) return "";

  const student = lookupData.student || {};
  const summary = lookupData.summary || {};
  const bills = lookupData.bills || [];
  const primaryBriva = bills[0]?.briva || "-";

  return [
    `*TAGIHAN BIAYA KULIAH UT SALUT AWWABIN*`,
    `Nama: ${student.full_name || "-"}`,
    `NIM: ${student.nim || "-"}`,
    `Program Studi: ${student.program_study || "-"}`,
    `Periode: ${student.payment_period || (bills[0] ? bills[0].period : "-")}`,
    ``,
    `Total Tagihan: ${summary.total_amount_formatted || rupiah(summary.total_amount)}`,
    `Sudah Dibayar: ${summary.paid_amount_formatted || rupiah(summary.paid_amount)}`,
    `*Sisa Tagihan (Wajib Dibayar): ${summary.remaining_amount_formatted || rupiah(summary.remaining_amount)}*`,
    `Status: ${statusText}`,
    ``,
    `Nomor BRIVA: ${primaryBriva} (Bank BRI)`,
    student.due_date_formatted ? `Batas Pembayaran: ${student.due_date_formatted}` : null,
    ``,
    `_Sistem Informasi Pembayaran SALUT Awwabin Tangerang_`,
  ]
    .filter((line) => line !== null)
    .join("\n");
}

/**
 * Copy formatted billing summary text to clipboard.
 * @param {object} lookupData
 * @param {string} [statusText="Belum Lunas"]
 * @returns {Promise<boolean>}
 */
export async function handleShareSummary(lookupData, statusText = "Belum Lunas") {
  const textToShare = buildShareSummaryText(lookupData, statusText);
  if (!textToShare) return false;

  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(textToShare);
      showToast("Rincian tagihan disalin! Siap dibagikan ke WhatsApp.");
      return true;
    }
    throw new Error("Clipboard API unavailable");
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = textToShare;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand("copy");
      showToast("Rincian tagihan disalin! Siap dibagikan.");
      return true;
    } catch {
      showToast("Gagal menyalin rincian tagihan secara otomatis.");
      return false;
    } finally {
      document.body.removeChild(textarea);
    }
  }
}
