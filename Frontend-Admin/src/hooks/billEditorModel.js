const DEFAULT_INSTRUCTIONS = 'Bayar melalui BRIVA BRI dengan nomor BRIVA yang tampil.';
const KNOWN_BILL_TYPES = ['UKT', 'WISUDA', 'PRAKTIKUM', 'REGISTRASI'];

export const initialBillFormData = {
  student_id: '',
  nim: '',
  full_name: '',
  period_mode: 'master',
  period: '20251',
  custom_period: '',
  bill_type_mode: 'UKT',
  custom_bill_type: '',
  amount: '',
  paid_amount: '0',
  briva: '',
  status: 'unpaid',
  due_date: '',
  instructions: DEFAULT_INSTRUCTIONS,
  notes: '',
};

export function createBillFormData({ bill, student, periods }) {
  const rawPeriod = bill.period || '';
  const isPeriodInList = periods.some(
    (period) => period.code === rawPeriod || period.name === rawPeriod,
  );
  const rawType = bill.bill_type || 'UKT';
  const normalizedType = rawType.toUpperCase();
  const isKnownType = KNOWN_BILL_TYPES.includes(normalizedType);

  return {
    student_id: bill.student_id || student.id || '',
    nim: student.nim || bill.nim || '',
    full_name: student.full_name || bill.full_name || '',
    period_mode: isPeriodInList ? 'master' : rawPeriod ? 'custom' : 'master',
    period: isPeriodInList ? rawPeriod : periods[0]?.code || '20251',
    custom_period: !isPeriodInList ? rawPeriod : '',
    bill_type_mode: isKnownType ? normalizedType : 'Custom',
    custom_bill_type: !isKnownType ? rawType : '',
    amount: String(bill.amount || ''),
    paid_amount: String(bill.paid_amount || '0'),
    briva: bill.briva || '',
    status: bill.status || 'unpaid',
    due_date: bill.due_date ? String(bill.due_date).slice(0, 10) : '',
    instructions: bill.instructions || DEFAULT_INSTRUCTIONS,
    notes: '',
  };
}
