import React, { createContext, useContext, useState, useEffect } from 'react';
import { authApi } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = async () => {
    try {
      const data = await authApi.getMe();
      setAdmin(data);
    } catch {
      setAdmin(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const login = async (email, password) => {
    const data = await authApi.login(email, password);
    setAdmin(data);
    return data;
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch {}
    setAdmin(null);
  };

  const isSuperAdmin = admin?.role === 'super_admin';
  const isViewer = admin?.role === 'viewer';
  const isOperationalAdmin = admin?.role === 'admin' || isSuperAdmin;

  return (
    <AuthContext.Provider
      value={{
        admin,
        loading,
        login,
        logout,
        checkAuth,
        isSuperAdmin,
        isViewer,
        isOperationalAdmin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
