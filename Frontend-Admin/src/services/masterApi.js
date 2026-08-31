import { apiFetch, BASE_URL } from './http.js';

export const masterApi = {
  listProdi: () => apiFetch('/admin/study-programs'),
  createProdi: (data) =>
    apiFetch('/admin/study-programs', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateProdi: (id, data) =>
    apiFetch(`/admin/study-programs/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  deleteProdi: (id) =>
    apiFetch(`/admin/study-programs/${id}`, {
      method: 'DELETE',
    }),

  listPeriods: () => apiFetch('/admin/academic-periods'),
  createPeriod: (data) =>
    apiFetch('/admin/academic-periods', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updatePeriod: (id, data) =>
    apiFetch(`/admin/academic-periods/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
};

export const templateApi = {
  downloadMasterDataUrl: () => `${BASE_URL}/admin/template/master-data`,
};
