import { apiFetch } from './http.js';

export const studentsApi = {
  list: (params = {}) => {
    const query = new URLSearchParams();
    if (params.query) query.set('query', params.query);
    if (params.study_program_id) query.set('study_program_id', params.study_program_id);
    if (params.academic_status) query.set('academic_status', params.academic_status);
    if (params.entry_period) query.set('entry_period', params.entry_period);
    if (params.entry_year) query.set('entry_year', String(params.entry_year));
    if (params.sort_by) query.set('sort_by', params.sort_by);
    if (params.limit) query.set('limit', String(params.limit));
    return apiFetch(`/admin/students?${query.toString()}`);
  },
  getDetail: (id) => apiFetch(`/admin/students/${id}/detail`),
  create: (data) =>
    apiFetch('/admin/students', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id, data) =>
    apiFetch(`/admin/students/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  delete: (id, reason) =>
    apiFetch(`/admin/students/${id}`, {
      method: 'DELETE',
      body: JSON.stringify({ reason }),
    }),
  getTransactions: (id, params = {}) =>
    apiFetch(
      `/admin/students/${id}/transactions?limit=${params.limit || 50}&offset=${params.offset || 0}`,
    ),
};
