import { apiFetch } from './http.js';

export const dashboardApi = {
  getStats: () => apiFetch('/admin/dashboard/stats'),
};
