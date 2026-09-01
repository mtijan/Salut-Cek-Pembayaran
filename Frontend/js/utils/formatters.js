// Pure Formatting Utilities
// UT SALUT Awwabin Tangerang

/**
 * Format a number to Indonesian Rupiah currency string.
 * @param {number|string} value
 * @returns {string}
 */
export function rupiah(value) {
  return `Rp ${Number(value || 0).toLocaleString("id-ID")}`;
}

/**
 * Normalize raw status string into canonical payment status: 'paid', 'partial', or 'unpaid'.
 * @param {string} status
 * @returns {'paid' | 'partial' | 'unpaid'}
 */
export function normalizeStatus(status) {
  const value = String(status || "unpaid").trim().toLowerCase();
  const aliases = {
    paid: "paid",
    lunas: "paid",
    partial: "partial",
    "bayar sebagian": "partial",
    "lunas sebagian": "partial",
    dicicil: "partial",
    cicil: "partial",
    unpaid: "unpaid",
    "belum lunas": "unpaid",
  };
  return aliases[value] || "unpaid";
}

/**
 * Summarize overall payment status based on bill items.
 * @param {Array<{ status: string }>} bills
 * @returns {'paid' | 'partial' | 'unpaid'}
 */
export function summarizePaymentStatus(bills) {
  if (!Array.isArray(bills) || bills.length === 0) return "unpaid";
  const statuses = bills.map((bill) => normalizeStatus(bill.status));
  const allPaid = statuses.every((status) => status === "paid");
  if (allPaid) return "paid";
  if (statuses.includes("partial")) return "partial";
  return "unpaid";
}

/**
 * Format 15-digit BRIVA number with space separation for readability.
 * @param {string|number} briva
 * @returns {string}
 */
export function formatBrivaDisplay(briva) {
  if (!briva) return "-";
  const raw = String(briva).trim();
  if (raw.length === 15) {
    return `${raw.slice(0, 5)} ${raw.slice(5, 9)} ${raw.slice(9, 13)} ${raw.slice(13)}`;
  }
  return raw.replace(/(\d{4})/g, "$1 ").trim();
}
