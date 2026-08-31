export const BASE_URL = '/api';

export async function apiFetch(endpoint, options = {}) {
  const defaultHeaders = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  // If body is FormData, delete Content-Type to let the browser set boundary
  if (options.body instanceof FormData) {
    delete defaultHeaders['Content-Type'];
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers: defaultHeaders,
  });

  const json = await response.json().catch(() => ({
    success: false,
    error: { message: 'Gagal memproses respon server.' },
  }));

  if (!response.ok || !json.success) {
    const error = new Error(json.error?.message || 'Terjadi kesalahan pada sistem.');
    error.status = response.status;
    error.code = json.error?.code;
    error.details = json.error?.details;
    throw error;
  }

  return json.data;
}
