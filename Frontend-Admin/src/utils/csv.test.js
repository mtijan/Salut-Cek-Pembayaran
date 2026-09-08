import test from 'node:test';
import assert from 'node:assert/strict';

import { csvCell, toCsv } from './csv.js';
import { createFinancialReportCsv, filterAndSortReportStudents } from './reports.js';
import { createFinancialReportPdf, createFinancialReportXlsx } from './reportExports.js';

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

test('createFinancialReportCsv includes No BRIVA header and values', () => {
  const students = [
    {
      nim: '000000001',
      full_name: 'Mahasiswa Sintetis',
      briva: '111111110000',
      phone_number: '08000000000',
      program_study: 'S1 Manajemen',
      entry_period: '2026.1',
      total_bills: 1,
      billed_amount: 1850000,
      paid_amount: 1850000,
      outstanding_amount: 0,
      percentage_paid: 100,
      status: 'paid',
      status_label: 'Lunas',
    },
  ];
  const csv = createFinancialReportCsv(students);
  assert.match(csv, /"No BRIVA"/);
  assert.match(csv, /"'111111110000"/);
});

test('financial report keeps multiple BRIVA values as text and searchable', () => {
  const students = [
    {
      nim: '000000001',
      full_name: 'Mahasiswa Sintetis',
      briva: '111111110000, 222222220000',
      total_bills: 2,
      billed_amount: 2000000,
      paid_amount: 0,
      outstanding_amount: 2000000,
      percentage_paid: 0,
      status: 'unpaid',
    },
  ];

  const csv = createFinancialReportCsv(students);
  assert.match(csv, /"'111111110000, 222222220000"/);
  assert.equal(
    filterAndSortReportStudents(students, {
      query: '222222220000',
      selectedStatus: '',
      sortBy: 'amount_desc',
    }).length,
    1,
  );
});

test('financial report exports valid PDF and XLSX download payloads', async () => {
  const students = [
    {
      nim: '000000001',
      full_name: 'Mahasiswa Sintetis',
      briva: '111111110000',
      program_study: 'S1 Manajemen',
      total_bills: 1,
      billed_amount: 1850000,
      paid_amount: 500000,
      outstanding_amount: 1350000,
      percentage_paid: 27.03,
      status: 'partial',
    },
  ];

  const xlsx = new Uint8Array(await createFinancialReportXlsx(students).arrayBuffer());
  assert.deepEqual([...xlsx.slice(0, 4)], [0x50, 0x4b, 0x03, 0x04]);
  assert.match(new globalThis.TextDecoder().decode(xlsx), /Rekap Keuangan/);
  assert.match(new globalThis.TextDecoder().decode(xlsx), /111111110000/);

  const pdf = new Uint8Array(await createFinancialReportPdf(students).arrayBuffer());
  const pdfText = new globalThis.TextDecoder().decode(pdf);
  assert.match(pdfText, /^%PDF-1\.4/);
  assert.match(pdfText, /Rekap Keuangan SALUT AWWABIN/);
  assert.match(pdfText, /%%EOF$/);
});
