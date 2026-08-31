import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  UserPlus,
  Edit2,
  KeyRound,
  Trash2,
  CheckCircle2,
  XCircle,
  Search,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { usersApi } from '../services/usersApi';
import UserFormModal from '../components/users/UserFormModal';
import ResetPasswordModal from '../components/users/ResetPasswordModal';

const ROLE_LABELS = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  admin_akademik: 'Admin Akademik',
  admin_keuangan: 'Admin Keuangan',
  viewer: 'Viewer',
};

const DEFAULT_FORM = {
  email: '',
  full_name: '',
  role: 'admin',
  password: '',
  is_active: 1,
};

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);
  const [search, setSearch] = useState('');

  // Modal State
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);

  // Reset Password Modal
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetTargetUser, setResetTargetUser] = useState(null);
  const [resetError, setResetError] = useState(null);
  const [resetSaving, setResetSaving] = useState(false);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await usersApi.list();
      setUsers(data.users || []);
    } catch (err) {
      setError(err.message || 'Gagal memuat daftar administrator.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // Create & Edit Handlers
  const handleOpenCreate = () => {
    setEditingUser(null);
    setForm(DEFAULT_FORM);
    setFormError(null);
    setFormModalOpen(true);
  };

  const handleOpenEdit = (user) => {
    setEditingUser(user);
    setForm({
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      password: '',
      is_active: user.is_active ? 1 : 0,
    });
    setFormError(null);
    setFormModalOpen(true);
  };

  const handleSaveUser = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      if (editingUser) {
        await usersApi.update(editingUser.id, {
          full_name: form.full_name,
          role: form.role,
          is_active: Boolean(form.is_active),
        });
        showToast(`Administrator '${editingUser.email}' berhasil diperbarui.`);
      } else {
        await usersApi.create({
          email: form.email,
          password: form.password,
          full_name: form.full_name,
          role: form.role,
          is_active: Boolean(form.is_active),
        });
        showToast(`Administrator '${form.email}' berhasil dibuat.`);
      }
      setFormModalOpen(false);
      loadUsers();
    } catch (err) {
      setFormError(err.message || 'Gagal menyimpan data administrator.');
    } finally {
      setSaving(false);
    }
  };

  // Reset Password Handlers
  const handleOpenResetPassword = (user) => {
    setResetTargetUser(user);
    setResetError(null);
    setResetModalOpen(true);
  };

  const handleSaveResetPassword = async (newPassword, onSuccess) => {
    setResetSaving(true);
    setResetError(null);
    try {
      await usersApi.resetPassword(resetTargetUser.id, newPassword);
      showToast(`Password untuk '${resetTargetUser.email}' berhasil direset.`);
      onSuccess();
      setResetModalOpen(false);
    } catch (err) {
      setResetError(err.message || 'Gagal mereset password.');
    } finally {
      setResetSaving(false);
    }
  };

  // Status Toggle Handler
  const handleToggleActive = async (user) => {
    const nextStatus = !user.is_active;
    const actionLabel = nextStatus ? 'mengaktifkan' : 'menonaktifkan';
    if (!window.confirm(`Apakah Anda yakin ingin ${actionLabel} akun ${user.email}?`)) {
      return;
    }
    try {
      await usersApi.update(user.id, { is_active: nextStatus });
      showToast(`Akun ${user.email} berhasil ${nextStatus ? 'diaktifkan' : 'dinonaktifkan'}.`);
      loadUsers();
    } catch (err) {
      showToast(err.message || `Gagal mengubah status akun ${user.email}.`, 'error');
    }
  };

  // Delete Handler
  const handleDeleteUser = async (user) => {
    if (
      !window.confirm(
        `PERINGATAN: Apakah Anda yakin ingin menghapus akun ${user.email}?\nSeluruh session aktif pengguna ini akan langsung dicabut.`,
      )
    ) {
      return;
    }
    try {
      await usersApi.delete(user.id);
      showToast(`Akun ${user.email} berhasil dihapus.`);
      loadUsers();
    } catch (err) {
      showToast(err.message || `Gagal menghapus akun ${user.email}.`, 'error');
    }
  };

  const filteredUsers = users.filter((u) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      u.email.toLowerCase().includes(q) ||
      (u.full_name && u.full_name.toLowerCase().includes(q)) ||
      u.role.toLowerCase().includes(q)
    );
  });

  return (
    <div className="users-page">
      {/* Toast Notification */}
      {toast && (
        <div className={toast.type === 'error' ? 'users-toast-error' : 'users-toast-success'}>
          {toast.message}
        </div>
      )}

      {/* Header Banner */}
      <div className="users-header-row">
        <div>
          <h1 className="users-header-title">
            <ShieldCheck size={24} color="#6366f1" />
            Manajemen Pengguna &amp; Hak Akses
          </h1>
          <p className="users-header-desc">
            Kelola akun administrator sistem, pembagian wewenang role RBAC, dan status kredensial.
          </p>
        </div>

        <button type="button" className="btn btn-primary btn-icon-gap" onClick={handleOpenCreate}>
          <UserPlus size={16} />
          Tambah Administrator
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="card users-filter-card">
        <div className="users-filter-row">
          <div className="users-search-box">
            <Search size={16} className="users-search-icon" />
            <input
              type="text"
              className="form-control users-search-input"
              placeholder="Cari berdasarkan email, nama, atau role..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-icon-gap"
            onClick={loadUsers}
            disabled={loading}
            title="Muat Ulang Data"
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            Segarkan
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="modal-alert-danger alert-icon-row">
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Users Table */}
      <div className="card users-table-card">
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Administrator</th>
                <th>Role Akses</th>
                <th>Status</th>
                <th>Dibuat Pada</th>
                <th className="cell-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading && users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="cell-centered-padded">
                    <div className="spinner-centered" />
                    Memuat data administrator...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="cell-centered-padded">
                    Tidak ada data administrator yang sesuai.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const roleLabel = ROLE_LABELS[user.role] || user.role;
                  const roleClass = `role-badge role-badge-${user.role}`;
                  return (
                    <tr key={user.id}>
                      <td>
                        <div className="cell-bold-title">{user.full_name || 'Tanpa Nama'}</div>
                        <div className="cell-subtext">{user.email}</div>
                      </td>
                      <td>
                        <span className={roleClass}>{roleLabel}</span>
                      </td>
                      <td>
                        {user.is_active ? (
                          <span className="status-active-tag">
                            <CheckCircle2 size={14} /> Aktif
                          </span>
                        ) : (
                          <span className="status-inactive-tag">
                            <XCircle size={14} /> Nonaktif
                          </span>
                        )}
                      </td>
                      <td className="cell-subtext">{user.created_at || '-'}</td>
                      <td className="cell-right">
                        <div className="users-actions-group">
                          <button
                            type="button"
                            className="btn btn-sm btn-secondary"
                            onClick={() => handleOpenEdit(user)}
                            title="Edit Role &amp; Profil"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-secondary"
                            onClick={() => handleOpenResetPassword(user)}
                            title="Reset Password"
                          >
                            <KeyRound size={14} />
                          </button>
                          <button
                            type="button"
                            className={`btn btn-sm ${user.is_active ? 'btn-secondary' : 'btn-primary'}`}
                            onClick={() => handleToggleActive(user)}
                            title={user.is_active ? 'Nonaktifkan Akun' : 'Aktifkan Akun'}
                          >
                            {user.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-danger"
                            onClick={() => handleDeleteUser(user)}
                            title="Hapus Akun"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit Modal */}
      <UserFormModal
        isOpen={formModalOpen}
        onClose={() => setFormModalOpen(false)}
        editingUser={editingUser}
        form={form}
        setForm={setForm}
        error={formError}
        saving={saving}
        onSubmit={handleSaveUser}
      />

      {/* Reset Password Modal */}
      <ResetPasswordModal
        isOpen={resetModalOpen}
        onClose={() => setResetModalOpen(false)}
        targetUser={resetTargetUser}
        error={resetError}
        saving={resetSaving}
        onSubmit={handleSaveResetPassword}
      />
    </div>
  );
}

UsersPage.displayName = 'UsersPage';
