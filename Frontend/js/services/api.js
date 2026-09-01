// API Service for Student Billing Lookup
// UT SALUT Awwabin Tangerang

import { CONFIG } from "../config.js";

/**
 * Fetch billing and student information by NIM.
 * @param {string} nim
 * @returns {Promise<{ success: boolean, data?: any, error?: { code: string, message: string } }>}
 */
export async function lookupStudentBilling(nim) {
  const sanitizedNim = String(nim || "").trim();
  if (!sanitizedNim) {
    return {
      success: false,
      error: { code: "INVALID_NIM", message: "Silakan masukkan NIM terlebih dahulu." },
    };
  }

  try {
    const response = await fetch(CONFIG.API_LOOKUP_ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ nim: sanitizedNim }),
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      return {
        success: false,
        error: result.error || {
          code: "LOOKUP_FAILED",
          message: "Data tagihan tidak ditemukan. Pastikan NIM sesuai.",
        },
      };
    }

    return {
      success: true,
      data: result.data,
    };
  } catch {
    return {
      success: false,
      error: {
        code: "NETWORK_ERROR",
        message: "Koneksi ke server terputus atau server sedang dalam pemeliharaan.",
      },
    };
  }
}
