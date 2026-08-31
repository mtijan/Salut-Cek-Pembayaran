import { apiFetch } from './http.js';

export const billsApi = {
  list: (params = {}) => {
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
    return apiFetch(`/admin/bills?${query.toString()}`);
  },
  updateStatus: (bill_id, status, paid_amount = null, metadata = {}) =>
    apiFetch('/admin/bills/status', {
      method: 'POST',
      body: JSON.stringify({ bill_id, status, paid_amount, ...metadata }),
    }),
  create: (data) =>
    apiFetch('/admin/bills', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id, data) =>
    apiFetch(`/admin/bills/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  delete: (id, reason) =>
    apiFetch(`/admin/bills/${id}`, {
      method: 'DELETE',
      body: JSON.stringify({ reason }),
    }),
  getDetail: (id) => apiFetch(`/admin/bills/${id}`),
  recordPayment: (id, data) =>
    apiFetch(`/admin/bills/${id}/payments`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getTransactions: (id, params = {}) =>
    apiFetch(
      `/admin/bills/${id}/transactions?limit=${params.limit || 50}&offset=${params.offset || 0}`,
    ),
};
