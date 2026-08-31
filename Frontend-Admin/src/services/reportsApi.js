import { apiFetch } from './http.js';

/**
 * Reporting and financial summary API client.
 */
export const reportsApi = {
  /**
   * Fetches financial summary data with optional period and study program filters.
   *
   * @param {Record<string, any>|string} [params={}]
   * @param {RequestInit} [options={}]
   * @returns {Promise<any>}
   */
  getFinancialSummary: (params = {}, options = {}) => {
    if (typeof params === 'string') {
      return apiFetch(
        `/admin/reports/financial-summary${params ? `?period=${encodeURIComponent(params)}` : ''}`,
        options,
      );
    }
    const query = new URLSearchParams();
    if (params.period) query.set('period', params.period);
    if (params.study_program_id) query.set('study_program_id', params.study_program_id);
    if (params.entry_period) query.set('entry_period', params.entry_period);
    const qs = query.toString();
    return apiFetch(`/admin/reports/financial-summary${qs ? `?${qs}` : ''}`, options);
  },
};
