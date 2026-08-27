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
import BillEditPage from './pages/BillEditPage';
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
      <div className="auth-check-screen">
        <div className="auth-check-spinner" />
        <span className="auth-check-label">Memeriksa autentikasi admin...</span>
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
          {activeView === 'students' && <StudentsPage navigateTo={navigateTo} />}
          {activeView === 'student-profile' && (
            <StudentProfilePage
              studentId={viewParams.studentId}
              initialTab={viewParams.initialTab || 'profile'}
              navigateTo={navigateTo}
            />
          )}
          {activeView === 'bills' && <BillsPage navigateTo={navigateTo} />}
          {activeView === 'bill-payment' && (
            <BillPaymentPage billId={viewParams.billId} navigateTo={navigateTo} />
          )}
          {activeView === 'bill-edit' && (
            <BillEditPage
              billId={viewParams.billId}
              mode={viewParams.mode}
              navigateTo={navigateTo}
            />
          )}
          {activeView === 'reports' && <ReportsPage navigateTo={navigateTo} />}
          {activeView === 'files' && <FilesPage />}
          {activeView === 'upload' && <UploadPage setActiveView={(view) => navigateTo(view, {})} />}
          {activeView === 'master' && <MasterPage />}
        </main>
      </div>
    </div>
  );
}
