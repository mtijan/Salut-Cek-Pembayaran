import { apiFetch } from './http.js';

/**
 * Billing management and payment ledger API client.
 */
export const billsApi = {
  /**
   * Lists bills with search, multi-field filters, and pagination.
   *
   * @param {Record<string, any>} [params={}]
   * @param {RequestInit} [options={}]
   * @returns {Promise<any>}
   */
  list: (params = {}, options = {}) => {
    const query = new URLSearchParams();
    if (params.query) query.set('query', params.query);
    if (params.status) query.set('status', params.status);
    if (params.source) query.set('source', params.source);
    if (params.study_program_id) query.set('study_program_id', params.study_program_id);
    if (params.period) query.set('period', params.period);
    if (params.bill_type) query.set('bill_type', params.bill_type);
    if (params.entry_period) query.set('entry_period', params.entry_period);
    if (params.sort_by) query.set('sort_by', params.sort_by);
    if (params.limit) query.set('limit', String(params.limit));
    if (params.offset) query.set('offset', String(params.offset));
    return apiFetch(`/admin/bills?${query.toString()}`, options);
  },

  /**
   * Updates payment status and amount of a bill.
   *
   * @param {string} bill_id
   * @param {string} status
   * @param {number|null} [paid_amount=null]
   * @param {Record<string, any>} [metadata={}]
   * @param {RequestInit} [options={}]
   * @returns {Promise<any>}
   */
  updateStatus: (bill_id, status, paid_amount = null, metadata = {}, options = {}) =>
    apiFetch('/admin/bills/status', {
      ...options,
      method: 'POST',
      body: JSON.stringify({ bill_id, status, paid_amount, ...metadata }),
    }),

  /**
   * Creates a new bill record.
   *
   * @param {Record<string, any>} data
   * @param {RequestInit} [options={}]
   * @returns {Promise<any>}
   */
  create: (data, options = {}) =>
    apiFetch('/admin/bills', {
      ...options,
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /**
   * Updates an existing bill.
   *
   * @param {string} id
   * @param {Record<string, any>} data
   * @param {RequestInit} [options={}]
   * @returns {Promise<any>}
   */
  update: (id, data, options = {}) =>
    apiFetch(`/admin/bills/${id}`, {
      ...options,
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  /**
   * Soft-deletes a bill with audit reason.
   *
   * @param {string} id
   * @param {string} reason
   * @param {RequestInit} [options={}]
   * @returns {Promise<any>}
   */
  delete: (id, reason, options = {}) =>
    apiFetch(`/admin/bills/${id}`, {
      ...options,
      method: 'DELETE',
      body: JSON.stringify({ reason }),
    }),

  /**
   * Retrieves bill detail by ID.
   *
   * @param {string} id
   * @param {RequestInit} [options={}]
   * @returns {Promise<any>}
   */
  getDetail: (id, options = {}) => apiFetch(`/admin/bills/${id}`, options),

  /**
   * Records a payment transaction against a bill.
   *
   * @param {string} id
   * @param {Record<string, any>} data
   * @param {RequestInit} [options={}]
   * @returns {Promise<any>}
   */
  recordPayment: (id, data, options = {}) =>
    apiFetch(`/admin/bills/${id}/payments`, {
      ...options,
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /**
   * Retrieves payment transaction ledger history for a bill.
   *
   * @param {string} id
   * @param {Record<string, any>} [params={}]
   * @param {RequestInit} [options={}]
   * @returns {Promise<any>}
   */
  getTransactions: (id, params = {}, options = {}) =>
    apiFetch(
      `/admin/bills/${id}/transactions?limit=${params.limit || 50}&offset=${params.offset || 0}`,
      options,
    ),
};
