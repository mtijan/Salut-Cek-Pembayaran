// Public Student Billing & Payment Portal Application Controller
// UT SALUT Awwabin Tangerang

import { lookupStudentBilling } from "./services/api.js";
import { renderStudentProfile } from "./components/studentCard.js";
import { renderFinancialSummary } from "./components/financialGrid.js";
import { renderBrivaList } from "./components/brivaList.js";
import { handleShareSummary } from "./components/shareSummary.js";
import {
  setMessage,
  showEmptyState,
  showResultState,
  scrollToResultOnMobile,
} from "./utils/dom.js";

// DOM Elements
const form = document.querySelector("#lookup-form");
const nimInput = document.querySelector("#nim");
const clearNimBtn = document.querySelector("#clear-nim");
const submitButton = document.querySelector("#submit-button");
const formMessage = document.querySelector("#form-message");

const emptyState = document.querySelector("#empty-state");
const resultState = document.querySelector("#result-state");
const paymentStatusBadge = document.querySelector("#payment-status-badge");
const shareSummaryButton = document.querySelector("#share-summary-button");
const newLookupButton = document.querySelector("#new-lookup-button");

let currentLookupData = null;

/**
 * Render complete lookup result on the page.
 * @param {object} data
 */
function renderResult(data) {
  currentLookupData = data;
  showResultState(emptyState, resultState);

  const student = data.student || {};
  const bills = data.bills || [];
  const summary = data.summary || {};

  // 1. Calculate & Render Financial Cards
  const { totalAmount, paidAmount, remainingAmount } = renderFinancialSummary({
    bills,
    summary,
  });

  // 2. Render Student Profile & Status Badge
  renderStudentProfile({
    student,
    bills,
    paymentStatus: data.payment_status,
    totalAmount,
    paidAmount,
    remainingAmount,
  });

  // 3. Render BRIVA Virtual Account Cards
  renderBrivaList({
    bills,
    accountName: student.full_name || "-",
  });

  // 4. Scroll to result on mobile viewports
  scrollToResultOnMobile(resultState);
}

/**
 * Setup interactive UI event listeners.
 */
function initApp() {
  // Numeric-only NIM input filter & clear button toggle
  if (nimInput) {
    nimInput.addEventListener("input", (e) => {
      const sanitized = e.target.value.replace(/[^0-9]/g, "");
      if (e.target.value !== sanitized) {
        e.target.value = sanitized;
      }
      if (clearNimBtn) {
        clearNimBtn.classList.toggle("hidden", !e.target.value);
      }
      if (formMessage && formMessage.textContent) {
        setMessage(formMessage, "");
      }
    });
  }

  // Clear NIM button click
  if (clearNimBtn && nimInput) {
    clearNimBtn.addEventListener("click", () => {
      nimInput.value = "";
      clearNimBtn.classList.add("hidden");
      nimInput.focus();
      if (formMessage) setMessage(formMessage, "");
    });
  }

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
    shareSummaryButton.addEventListener("click", () => {
      const statusText = paymentStatusBadge?.textContent || "Belum Lunas";
      handleShareSummary(currentLookupData, statusText);
    });
  }

  // Check Another NIM Button
  if (newLookupButton) {
    newLookupButton.addEventListener("click", () => {
      currentLookupData = null;
      if (nimInput) {
        nimInput.value = "";
        nimInput.focus();
      }
      if (clearNimBtn) clearNimBtn.classList.add("hidden");
      showEmptyState(emptyState, resultState);
      if (formMessage) setMessage(formMessage, "");
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  // Form Submission
  if (form) {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const rawNim = String(nimInput?.value || "").trim();

      if (!rawNim) {
        setMessage(formMessage, "Silakan masukkan NIM terlebih dahulu.", "error");
        nimInput?.focus();
        return;
      }

      const spinner = submitButton?.querySelector(".btn-spinner");
      const icon = submitButton?.querySelector(".btn-icon");

      if (submitButton) submitButton.disabled = true;
      if (spinner) spinner.classList.remove("hidden");
      if (icon) icon.classList.add("hidden");
      setMessage(formMessage, "Sedang memeriksa data tagihan...", "info");

      try {
        const result = await lookupStudentBilling(rawNim);

        if (!result.success) {
          showEmptyState(emptyState, resultState);
          const errMessage =
            result.error?.message || "Data tagihan tidak ditemukan. Pastikan NIM sesuai.";
          setMessage(formMessage, errMessage, "error");
          return;
        }

        renderResult(result.data);
        setMessage(formMessage, "");
      } catch (error) {
        showEmptyState(emptyState, resultState);
        setMessage(
          formMessage,
          "Koneksi ke server terputus atau server sedang dalam pemeliharaan.",
          "error",
        );
      } finally {
        if (submitButton) submitButton.disabled = false;
        if (spinner) spinner.classList.add("hidden");
        if (icon) icon.classList.remove("hidden");
      }
    });
  }
}

// Initialize on DOM load
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp);
} else {
  initApp();
}
