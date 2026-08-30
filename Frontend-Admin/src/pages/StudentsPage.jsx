import React from 'react';
import ConfirmModal from '../components/common/ConfirmModal';
import StudentEditorModal from '../components/students/StudentEditorModal';
import StudentsFilters from '../components/students/StudentsFilters';
import StudentsStats from '../components/students/StudentsStats';
import StudentsTable from '../components/students/StudentsTable';
import { useAuth } from '../context/AuthContext';
import { useStudentsPage } from '../hooks/useStudentsPage';
import Student360Modal from '../components/student-360/Student360Modal';

export default function StudentsPage({ navigateTo }) {
  const { can } = useAuth();
  const page = useStudentsPage();
  const canManage = can('manage_students');
  return (
    <div>
      <StudentsStats stats={page.stats} />
      <div className="panel-card">
        <StudentsFilters
          filters={page.filters}
          prodis={page.prodis}
          canManage={canManage}
          actions={page.actions}
        />
        <StudentsTable
          students={page.students}
          paginatedStudents={page.paginatedStudents}
          loading={page.loading}
          copiedKey={page.copiedKey}
          pagination={page.pagination}
          canManage={canManage}
          actions={page.actions}
          navigateTo={navigateTo}
        />
      </div>
      <Student360Modal
        studentId={page.modal.selected360Id}
        isOpen={Boolean(page.modal.selected360Id)}
        onClose={() => page.actions.setSelected360Id(null)}
      />
      <StudentEditorModal
        modal={page.modal}
        editor={page.editor}
        prodis={page.prodis}
        actions={page.actions}
      />
      <ConfirmModal
        isOpen={Boolean(page.modal.deleteTarget)}
        title="Hapus Mahasiswa"
        description={`Apakah Anda yakin ingin menghapus mahasiswa "${page.modal.deleteTarget?.full_name}" (${page.modal.deleteTarget?.nim}) beserta seluruh riwayat tagihannya?`}
        confirmText="Hapus Mahasiswa"
        onConfirm={page.actions.confirmDelete}
        onClose={() => page.actions.setDeleteTarget(null)}
      />
    </div>
  );
}
