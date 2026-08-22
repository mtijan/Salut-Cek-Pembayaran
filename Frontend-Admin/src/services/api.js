const BASE_URL = '/api';

export async function apiFetch(endpoint, options = {}) {
  const defaultHeaders = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  // If body is FormData, delete Content-Type to let the browser set boundary
  if (options.body instanceof FormData) {
    delete defaultHeaders['Content-Type'];
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers: defaultHeaders,
  });

  const json = await response.json().catch(() => ({
    success: false,
    error: { message: 'Gagal memproses respon server.' },
  }));

  if (!response.ok || !json.success) {
    const error = new Error(json.error?.message || 'Terjadi kesalahan pada sistem.');
    error.status = response.status;
    error.code = json.error?.code;
    error.details = json.error?.details;
    throw error;
  }

  return json.data;
}

// Auth API
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

// Dashboard API
export const dashboardApi = {
  getStats: () => apiFetch('/admin/dashboard/stats'),
};

// Students API
export const studentsApi = {
  list: (params = {}) => {
    const query = new URLSearchParams();
    if (params.query) query.set('query', params.query);
    if (params.study_program_id) query.set('study_program_id', params.study_program_id);
    if (params.academic_status) query.set('academic_status', params.academic_status);
    if (params.entry_period) query.set('entry_period', params.entry_period);
    if (params.entry_year) query.set('entry_year', String(params.entry_year));
    if (params.sort_by) query.set('sort_by', params.sort_by);
    return apiFetch(`/admin/students?${query.toString()}`);
  },
  getDetail: (id) => apiFetch(`/admin/students/${id}/detail`),
  create: (data) =>
    apiFetch('/admin/students', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id, data) =>
    apiFetch(`/admin/students/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  delete: (id, reason) =>
    apiFetch(`/admin/students/${id}`, {
      method: 'DELETE',
      body: JSON.stringify({ reason }),
    }),
  getTransactions: (id, params = {}) =>
    apiFetch(`/admin/students/${id}/transactions?limit=${params.limit || 50}&offset=${params.offset || 0}`),
};

// Template API
export const templateApi = {
  downloadMasterDataUrl: () => `${BASE_URL}/admin/template/master-data`,
};

// Bills API
export const billsApi = {
  list: (params = {}) => {
    const query = new URLSearchParams();
    if (params.query) query.set('query', params.query);
    if (params.status) query.set('status', params.status);
    if (params.source) query.set('source', params.source);
    if (params.limit) query.set('limit', String(params.limit));
    if (params.offset) query.set('offset', String(params.offset));
    return apiFetch(`/admin/bills?${query.toString()}`);
  },
  updateStatus: (bill_id, status, paid_amount = null, metadata = {}) =>
    apiFetch('/admin/bills/status', {
      method: 'POST',
      body: JSON.stringify({ bill_id, status, paid_amount, ...metadata }),
    }),
  create: (data) =>
    apiFetch('/admin/bills', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id, data) =>
    apiFetch(`/admin/bills/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  delete: (id, reason) =>
    apiFetch(`/admin/bills/${id}`, {
      method: 'DELETE',
      body: JSON.stringify({ reason }),
    }),
  getTransactions: (id, params = {}) =>
    apiFetch(`/admin/bills/${id}/transactions?limit=${params.limit || 50}&offset=${params.offset || 0}`),
};

// Reports API
export const reportsApi = {
  getFinancialSummary: (period = '') => apiFetch(`/admin/reports/financial-summary${period ? `?period=${encodeURIComponent(period)}` : ''}`),
};

// Master Data API
export const masterApi = {
  listProdi: () => apiFetch('/admin/study-programs'),
  createProdi: (data) =>
    apiFetch('/admin/study-programs', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateProdi: (id, data) =>
    apiFetch(`/admin/study-programs/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  deleteProdi: (id) =>
    apiFetch(`/admin/study-programs/${id}`, {
      method: 'DELETE',
    }),

  listPeriods: () => apiFetch('/admin/academic-periods'),
  createPeriod: (data) =>
    apiFetch('/admin/academic-periods', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updatePeriod: (id, data) =>
    apiFetch(`/admin/academic-periods/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
};

// Import API
export const importApi = {
  getGroups: () => apiFetch('/admin/imported-bills'),
  deleteFile: (file_name, reason) =>
    apiFetch('/admin/imported-files', {
      method: 'DELETE',
      body: JSON.stringify({ file_name, reason }),
    }),
  preview: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiFetch('/admin/import/preview', {
      method: 'POST',
      body: formData,
    });
  },
  commit: (token, confirm_updates = false) =>
    apiFetch('/admin/import/commit', {
      method: 'POST',
      body: JSON.stringify({
        import_token: token,
        confirm_updates: Boolean(confirm_updates),
      }),
    }),
};
