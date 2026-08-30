import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createBillFormData,
  initialBillFormData,
  selectDefaultPeriodCode,
} from './billEditorModel.js';

test('initial bill editor model preserves safe create defaults', () => {
  assert.equal(initialBillFormData.status, 'unpaid');
  assert.equal(initialBillFormData.paid_amount, '0');
  assert.equal(initialBillFormData.period_mode, 'master');
  assert.equal(initialBillFormData.period, '');
});

test('bill editor chooses the active period without a stale hard-coded fallback', () => {
  const periods = [
    { code: '20252', name: '2025 Genap', is_active: 0 },
    { code: '20261', name: '2026 Ganjil', is_active: 1 },
  ];

  assert.equal(selectDefaultPeriodCode(periods), '20261');
  assert.equal(selectDefaultPeriodCode([{ code: '20252' }]), '20252');
  assert.equal(selectDefaultPeriodCode([]), '');
});

test('bill editor model distinguishes master and custom values', () => {
  const periods = [{ code: '20261', name: '2026 Ganjil' }];
  const known = createBillFormData({
    bill: { period: '20261', bill_type: 'ukt', amount: 1000 },
    student: { id: 'student-1', nim: '123', full_name: 'Synthetic Student' },
    periods,
  });
  const custom = createBillFormData({
    bill: { period: 'SPECIAL', bill_type: 'Laboratorium', amount: 2000 },
    student: {},
    periods,
  });

  assert.equal(known.period_mode, 'master');
  assert.equal(known.period, '20261');
  assert.equal(known.bill_type_mode, 'UKT');
  assert.equal(custom.period_mode, 'custom');
  assert.equal(custom.custom_period, 'SPECIAL');
  assert.equal(custom.bill_type_mode, 'Custom');
  assert.equal(custom.custom_bill_type, 'Laboratorium');
});

test('bill editor resolves a stored period name to its selectable period code', () => {
  const result = createBillFormData({
    bill: { period: '2026 Ganjil', bill_type: 'UKT', amount: 1000 },
    student: {},
    periods: [{ code: '20261', name: '2026 Ganjil', is_active: 1 }],
  });

  assert.equal(result.period_mode, 'master');
  assert.equal(result.period, '20261');
  assert.equal(result.custom_period, '');
});
