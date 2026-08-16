import React, { useState } from 'react';
import { useAuth } from './context/AuthContext';
import Sidebar from './components/layout/Sidebar';
import Header from './components/layout/Header';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import StudentsPage from './pages/StudentsPage';
import BillsPage from './pages/BillsPage';
import ReportsPage from './pages/ReportsPage';
import FilesPage from './pages/FilesPage';
import UploadPage from './pages/UploadPage';
import MasterPage from './pages/MasterPage';

export default function App() {
  const { admin, loading } = useAuth();
  const [activeView, setActiveView] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg)',
          gap: 12,
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            border: '3px solid var(--line)',
            borderTopColor: 'var(--brand)',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }}
        />
        <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
        <span style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 600 }}>
          Memeriksa autentikasi admin...
        </span>
      </div>
    );
  }

  if (!admin) {
    return <LoginPage />;
  }

  return (
    <div className="app-layout">
      <Sidebar
        activeView={activeView}
        setActiveView={setActiveView}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="app-main">
        <Header
          activeView={activeView}
          onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
        />

        <main className="content-container">
          {activeView === 'dashboard' && <DashboardPage setActiveView={setActiveView} />}
          {activeView === 'students' && <StudentsPage />}
          {activeView === 'bills' && <BillsPage />}
          {activeView === 'reports' && <ReportsPage />}
          {activeView === 'files' && <FilesPage />}
          {activeView === 'upload' && <UploadPage setActiveView={setActiveView} />}
          {activeView === 'master' && <MasterPage />}
        </main>
      </div>
    </div>
  );
}
