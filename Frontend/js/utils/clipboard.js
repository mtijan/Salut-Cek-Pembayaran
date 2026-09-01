// Clipboard Copy Utility with Fallback
// UT SALUT Awwabin Tangerang

import { showToast } from "./toast.js";

/**
 * Copy text to user's clipboard and trigger toast feedback.
 * @param {string} text
 * @param {string} [label="Nomor BRIVA"]
 * @returns {Promise<boolean>}
 */
export async function copyToClipboard(text, label = "Nomor BRIVA") {
  const cleanText = String(text || "").replace(/\s+/g, "");
  if (!cleanText) return false;

  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(cleanText);
      showToast(`${label} disalin: ${cleanText}`);
      return true;
    }
    throw new Error("Clipboard API unavailable");
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
      return true;
    } catch {
      showToast(`Gagal menyalin ${label}. Salin manual: ${cleanText}`, 4000);
      return false;
    } finally {
      document.body.removeChild(textarea);
    }
  }
}
