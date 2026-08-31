import { apiFetch } from './http.js';

/**
 * User management and administrator credential API client.
 */
export const usersApi = {
  /**
   * Lists all administrator users.
   *
   * @param {RequestInit} [options={}]
   * @returns {Promise<any>}
   */
  list: (options = {}) => apiFetch('/admin/users', options),

  /**
   * Retrieves single administrator user detail by ID.
   *
   * @param {string} id
   * @param {RequestInit} [options={}]
   * @returns {Promise<any>}
   */
  getDetail: (id, options = {}) => apiFetch(`/admin/users/${id}`, options),

  /**
   * Creates a new administrator account.
   *
   * @param {Record<string, any>} data
   * @param {RequestInit} [options={}]
   * @returns {Promise<any>}
   */
  create: (data, options = {}) =>
    apiFetch('/admin/users', {
      ...options,
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /**
   * Updates administrator user profile, role, or active status.
   *
   * @param {string} id
   * @param {Record<string, any>} data
   * @param {RequestInit} [options={}]
   * @returns {Promise<any>}
   */
  update: (id, data, options = {}) =>
    apiFetch(`/admin/users/${id}`, {
      ...options,
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  /**
   * Deletes an administrator user account.
   *
   * @param {string} id
   * @param {RequestInit} [options={}]
   * @returns {Promise<any>}
   */
  delete: (id, options = {}) =>
    apiFetch(`/admin/users/${id}`, {
      ...options,
      method: 'DELETE',
    }),

  /**
   * Resets password for an administrator and revokes active sessions.
   *
   * @param {string} id
   * @param {string} password
   * @param {RequestInit} [options={}]
   * @returns {Promise<any>}
   */
  resetPassword: (id, password, options = {}) =>
    apiFetch(`/admin/users/${id}/reset-password`, {
      ...options,
      method: 'POST',
      body: JSON.stringify({ password }),
    }),
};
