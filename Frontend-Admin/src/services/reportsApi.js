import { apiFetch } from './http.js';

export const reportsApi = {
  getFinancialSummary: (params = {}) => {
    if (typeof params === 'string') {
      return apiFetch(
        `/admin/reports/financial-summary${params ? `?period=${encodeURIComponent(params)}` : ''}`,
      );
    }
    const query = new URLSearchParams();
    if (params.period) query.set('period', params.period);
    if (params.study_program_id) query.set('study_program_id', params.study_program_id);
    if (params.entry_period) query.set('entry_period', params.entry_period);
    const qs = query.toString();
    return apiFetch(`/admin/reports/financial-summary${qs ? `?${qs}` : ''}`);
  },
};
