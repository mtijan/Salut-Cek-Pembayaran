import React from 'react';
import { ArrowLeft, Edit3, RefreshCw } from 'lucide-react';

export function StudentProfileHeader({
  activeTab,
  canManageStudents,
  navigateTo,
  onRefresh,
  onTabChange,
  student,
}) {
  return (
    <div className="profile-header-bar">
      <div className="profile-breadcrumb-wrap">
        <button
          type="button"
          className="btn btn-secondary back-btn-compact"
          onClick={() => navigateTo('students')}
          title="Kembali ke Data Mahasiswa"
        >
          <ArrowLeft size={16} />
          <span>Kembali</span>
        </button>
        <div className="profile-breadcrumb">
          <span className="crumb-link" onClick={() => navigateTo('students')}>
            Data Mahasiswa
          </span>
          <span className="crumb-sep">/</span>
          <span className="crumb-active">Profil Mahasiswa</span>
          <span className="crumb-sep">/</span>
          <span className="crumb-target">{student.full_name || 'Detail Mahasiswa'}</span>
        </div>
      </div>

      <div className="profile-header-actions">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={onRefresh}
          title="Refresh Data"
        >
          <RefreshCw size={15} />
          <span>Segarkan</span>
        </button>
        {canManageStudents && activeTab !== 'edit' && (
          <button type="button" className="btn btn-primary" onClick={() => onTabChange('edit')}>
            <Edit3 size={15} />
            <span>Edit Data Mahasiswa</span>
          </button>
        )}
      </div>
    </div>
  );
}
