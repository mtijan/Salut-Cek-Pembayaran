import { apiFetch } from './http.js';

/**
 * Authentication API client.
 */
export const authApi = {
  /**
   * Performs administrator login with email and password credentials.
   *
   * @param {string} email
   * @param {string} password
   * @param {RequestInit} [options={}]
   * @returns {Promise<any>}
   */
  login: (email, password, options = {}) =>
    apiFetch('/admin/login', {
      ...options,
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  /**
   * Logs out the current administrator session.
   *
   * @param {RequestInit} [options={}]
   * @returns {Promise<any>}
   */
  logout: (options = {}) =>
    apiFetch('/admin/logout', {
      ...options,
      method: 'POST',
    }),

  /**
   * Retrieves the currently authenticated administrator user profile.
   *
   * @param {RequestInit} [options={}]
   * @returns {Promise<any>}
   */
  getMe: (options = {}) => apiFetch('/admin/me', options),
};
