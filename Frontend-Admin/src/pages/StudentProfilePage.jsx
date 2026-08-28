import React from 'react';
import { BillingTab } from '../components/student-profile/BillingTab';
import { ProfileTab } from '../components/student-profile/ProfileTab';
import { StatisticsTab } from '../components/student-profile/StatisticsTab';
import { StudentEditTab } from '../components/student-profile/StudentEditTab';
import { StudentProfileHeader } from '../components/student-profile/StudentProfileHeader';
import { StudentProfileSidebar } from '../components/student-profile/StudentProfileSidebar';
import { StudentProfileTabs } from '../components/student-profile/StudentProfileTabs';
import { TransactionHistoryTab } from '../components/student-profile/TransactionHistoryTab';
import { useAuth } from '../context/AuthContext';
import { useStudentProfile } from '../hooks/useStudentProfile';

function ProfileLoadingState() {
  return (
    <div className="table-empty-container">
      <div className="loading-spinner-circle empty-state-icon" />
      <p className="loading-state-text">Memuat data profil mahasiswa...</p>
    </div>
  );
}

export default function StudentProfilePage({ studentId, initialTab = 'profile', navigateTo }) {
  const { can } = useAuth();
  const profile = useStudentProfile({ studentId, initialTab });

  if (profile.loading && !profile.data) return <ProfileLoadingState />;

  const student = profile.data?.student || {};
  const summary = profile.data?.summary || {};
  const bills = profile.data?.bills || [];
  const initialHistory = profile.data?.payment_history || [];
  const totalAmount = Number(summary.total_amount || 0);
  const totalPaid = Number(summary.total_paid || 0);
  const totalOutstanding = Number(summary.total_outstanding || 0);
  const percentPaid =
    totalAmount > 0 ? Math.min(100, Math.round((totalPaid / totalAmount) * 100)) : 0;
  const canManageStudents = can('manage_students');
  const canManageBilling = can('manage_billing');

  return (
    <div className="profile-page-container">
      <StudentProfileHeader
        activeTab={profile.activeTab}
        canManageStudents={canManageStudents}
        navigateTo={navigateTo}
        onRefresh={profile.fetchStudentData}
        onTabChange={profile.setActiveTab}
        student={student}
      />
      <div className="profile-layout-grid">
        <StudentProfileSidebar
          copiedKey={profile.copiedKey}
          onCopy={profile.handleCopy}
          student={student}
          summary={summary}
        />
        <div className="profile-right-col">
          <div className="panel-card profile-tabs-card">
            <StudentProfileTabs
              activeTab={profile.activeTab}
              billCount={bills.length}
              canManageStudents={canManageStudents}
              historyCount={initialHistory.length}
              onChange={profile.setActiveTab}
            />
            {profile.activeTab === 'profile' && (
              <ProfileTab
                bills={bills}
                canManageBilling={canManageBilling}
                copiedKey={profile.copiedKey}
                navigateTo={navigateTo}
                onCopy={profile.handleCopy}
                student={student}
              />
            )}
            {profile.activeTab === 'stats' && (
              <StatisticsTab
                percentPaid={percentPaid}
                summary={summary}
                totalOutstanding={totalOutstanding}
              />
            )}
            {profile.activeTab === 'billing' && (
              <BillingTab
                bills={bills}
                canManageBilling={canManageBilling}
                copiedKey={profile.copiedKey}
                navigateTo={navigateTo}
                onCopy={profile.handleCopy}
                studentName={student.full_name}
              />
            )}
            {profile.activeTab === 'history' && (
              <TransactionHistoryTab
                historyList={profile.historyList}
                loading={profile.historyLoading}
                onFetch={profile.fetchHistory}
                pagination={profile.historyPagination}
                studentName={student.full_name}
              />
            )}
            {profile.activeTab === 'edit' && canManageStudents && (
              <StudentEditTab
                editError={profile.editError}
                form={profile.editForm}
                onCancel={() => profile.setActiveTab('profile')}
                onChange={profile.setEditForm}
                onSubmit={profile.saveEdit}
                prodis={profile.prodis}
                saving={profile.savingEdit}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

StudentProfilePage.displayName = 'StudentProfilePage';
