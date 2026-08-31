import { apiFetch } from './http.js';

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
