import test from 'node:test';
import assert from 'node:assert/strict';

import { buildActivationScope, validateActivationScope } from './billActivationModel.js';

test('safe activation scope targets a replacement period and one program', () => {
  const scope = buildActivationScope({
    period: '2026.1',
    studyProgramId: 'sp_sifo',
    isActive: false,
    mode: 'with_replacement',
    replacementPeriod: '2026.2',
    confirmAllPrograms: false,
  });
  assert.deepEqual(scope, {
    period: '2026.1',
    study_program_id: 'sp_sifo',
    is_active: false,
    mode: 'with_replacement',
    replacement_period: '2026.2',
    confirm_all_programs: false,
  });
  assert.equal(validateActivationScope(scope, { requireProdi: true }), '');
});

test('all-program scope requires explicit confirmation', () => {
  const scope = buildActivationScope({
    period: '2026.1',
    studyProgramId: '',
    isActive: false,
    mode: 'all',
    replacementPeriod: '',
    confirmAllPrograms: false,
  });
  assert.match(validateActivationScope(scope), /semua program studi/i);
});

test('reactivation always uses all mode without replacement period', () => {
  const scope = buildActivationScope({
    period: '2026.1',
    studyProgramId: 'sp_sifo',
    isActive: true,
    mode: 'with_replacement',
    replacementPeriod: '2026.2',
    confirmAllPrograms: false,
  });
  assert.equal(scope.mode, 'all');
  assert.equal(scope.replacement_period, null);
});
