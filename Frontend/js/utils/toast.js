// Toast Notification Controller
// UT SALUT Awwabin Tangerang

import { CONFIG } from "../config.js";

let toastTimer = null;

/**
 * Display a toast notification with the given text.
 * @param {string} text
 * @param {number} [duration]
 */
export function showToast(text, duration = CONFIG.DEFAULT_TOAST_DURATION) {
  const toast = document.querySelector("#toast");
  const toastMessage = document.querySelector("#toast-message");
  if (!toast || !toastMessage) return;

  if (toastTimer) {
    clearTimeout(toastTimer);
  }
  toastMessage.textContent = text;
  toast.classList.add("show");
  toast.setAttribute("aria-hidden", "false");

  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
    toast.setAttribute("aria-hidden", "true");
  }, duration);
}
