import test from 'node:test';
import assert from 'node:assert/strict';

import { buildActivationScope, validateActivationScope } from './billActivationModel.js';

test('buildActivationScope builds scope targeting one program', () => {
  const scope = buildActivationScope({
    period: '2026.1',
    studyProgramId: 'sp_sifo',
    isActive: false,
    confirmAllPrograms: false,
  });
  assert.deepEqual(scope, {
    period: '2026.1',
    study_program_id: 'sp_sifo',
    is_active: false,
    mode: 'all',
    replacement_period: null,
    confirm_all_programs: false,
  });
  assert.equal(validateActivationScope(scope), '');
});

test('all-program scope requires explicit confirmation', () => {
  const scope = buildActivationScope({
    period: '2026.1',
    studyProgramId: '',
    isActive: false,
    confirmAllPrograms: false,
  });
  assert.match(validateActivationScope(scope), /semua program studi/i);
});

test('all-program scope passes validation when confirmed', () => {
  const scope = buildActivationScope({
    period: '2026.1',
    studyProgramId: '',
    isActive: true,
    confirmAllPrograms: true,
  });
  assert.equal(validateActivationScope(scope), '');
});
