import { apiFetch } from './http.js';

export const authApi = {
  login: (email, password) =>
    apiFetch('/admin/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  logout: () =>
    apiFetch('/admin/logout', {
      method: 'POST',
    }),
  getMe: () => apiFetch('/admin/me'),
};
