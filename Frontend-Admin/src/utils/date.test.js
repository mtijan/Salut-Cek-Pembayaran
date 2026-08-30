import test from 'node:test';
import assert from 'node:assert/strict';

import { toLocalDateInputValue } from './date.js';

test('toLocalDateInputValue uses local calendar fields instead of a UTC date slice', () => {
  const localDate = {
    getFullYear: () => 2026,
    getMonth: () => 7,
    getDate: () => 30,
  };

  assert.equal(toLocalDateInputValue(localDate), '2026-08-30');
});

test('toLocalDateInputValue zero-pads month and day', () => {
  const localDate = {
    getFullYear: () => 2026,
    getMonth: () => 0,
    getDate: () => 4,
  };

  assert.equal(toLocalDateInputValue(localDate), '2026-01-04');
});
