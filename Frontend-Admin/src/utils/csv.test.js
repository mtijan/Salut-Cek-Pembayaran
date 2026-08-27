import test from 'node:test';
import assert from 'node:assert/strict';

import { csvCell, toCsv } from './csv.js';

test('csvCell neutralizes direct spreadsheet formula prefixes', () => {
  for (const value of ['=1+1', '+SUM(A1:A2)', '-10+20', '@cmd']) {
    assert.equal(csvCell(value), `"'${value}"`);
  }
});

test('csvCell neutralizes formula prefixes hidden by whitespace or control characters', () => {
  for (const value of [' =1+1', '\t+SUM(A1:A2)', '\r-10+20', '\n@cmd']) {
    assert.equal(csvCell(value), `"'${value}"`);
  }
});

test('csvCell escapes quotes and preserves embedded newlines', () => {
  assert.equal(csvCell('Nama "Contoh"\nBaris 2'), '"Nama ""Contoh""\nBaris 2"');
  assert.equal(
    toCsv([
      ['A', 'B'],
      ['1', '2'],
    ]),
    '"A","B"\r\n"1","2"',
  );
});
