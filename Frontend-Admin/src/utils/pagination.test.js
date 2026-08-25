import test from 'node:test';
import assert from 'node:assert/strict';

import { clampPage } from './pagination.js';

test('clampPage keeps a valid page', () => {
  assert.equal(clampPage(2, 5), 2);
});

test('clampPage moves an out-of-range page to the last available page', () => {
  assert.equal(clampPage(5, 2), 2);
});

test('clampPage normalizes empty and invalid values to page one', () => {
  assert.equal(clampPage(0, 0), 1);
  assert.equal(clampPage('invalid', 'invalid'), 1);
});
