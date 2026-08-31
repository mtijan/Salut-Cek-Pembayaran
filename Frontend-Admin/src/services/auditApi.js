import { apiFetch } from './http.js';

/** Read-only administrative audit-log API client. */
export const auditApi = {
  list: (params = {}, options = {}) => {
    const query = new URLSearchParams();
    if (params.action) query.set('action', params.action);
    if (params.entity_type) query.set('entity_type', params.entity_type);
    if (params.actor_id) query.set('actor_id', params.actor_id);
    if (params.limit) query.set('limit', String(params.limit));
    if (params.offset) query.set('offset', String(params.offset));
    const suffix = query.toString();
    return apiFetch(`/admin/audit-logs${suffix ? `?${suffix}` : ''}`, options);
  },
};
