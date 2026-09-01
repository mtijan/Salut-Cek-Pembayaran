import React from 'react';
import BillHistoryModal from '../components/bills/BillHistoryModal';
import BillActivationModal from '../components/bills/BillActivationModal';
import BillsFilters from '../components/bills/BillsFilters';
import BillsStats from '../components/bills/BillsStats';
import BillsTable from '../components/bills/BillsTable';
import ConfirmModal from '../components/common/ConfirmModal';
import { useAuth } from '../context/AuthContext';
import { useBillsPage } from '../hooks/useBillsPage';
import { formatRupiah } from '../utils/currency';

export default function BillsPage({ navigateTo }) {
  const { can } = useAuth();
  const page = useBillsPage();
  const canManage = can('manage_billing');
  return (
    <div>
      <BillsStats
        stats={page.stats}
        selectedStatus={page.filters.selectedStatus}
        hasActiveFilter={page.hasActiveFilter}
        actions={page.actions}
      />
      <div className="panel-card">
        <BillsFilters
          filters={page.filters}
          options={page.options}
          hasActiveFilter={page.hasActiveFilter}
          selectedActivation={page.filters.selectedActivation}
          activeFilterChips={page.activeFilterChips}
          canManage={canManage}
          actions={page.actions}
          navigateTo={navigateTo}
        />
        <BillsTable
          bills={page.bills}
          loading={page.loading}
          totalCount={page.totalCount}
          stats={page.stats}
          copiedKey={page.copiedKey}
          hasActiveFilter={page.hasActiveFilter}
          pagination={page.pagination}
          canManage={canManage}
          actions={page.actions}
          navigateTo={navigateTo}
        />
      </div>
      <BillHistoryModal history={page.history} onClose={page.actions.closeHistory} />
      <BillActivationModal
        isOpen={Boolean(page.activation.target)}
        onClose={page.actions.closeActivation}
        onApplied={page.actions.handleActivationApplied}
        targetBill={page.activation.target}
      />
      {page.deleteTarget && (
        <ConfirmModal
          isOpen={Boolean(page.deleteTarget)}
          title="Hapus Data Tagihan"
          message={`Apakah Anda yakin ingin menghapus tagihan sebesar ${page.deleteTarget.amount_formatted || formatRupiah(page.deleteTarget.amount)} untuk ${page.deleteTarget.student_name || page.deleteTarget.full_name}? Tindakan ini akan dicatat ke audit log.`}
          confirmLabel="Hapus Tagihan"
          danger
          requireReason
          reasonPlaceholder="Alasan penghapusan data tagihan..."
          onConfirm={page.actions.confirmDelete}
          onCancel={() => page.actions.setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
