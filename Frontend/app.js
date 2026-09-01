// Frontend Public Billing & Payment Check Logic
// UT SALUT Awwabin Tangerang

const form = document.querySelector("#lookup-form");
const nimInput = document.querySelector("#nim");
const clearNimBtn = document.querySelector("#clear-nim");
const submitButton = document.querySelector("#submit-button");
const formMessage = document.querySelector("#form-message");

const emptyState = document.querySelector("#empty-state");
const resultState = document.querySelector("#result-state");

// Student Profile Elements
const studentName = document.querySelector("#student-name");
const paymentStatusBadge = document.querySelector("#payment-status-badge");
const studentNim = document.querySelector("#student-nim");
const studentProgram = document.querySelector("#student-program");
const studentPeriod = document.querySelector("#student-period");
const dueDateBox = document.querySelector("#due-date-box");
const studentDueDate = document.querySelector("#student-due-date");

// Financial Summary Elements
const finTotalAmount = document.querySelector("#fin-total-amount");
const finPaidAmount = document.querySelector("#fin-paid-amount");
const finPaidHint = document.querySelector("#fin-paid-hint");
const finRemainingCard = document.querySelector("#fin-remaining-card");
const finRemainingAmount = document.querySelector("#fin-remaining-amount");
const finRemainingHint = document.querySelector("#fin-remaining-hint");

// BRIVA Elements
const vaContainer = document.querySelector("#va-container");
const brivaAccountName = document.querySelector("#briva-account-name");

// Payment History Elements
const historyCountBadge = document.querySelector("#history-count-badge");
const historyContent = document.querySelector("#history-content");

// Toast & Action Buttons
const toast = document.querySelector("#toast");
const toastMessage = document.querySelector("#toast-message");
const shareSummaryButton = document.querySelector("#share-summary-button");
const newLookupButton = document.querySelector("#new-lookup-button");

let toastTimer = null;
let currentLookupData = null;

function showToast(text, duration = 3000) {
  if (toastTimer) clearTimeout(toastTimer);
  toastMessage.textContent = text;
  toast.classList.add("show");
  toast.setAttribute("aria-hidden", "false");
  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
    toast.setAttribute("aria-hidden", "true");
  }, duration);
}

function setMessage(text, type = "") {
  if (!text) {
    formMessage.textContent = "";
    formMessage.className = "form-alert hidden";
    return;
  }
  formMessage.textContent = text;
  formMessage.className = `form-alert ${type}`.trim();
  formMessage.classList.remove("hidden");
}

function showEmpty() {
  emptyState.classList.remove("hidden");
  resultState.classList.add("hidden");
}

function rupiah(value) {
  return `Rp ${Number(value || 0).toLocaleString("id-ID")}`;
}

function appendTextElement(parent, tagName, className, text) {
  const element = document.createElement(tagName);
  element.className = className;
  element.textContent = text;
  parent.appendChild(element);
  return element;
}

function normalizeStatus(status) {
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

function summarizePaymentStatus(bills) {
  const statuses = bills.map((bill) => normalizeStatus(bill.status));
  const allPaid = statuses.length > 0 && statuses.every((status) => status === "paid");
  if (allPaid) return "paid";
  if (statuses.includes("partial")) return "partial";
  return "unpaid";
}

function formatBrivaDisplay(briva) {
  if (!briva) return "-";
  const raw = String(briva).trim();
  if (raw.length === 15) {
    return `${raw.slice(0, 5)} ${raw.slice(5, 9)} ${raw.slice(9, 13)} ${raw.slice(13)}`;
  }
  return raw.replace(/(\d{4})/g, "$1 ").trim();
}

async function copyToClipboard(text, label = "Nomor BRIVA") {
  const cleanText = String(text || "").replace(/\s+/g, "");
  try {
    await navigator.clipboard.writeText(cleanText);
    showToast(`${label} disalin: ${cleanText}`);
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = cleanText;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand("copy");
      showToast(`${label} berhasil disalin!`);
    } catch {
      showToast(`Gagal menyalin ${label}. Salin manual: ${cleanText}`, 4000);
    }
    document.body.removeChild(textarea);
  }
}

