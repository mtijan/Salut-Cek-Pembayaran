import React from 'react';
import ReportsFilters from '../components/reports/ReportsFilters';
import ReportsStats from '../components/reports/ReportsStats';
import ReportsTable from '../components/reports/ReportsTable';
import { useReportsPage } from '../hooks/useReportsPage';

export default function ReportsPage({ navigateTo }) {
  const reports = useReportsPage();

  return (
    <div>
      <ReportsStats
        stats={reports.stats}
        selectedStatus={reports.filters.selectedStatus}
        actions={reports.actions}
      />

      <div className="panel-card">
        <ReportsFilters
          loading={reports.loading}
          filters={reports.filters}
          options={reports.options}
          hasActiveFilter={reports.hasActiveFilter}
          activeFilterChips={reports.activeFilterChips}
          visibleCount={reports.paginatedStudents.length}
          totalCount={reports.pagination.totalCount}
          actions={reports.actions}
        />
        <ReportsTable
          loading={reports.loading}
          students={reports.paginatedStudents}
          hasActiveFilter={reports.hasActiveFilter}
          copiedKey={reports.copiedKey}
          pagination={reports.pagination}
          actions={reports.actions}
          navigateTo={navigateTo}
        />
      </div>
    </div>
  );
}
