import React, { useState } from 'react';
import { useAuth } from './context/AuthContext';
import Sidebar from './components/layout/Sidebar';
import Header from './components/layout/Header';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import StudentsPage from './pages/StudentsPage';
import StudentProfilePage from './pages/StudentProfilePage';
import BillsPage from './pages/BillsPage';
import BillPaymentPage from './pages/BillPaymentPage';
import ReportsPage from './pages/ReportsPage';
import FilesPage from './pages/FilesPage';
import UploadPage from './pages/UploadPage';
import MasterPage from './pages/MasterPage';

export default function App() {
  const { admin, loading } = useAuth();
  const [activeView, setActiveView] = useState('dashboard');
  const [viewParams, setViewParams] = useState({});
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('salut_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const toggleSidebarCollapse = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('salut_sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  };

  const navigateTo = (view, params = {}) => {
    setViewParams(params);
    setActiveView(view);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

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
        setActiveView={(view) => navigateTo(view, {})}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={toggleSidebarCollapse}
      />

      <div className={`app-main ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        <Header
          activeView={activeView}
          onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
          isCollapsed={sidebarCollapsed}
          onToggleCollapse={toggleSidebarCollapse}
        />

        <main className="content-container">
          {activeView === 'dashboard' && (
            <DashboardPage setActiveView={(view) => navigateTo(view, {})} />
          )}
          {activeView === 'students' && (
            <StudentsPage navigateTo={navigateTo} />
          )}
          {activeView === 'student-profile' && (
            <StudentProfilePage
              studentId={viewParams.studentId}
              initialTab={viewParams.initialTab || 'profile'}
              navigateTo={navigateTo}
            />
          )}
          {activeView === 'bills' && (
            <BillsPage navigateTo={navigateTo} />
          )}
          {activeView === 'bill-payment' && (
            <BillPaymentPage
              billId={viewParams.billId}
              navigateTo={navigateTo}
            />
          )}
          {activeView === 'reports' && <ReportsPage />}
          {activeView === 'files' && <FilesPage />}
          {activeView === 'upload' && (
            <UploadPage setActiveView={(view) => navigateTo(view, {})} />
          )}
          {activeView === 'master' && <MasterPage />}
        </main>
      </div>
    </div>
  );
}
