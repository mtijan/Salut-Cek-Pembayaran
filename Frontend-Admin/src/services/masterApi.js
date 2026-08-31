import { apiFetch, BASE_URL } from './http.js';

/**
 * Master data API client for Study Programs and Academic Periods.
 */
export const masterApi = {
  /**
   * Lists all study programs.
   *
   * @param {RequestInit} [options={}]
   * @returns {Promise<any>}
   */
  listProdi: (options = {}) => apiFetch('/admin/study-programs', options),

  /**
   * Creates a new study program.
   *
   * @param {Record<string, any>} data
   * @param {RequestInit} [options={}]
   * @returns {Promise<any>}
   */
  createProdi: (data, options = {}) =>
    apiFetch('/admin/study-programs', {
      ...options,
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /**
   * Updates an existing study program.
   *
   * @param {string} id
   * @param {Record<string, any>} data
   * @param {RequestInit} [options={}]
   * @returns {Promise<any>}
   */
  updateProdi: (id, data, options = {}) =>
    apiFetch(`/admin/study-programs/${id}`, {
      ...options,
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  /**
   * Soft-deletes a study program.
   *
   * @param {string} id
   * @param {RequestInit} [options={}]
   * @returns {Promise<any>}
   */
  deleteProdi: (id, options = {}) =>
    apiFetch(`/admin/study-programs/${id}`, {
      ...options,
      method: 'DELETE',
    }),

  /**
   * Lists all academic periods.
   *
   * @param {RequestInit} [options={}]
   * @returns {Promise<any>}
   */
  listPeriods: (options = {}) => apiFetch('/admin/academic-periods', options),

  /**
   * Creates a new academic period.
   *
   * @param {Record<string, any>} data
   * @param {RequestInit} [options={}]
   * @returns {Promise<any>}
   */
  createPeriod: (data, options = {}) =>
    apiFetch('/admin/academic-periods', {
      ...options,
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /**
   * Updates an existing academic period.
   *
   * @param {string} id
   * @param {Record<string, any>} data
   * @param {RequestInit} [options={}]
   * @returns {Promise<any>}
   */
  updatePeriod: (id, data, options = {}) =>
    apiFetch(`/admin/academic-periods/${id}`, {
      ...options,
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
};

/**
 * Excel template download endpoint URLs.
 */
export const templateApi = {
  /**
   * Returns the direct URL for downloading the master data Excel template.
   *
   * @returns {string}
   */
  downloadMasterDataUrl: () => `${BASE_URL}/admin/template/master-data`,
};