function renderResult(data) {
  currentLookupData = data;
  emptyState.classList.add("hidden");
  resultState.classList.remove("hidden");

  const student = data.student || {};
  const bills = data.bills || [];
  const history = data.payment_history || [];

  // 1. Student Profile
  const fullName = student.full_name || "-";
  studentName.textContent = fullName;
  studentNim.textContent = student.nim || "-";
  studentProgram.textContent = student.program_study || "-";
  studentPeriod.textContent = student.payment_period || (bills[0] ? bills[0].period : "-");

  if (student.due_date_formatted) {
    studentDueDate.textContent = student.due_date_formatted;
    dueDateBox.classList.remove("hidden");
  } else {
    dueDateBox.classList.add("hidden");
  }

  // 2. Financial Calculations
  const calculatedTotal = bills.reduce((sum, b) => sum + Number(b.amount || 0), 0);
  const calculatedPaid = bills.reduce((sum, b) => {
    const st = normalizeStatus(b.status);
    if (st === "paid") return sum + Number(b.amount || 0);
    if (st === "partial") return sum + Number(b.paid_amount || 0);
    return sum;
  }, 0);
  const calculatedRemaining = Math.max(0, calculatedTotal - calculatedPaid);

  const summary = data.summary || {};
  const totalAmount = summary.total_amount !== undefined ? Number(summary.total_amount) : calculatedTotal;
  const paidAmount = summary.paid_amount !== undefined ? Number(summary.paid_amount) : calculatedPaid;
  const remainingAmount = summary.remaining_amount !== undefined ? Number(summary.remaining_amount) : calculatedRemaining;

  const paymentStatus = normalizeStatus(data.payment_status || summarizePaymentStatus(bills));

  // 3. Status Badge
  paymentStatusBadge.className = "status-badge";
  if (paymentStatus === "paid" || (totalAmount > 0 && remainingAmount === 0)) {
    paymentStatusBadge.textContent = "Lunas";
    paymentStatusBadge.classList.add("status-paid");
  } else if (paymentStatus === "partial" || (paidAmount > 0 && remainingAmount > 0)) {
    paymentStatusBadge.textContent = "Lunas Sebagian";
    paymentStatusBadge.classList.add("status-partial");
  } else {
    paymentStatusBadge.textContent = "Belum Lunas";
    paymentStatusBadge.classList.add("status-unpaid");
  }

  // 4. Financial Summary Cards
  finTotalAmount.textContent = summary.total_amount_formatted || rupiah(totalAmount);
  finPaidAmount.textContent = summary.paid_amount_formatted || rupiah(paidAmount);
  finRemainingAmount.textContent = summary.remaining_amount_formatted || rupiah(remainingAmount);

  finPaidHint.textContent = paidAmount > 0 ? "Tercatat di sistem SALUT" : "Belum ada pembayaran";

  if (remainingAmount === 0 && totalAmount > 0) {
    finRemainingHint.textContent = "Lunas sepenuhnya";
    finRemainingCard.classList.add("is-settled");
  } else {
    finRemainingHint.textContent = "Nominal yang harus dilunasi";
    finRemainingCard.classList.remove("is-settled");
  }

  // 5. BRIVA Section
  brivaAccountName.textContent = fullName;
  vaContainer.replaceChildren();

  if (bills.length === 0) {
    const emptyVa = document.createElement("p");
    emptyVa.className = "text-muted";
    emptyVa.textContent = "Tidak ada tagihan atau nomor BRIVA aktif saat ini.";
    vaContainer.appendChild(emptyVa);
  } else {
    for (const [index, bill] of bills.entries()) {
      const vaCard = document.createElement("div");
      vaCard.className = "va-item-box";

      const billStatus = normalizeStatus(bill.status);
      const billRemaining = bill.remaining_amount !== undefined ? bill.remaining_amount : bill.amount;
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
      vaContainer.appendChild(vaCard);
    }
  }

  // 6. Payment History List
  historyCountBadge.textContent = `${history.length} Transaksi`;
  historyContent.replaceChildren();

  if (history.length === 0) {
    const emptyHistory = document.createElement("div");
    emptyHistory.className = "history-empty";
    appendTextElement(emptyHistory, "p", "history-empty-title", "Belum ada riwayat pembayaran");
    appendTextElement(
      emptyHistory,
      "p",
      "history-empty-desc",
      "Riwayat pembayaran akan otomatis tampil di sini setelah transaksi berhasil diverifikasi oleh sistem administrasi SALUT.",
    );
    historyContent.appendChild(emptyHistory);
  } else {
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
      const dateLine = appendTextElement(infoBox, "div", "history-date-line", "Tanggal Pembayaran: ");
      appendTextElement(dateLine, "strong", "", txDate);
      historyList.appendChild(item);
    }
    historyContent.appendChild(historyList);
  }

  // Scroll smoothly to result on mobile
  if (window.innerWidth < 860) {
    resultState.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

// NIM Input Filter (Numeric only)
nimInput.addEventListener("input", (e) => {
  const sanitized = e.target.value.replace(/[^0-9]/g, "");
  if (e.target.value !== sanitized) {
    e.target.value = sanitized;
  }
  clearNimBtn.classList.toggle("hidden", !e.target.value);
  if (formMessage.textContent) {
    setMessage("");
  }
});

clearNimBtn.addEventListener("click", () => {
  nimInput.value = "";
  clearNimBtn.classList.add("hidden");
  nimInput.focus();
  setMessage("");
});

// Tab Switcher for Payment Instructions
document.querySelectorAll(".tab-button").forEach((btn) => {
  btn.addEventListener("click", () => {
    const targetTabId = btn.getAttribute("data-tab");
    document.querySelectorAll(".tab-button").forEach((b) => {
      b.classList.remove("active");
      b.setAttribute("aria-selected", "false");
    });
    document.querySelectorAll(".tab-panel").forEach((p) => {
      p.classList.add("hidden");
      p.classList.remove("active");
    });

    btn.classList.add("active");
    btn.setAttribute("aria-selected", "true");
    const targetPanel = document.getElementById(targetTabId);
    if (targetPanel) {
      targetPanel.classList.remove("hidden");
      targetPanel.classList.add("active");
    }
  });
});

// Share / Copy Billing Summary for WhatsApp
if (shareSummaryButton) {
  shareSummaryButton.addEventListener("click", async () => {
    if (!currentLookupData) return;

    const student = currentLookupData.student || {};
    const summary = currentLookupData.summary || {};
    const bills = currentLookupData.bills || [];
    const primaryBriva = bills[0]?.briva || "-";
    const statusText = paymentStatusBadge.textContent || "Belum Lunas";

    const textToShare = [
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

    try {
      await navigator.clipboard.writeText(textToShare);
      showToast("Rincian tagihan disalin! Siap dibagikan ke WhatsApp.");
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
      } catch {
        showToast("Gagal menyalin rincian tagihan secara otomatis.");
      }
      document.body.removeChild(textarea);
    }
  });
}

// Check Another NIM Button
if (newLookupButton) {
  newLookupButton.addEventListener("click", () => {
    currentLookupData = null;
    nimInput.value = "";
    clearNimBtn.classList.add("hidden");
    nimInput.focus();
    showEmpty();
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

// Form Lookup Submission
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const rawNim = String(nimInput.value || "").trim();

  if (!rawNim) {
    setMessage("Silakan masukkan NIM terlebih dahulu.", "error");
    nimInput.focus();
    return;
  }

  submitButton.disabled = true;
  submitButton.querySelector(".btn-spinner").classList.remove("hidden");
  submitButton.querySelector(".btn-icon").classList.add("hidden");
  setMessage("Sedang memeriksa data tagihan...", "info");

  try {
    const response = await fetch("/api/lookup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ nim: rawNim }),
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      showEmpty();
      const errMessage = result.error?.message || "Data tagihan tidak ditemukan. Pastikan NIM sesuai.";
      setMessage(errMessage, "error");
      return;
    }

    renderResult(result.data);
    setMessage("");
  } catch (error) {
    showEmpty();
    setMessage("Koneksi ke server terputus atau server sedang dalam pemeliharaan.", "error");
  } finally {
    submitButton.disabled = false;
    submitButton.querySelector(".btn-spinner").classList.add("hidden");
    submitButton.querySelector(".btn-icon").classList.remove("hidden");
  }
});
