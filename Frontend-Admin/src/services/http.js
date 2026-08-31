export const BASE_URL = '/api';

/**
 * Checks whether the given error is caused by an aborted HTTP request.
 *
 * @param {unknown} error - The error object to check.
 * @returns {boolean} True if the error is an AbortError.
 */
export function isAbortError(error) {
  if (!error) return false;
  return (
    error.name === 'AbortError' ||
    error.code === 20 ||
    Boolean(typeof error.message === 'string' && /abort|canceled/i.test(error.message))
  );
}

/**
 * Shared HTTP transport client for API requests.
 *
 * @param {string} endpoint - The relative API endpoint.
 * @param {RequestInit} [options={}] - Standard fetch options including method, headers, body, signal.
 * @returns {Promise<any>} The unwrapped JSON response data.
 * @throws {Error} Normalized error with status, code, details, or AbortError.
 */
export async function apiFetch(endpoint, options = {}) {
  const defaultHeaders = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  // If body is FormData, delete Content-Type to let the browser set boundary
  if (options.body instanceof FormData) {
    delete defaultHeaders['Content-Type'];
  }

  let response;
  try {
    response = await fetch(`${BASE_URL}${endpoint}`, {
      ...options,
      headers: defaultHeaders,
    });
  } catch (err) {
    if (isAbortError(err) || options.signal?.aborted) {
      const abortErr = new Error('Request was aborted');
      abortErr.name = 'AbortError';
      throw abortErr;
    }
    throw err;
  }

  const json = await response.json().catch(() => {
    if (options.signal?.aborted) {
      const abortErr = new Error('Request was aborted');
      abortErr.name = 'AbortError';
      throw abortErr;
    }
    return {
      success: false,
      error: { message: 'Gagal memproses respon server.' },
    };
  });

  if (!response.ok || !json.success) {
    const error = new Error(json.error?.message || 'Terjadi kesalahan pada sistem.');
    error.status = response.status;
    error.code = json.error?.code;
    error.details = json.error?.details;
    throw error;
  }

  return json.data;
}
