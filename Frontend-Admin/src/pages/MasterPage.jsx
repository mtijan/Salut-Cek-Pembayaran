import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useMasterPage } from '../hooks/useMasterPage';
import ProgramStudyPanel from '../components/master/ProgramStudyPanel';
import ProgramStudyModal from '../components/master/ProgramStudyModal';
import AcademicPeriodPanel from '../components/master/AcademicPeriodPanel';
import AcademicPeriodModal from '../components/master/AcademicPeriodModal';

export default function MasterPage() {
  const { can } = useAuth();
  const m = useMasterPage();
  const [activeTab, setActiveTab] = useState('prodi');
  const canManage = can('manage_master_data');

  return (
    <div>
      {/* Tabs */}
      <div className="tab-bar">
        <button
          type="button"
          className={`tab-btn ${activeTab === 'prodi' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('prodi')}
        >
          Master Program Studi ({m.prodis.length})
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'period' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('period')}
        >
          Master Periode Akademik ({m.periods.length})
        </button>
      </div>

      {/* TAB 1: PROGRAM STUDI */}
      {activeTab === 'prodi' && (
        <ProgramStudyPanel
          prodis={m.prodis}
          loading={m.prodiLoading}
          canManage={canManage}
          onOpenCreate={m.handleOpenProdiCreate}
          onOpenEdit={m.handleOpenProdiEdit}
        />
      )}

      {/* TAB 2: PERIODE AKADEMIK */}
      {activeTab === 'period' && (
        <AcademicPeriodPanel
          periods={m.periods}
          loading={m.periodLoading}
          canManage={canManage}
          onOpenCreate={m.handleOpenPeriodCreate}
          onOpenEdit={m.handleOpenPeriodEdit}
        />
      )}

      {/* Prodi Modal */}
      <ProgramStudyModal
        isOpen={m.prodiModalOpen}
        onClose={() => m.setProdiModalOpen(false)}
        editingProdi={m.editingProdi}
        form={m.prodiForm}
        setForm={m.setProdiForm}
        error={m.prodiError}
        saving={m.prodiSaving}
        onSubmit={m.handleSaveProdi}
      />

      {/* Period Modal */}
      <AcademicPeriodModal
        isOpen={m.periodModalOpen}
        onClose={() => m.setPeriodModalOpen(false)}
        editingPeriod={m.editingPeriod}
        form={m.periodForm}
        setForm={m.setPeriodForm}
        error={m.periodError}
        saving={m.periodSaving}
        onSubmit={m.handleSavePeriod}
      />
    </div>
  );
}

MasterPage.displayName = 'MasterPage';
