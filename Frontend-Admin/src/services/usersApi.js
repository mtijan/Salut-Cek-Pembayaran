import { apiFetch } from './http.js';

export const usersApi = {
  list: () => apiFetch('/admin/users'),
  getDetail: (id) => apiFetch(`/admin/users/${id}`),
  create: (data) =>
    apiFetch('/admin/users', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id, data) =>
    apiFetch(`/admin/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  delete: (id) =>
    apiFetch(`/admin/users/${id}`, {
      method: 'DELETE',
    }),
  resetPassword: (id, password) =>
    apiFetch(`/admin/users/${id}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ password }),
    }),
};
