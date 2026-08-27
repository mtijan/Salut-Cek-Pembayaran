import { toCsv } from './csv.js';

export function filterAndSortReportStudents(students, { query, selectedStatus, sortBy }) {
  let list = [...students];

  if (query.trim()) {
    const normalizedQuery = query.toLowerCase().trim();
    list = list.filter(
      (student) =>
        student.full_name?.toLowerCase().includes(normalizedQuery) ||
        student.nim?.toLowerCase().includes(normalizedQuery) ||
        student.phone_number?.toLowerCase().includes(normalizedQuery) ||
        student.program_study?.toLowerCase().includes(normalizedQuery) ||
        student.entry_period?.toLowerCase().includes(normalizedQuery),
    );
  }

  if (selectedStatus) {
    list = list.filter((student) => student.status === selectedStatus);
  }

  list.sort((left, right) => {
    if (sortBy === 'amount_desc') return (right.billed_amount || 0) - (left.billed_amount || 0);
    if (sortBy === 'amount_asc') return (left.billed_amount || 0) - (right.billed_amount || 0);
    if (sortBy === 'paid_desc') return (right.paid_amount || 0) - (left.paid_amount || 0);
    if (sortBy === 'outstanding_desc')
      return (right.outstanding_amount || 0) - (left.outstanding_amount || 0);
    if (sortBy === 'rate_desc') return (right.percentage_paid || 0) - (left.percentage_paid || 0);
    if (sortBy === 'name_asc') return (left.full_name || '').localeCompare(right.full_name || '');
    if (sortBy === 'nim_asc') return (left.nim || '').localeCompare(right.nim || '');
    return 0;
  });

  return list;
}

export function calculateReportStats(students) {
  const totals = students.reduce(
    (result, student) => ({
      totalBilled: result.totalBilled + Number(student.billed_amount || 0),
      totalPaid: result.totalPaid + Number(student.paid_amount || 0),
      totalOutstanding: result.totalOutstanding + Number(student.outstanding_amount || 0),
      totalBills: result.totalBills + Number(student.total_bills || 0),
    }),
    { totalBilled: 0, totalPaid: 0, totalOutstanding: 0, totalBills: 0 },
  );

  return {
    totalStudents: students.length,
    ...totals,
    percentagePaid:
      totals.totalBilled > 0
        ? Math.round((totals.totalPaid / totals.totalBilled) * 10000) / 100
        : 0,
  };
}

export function createFinancialReportCsv(students) {
  const headers = [
    'NIM',
    'Nama',
    'Phone Number',
    'Program Studi',
    'Angkatan Masuk',
    'Jumlah Tagihan',
    'Total Tagihan (Rp)',
    'Total Terbayar (Rp)',
    'Sisa Piutang (Rp)',
    'Realisasi (%)',
    'Status Pembayaran',
  ];
  const rows = students.map((student) => [
    `'${student.nim || '-'}`,
    student.full_name || '-',
    student.phone_number && student.phone_number !== '-' ? `'${student.phone_number}` : '-',
    student.program_study || '-',
    student.entry_period || '-',
    student.total_bills,
    student.billed_amount,
    student.paid_amount,
    student.outstanding_amount,
    `${student.percentage_paid}%`,
    student.status_label ||
      (student.status === 'paid'
        ? 'Lunas'
        : student.status === 'partial'
          ? 'Sebagian'
          : 'Belum Bayar'),
  ]);

  return toCsv([headers, ...rows]);
}
