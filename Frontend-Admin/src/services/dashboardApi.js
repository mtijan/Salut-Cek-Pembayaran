import { apiFetch } from './http.js';

/**
 * Dashboard API client.
 */
export const dashboardApi = {
  /**
   * Fetches overall system and financial summary statistics.
   *
   * @param {RequestInit} [options={}]
   * @returns {Promise<any>}
   */
  getStats: (options = {}) => apiFetch('/admin/dashboard/stats', options),
};
