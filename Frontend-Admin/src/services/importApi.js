import { apiFetch } from './http.js';

/**
 * Excel ingestion, preview, and batch import API client.
 */
export const importApi = {
  /**
   * Fetches imported bill batch groups.
   *
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
  preview: (file, options = {}) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiFetch('/admin/import/preview', {
      ...options,
      method: 'POST',
      body: formData,
    });
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
