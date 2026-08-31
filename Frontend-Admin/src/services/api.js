/**
 * Compatibility re-export barrel for api services.
 * Individual domain modules should be preferred for imports:
 * - ./http.js
 * - ./authApi.js
 * - ./dashboardApi.js
 * - ./studentsApi.js
 * - ./billsApi.js
 * - ./masterApi.js
 * - ./reportsApi.js
 * - ./importApi.js
 * - ./usersApi.js
 */

export { BASE_URL, apiFetch, isAbortError } from './http.js';
export { authApi } from './authApi.js';
export { dashboardApi } from './dashboardApi.js';
export { studentsApi } from './studentsApi.js';
export { templateApi, masterApi } from './masterApi.js';
export { billsApi } from './billsApi.js';
export { reportsApi } from './reportsApi.js';
export { importApi } from './importApi.js';
export { usersApi } from './usersApi.js';
