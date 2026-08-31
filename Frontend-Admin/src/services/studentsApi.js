import { apiFetch } from './http.js';

/**
 * Student management API client.
 */
export const studentsApi = {
  /**
   * Lists students with search, filters, and sorting.
   *
   * @param {Record<string, any>} [params={}]
   * @param {RequestInit} [options={}]
   * @returns {Promise<any>}
   */
  list: (params = {}, options = {}) => {
    const query = new URLSearchParams();
    if (params.query) query.set('query', params.query);
    if (params.study_program_id) query.set('study_program_id', params.study_program_id);
    if (params.academic_status) query.set('academic_status', params.academic_status);
    if (params.entry_period) query.set('entry_period', params.entry_period);
    if (params.entry_year) query.set('entry_year', String(params.entry_year));
    if (params.sort_by) query.set('sort_by', params.sort_by);
    if (params.limit) query.set('limit', String(params.limit));
    return apiFetch(`/admin/students?${query.toString()}`, options);
  },

  /**
   * Retrieves comprehensive 360 profile detail for a student.
   *
   * @param {string} id
   * @param {RequestInit} [options={}]
   * @returns {Promise<any>}
   */
  getDetail: (id, options = {}) => apiFetch(`/admin/students/${id}/detail`, options),

  /**
   * Creates a new student record.
   *
   * @param {Record<string, any>} data
   * @param {RequestInit} [options={}]
   * @returns {Promise<any>}
   */
  create: (data, options = {}) =>
    apiFetch('/admin/students', {
      ...options,
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /**
   * Updates an existing student record.
   *
   * @param {string} id
   * @param {Record<string, any>} data
   * @param {RequestInit} [options={}]
   * @returns {Promise<any>}
   */
  update: (id, data, options = {}) =>
    apiFetch(`/admin/students/${id}`, {
      ...options,
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  /**
   * Soft-deletes a student record with audit reason.
   *
   * @param {string} id
   * @param {string} reason
   * @param {RequestInit} [options={}]
   * @returns {Promise<any>}
   */
  delete: (id, reason, options = {}) =>
    apiFetch(`/admin/students/${id}`, {
      ...options,
      method: 'DELETE',
      body: JSON.stringify({ reason }),
    }),

  /**
   * Fetches billing transaction ledger history for a student.
   *
   * @param {string} id
   * @param {Record<string, any>} [params={}]
   * @param {RequestInit} [options={}]
   * @returns {Promise<any>}
   */
  getTransactions: (id, params = {}, options = {}) =>
    apiFetch(
      `/admin/students/${id}/transactions?limit=${params.limit || 50}&offset=${params.offset || 0}`,
      options,
    ),
};
