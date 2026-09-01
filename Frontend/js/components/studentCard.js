// Student Profile Card Component
// UT SALUT Awwabin Tangerang

import { normalizeStatus, summarizePaymentStatus } from "../utils/formatters.js";

/**
 * Render student profile information and payment status badge.
 * @param {object} params
 * @param {object} params.student
 * @param {Array} params.bills
 * @param {string} [params.paymentStatus]
 * @param {number} [params.totalAmount]
 * @param {number} [params.paidAmount]
 * @param {number} [params.remainingAmount]
 */
export function renderStudentProfile({
  student = {},
  bills = [],
  paymentStatus = "",
  totalAmount = 0,
  paidAmount = 0,
  remainingAmount = 0,
}) {
  const studentNameEl = document.querySelector("#student-name");
  const studentNimEl = document.querySelector("#student-nim");
  const studentProgramEl = document.querySelector("#student-program");
  const studentPeriodEl = document.querySelector("#student-period");
  const dueDateBoxEl = document.querySelector("#due-date-box");
  const studentDueDateEl = document.querySelector("#student-due-date");
  const paymentStatusBadgeEl = document.querySelector("#payment-status-badge");

  if (studentNameEl) studentNameEl.textContent = student.full_name || "-";
  if (studentNimEl) studentNimEl.textContent = student.nim || "-";
  if (studentProgramEl) studentProgramEl.textContent = student.program_study || "-";
  if (studentPeriodEl) {
    studentPeriodEl.textContent = student.payment_period || (bills[0] ? bills[0].period : "-");
  }

  if (dueDateBoxEl && studentDueDateEl) {
    if (student.due_date_formatted) {
      studentDueDateEl.textContent = student.due_date_formatted;
      dueDateBoxEl.classList.remove("hidden");
    } else {
      dueDateBoxEl.classList.add("hidden");
    }
  }

  if (paymentStatusBadgeEl) {
    const canonicalStatus = normalizeStatus(paymentStatus || summarizePaymentStatus(bills));
    paymentStatusBadgeEl.className = "status-badge";

    if (canonicalStatus === "paid" || (totalAmount > 0 && remainingAmount === 0)) {
      paymentStatusBadgeEl.textContent = "Lunas";
      paymentStatusBadgeEl.classList.add("status-paid");
    } else if (canonicalStatus === "partial" || (paidAmount > 0 && remainingAmount > 0)) {
      paymentStatusBadgeEl.textContent = "Lunas Sebagian";
      paymentStatusBadgeEl.classList.add("status-partial");
    } else {
      paymentStatusBadgeEl.textContent = "Belum Lunas";
      paymentStatusBadgeEl.classList.add("status-unpaid");
    }
  }
}
