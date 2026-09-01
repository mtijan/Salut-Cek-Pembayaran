import { apiFetch } from './http.js';

/**
 * Excel ingestion, preview, and batch import API client.
 */
export const importApi = {
  /**
   * Fetches imported bill batch groups.
   *
   * @param {number|string} billingYear
   * @param {'ganjil'|'genap'} semesterType
   * @param {RequestInit} [options={}]
   * @returns {Promise<any>}
   */
  getGroups: (options = {}) => apiFetch('/admin/imported-bills', options),

  /**
   * Deletes an imported file batch and rolls back associated stage records.
   *
   * @param {string} file_name
   * @param {string} reason
   * @param {RequestInit} [options={}]
   * @returns {Promise<any>}
   */
  deleteFile: (file_name, reason, options = {}) =>
    apiFetch('/admin/imported-files', {
      ...options,
      method: 'DELETE',
      body: JSON.stringify({ file_name, reason }),
    }),

  /**
   * Uploads an Excel file for ingestion preview analysis.
   *
   * @param {File|Blob} file
   * @param {RequestInit} [options={}]
   * @returns {Promise<any>}
   */
  preview: (file, billingYear, semesterType, options = {}) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('billing_year', String(billingYear));
    formData.append('semester_type', semesterType);
    return apiFetch('/admin/import/preview', {
      ...options,
      method: 'POST',
      body: formData,
    });
  },

  /** Lists structured row-level issues retained for an active preview token. */
  getPreviewIssues: (
    token,
    { page = 1, limit = 50, severity = '', query = '' } = {},
    options = {},
  ) => {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (severity) params.set('severity', severity);
    if (query) params.set('query', query);
    return apiFetch(
      `/admin/import/previews/${encodeURIComponent(token)}/issues?${params}`,
      options,
    );
  },

  /**
   * Atomically commits an analyzed import token into production tables.
   *
   * @param {string} token
   * @param {boolean} [confirm_updates=false]
   * @param {RequestInit} [options={}]
   * @returns {Promise<any>}
   */
  commit: (token, confirm_updates = false, options = {}) =>
    apiFetch('/admin/import/commit', {
      ...options,
      method: 'POST',
      body: JSON.stringify({
        import_token: token,
        confirm_updates: Boolean(confirm_updates),
      }),
    }),
};
