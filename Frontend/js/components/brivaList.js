// BRIVA & Virtual Account List Component
// UT SALUT Awwabin Tangerang

import { formatBrivaDisplay, normalizeStatus, rupiah } from "../utils/formatters.js";
import { appendTextElement } from "../utils/dom.js";
import { copyToClipboard } from "../utils/clipboard.js";

/**
 * Render BRIVA virtual accounts list.
 * @param {object} params
 * @param {Array} params.bills
 * @param {string} [params.accountName]
 */
export function renderBrivaList({ bills = [], accountName = "-" }) {
  const vaContainerEl = document.querySelector("#va-container");
  const brivaAccountNameEl = document.querySelector("#briva-account-name");

  if (brivaAccountNameEl) {
    brivaAccountNameEl.textContent = accountName || "-";
  }

  if (!vaContainerEl) return;
  vaContainerEl.replaceChildren();

  if (!Array.isArray(bills) || bills.length === 0) {
    const emptyVa = document.createElement("p");
    emptyVa.className = "text-muted";
    emptyVa.textContent = "Tidak ada tagihan atau nomor BRIVA aktif saat ini.";
    vaContainerEl.appendChild(emptyVa);
    return;
  }

  for (const [index, bill] of bills.entries()) {
    const vaCard = document.createElement("div");
    vaCard.className = "va-item-box";

    const billStatus = normalizeStatus(bill.status);
    const billRemaining =
      bill.remaining_amount !== undefined ? bill.remaining_amount : bill.amount;
    const labelTitle =
      bills.length > 1 ? bill.bill_label || `Tagihan ${index + 1}` : "Nomor Virtual Account BRIVA";
    const statusLabel =
      billStatus === "paid" ? "Lunas" : billStatus === "partial" ? "Lunas Sebagian" : "Belum Lunas";

    const details = appendTextElement(vaCard, "div", "va-details", "");
    const meta = appendTextElement(details, "div", "va-meta-top", "");
    appendTextElement(meta, "span", "va-label-title", labelTitle);
    appendTextElement(meta, "span", `va-status-pill pill-${billStatus}`, statusLabel);
    appendTextElement(details, "div", "va-number font-mono", formatBrivaDisplay(bill.briva));

    const amountNote = appendTextElement(
      details,
      "div",
      "va-amount-note",
      billStatus === "paid" ? "Status Tagihan: " : "Sisa Tagihan yang Harus Dibayar: ",
    );
    appendTextElement(
      amountNote,
      "strong",
      "",
      billStatus === "paid"
        ? "Sudah Lunas"
        : bill.remaining_amount_formatted || rupiah(billRemaining),
    );

    const copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.className = "btn-copy";
    copyBtn.title = "Salin nomor BRIVA";
    copyBtn.setAttribute("aria-label", `Salin nomor BRIVA ${bill.briva}`);
    copyBtn.textContent = "Salin BRIVA";
    copyBtn.addEventListener("click", () => {
      copyToClipboard(bill.briva, "Nomor BRIVA");
    });

    vaCard.appendChild(copyBtn);
    vaContainerEl.appendChild(vaCard);
  }
}
