import test from 'node:test';
import assert from 'node:assert/strict';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(testDir, '..', '..', '..');
const frontendJsDir = join(repoRoot, 'Frontend', 'js');

function moduleUrl(...segments) {
  return pathToFileURL(join(frontendJsDir, ...segments)).href;
}

test('portal formatters: rupiah formats numbers correctly', async () => {
  const { rupiah } = await import(moduleUrl('utils', 'formatters.js'));
  assert.equal(rupiah(1500000).replace(/\s/g, ' '), 'Rp 1.500.000');
  assert.equal(rupiah(0).replace(/\s/g, ' '), 'Rp 0');
});

test('portal formatters: normalizeStatus handles aliases cleanly', async () => {
  const { normalizeStatus } = await import(moduleUrl('utils', 'formatters.js'));
  assert.equal(normalizeStatus('paid'), 'paid');
  assert.equal(normalizeStatus('LUNAS'), 'paid');
  assert.equal(normalizeStatus('partial'), 'partial');
  assert.equal(normalizeStatus('Bayar Sebagian'), 'partial');
  assert.equal(normalizeStatus('dicicil'), 'partial');
  assert.equal(normalizeStatus('unpaid'), 'unpaid');
  assert.equal(normalizeStatus('belum lunas'), 'unpaid');
  assert.equal(normalizeStatus('unknown-status'), 'unpaid');
});

test('portal formatters: summarizePaymentStatus calculates aggregate status', async () => {
  const { summarizePaymentStatus } = await import(moduleUrl('utils', 'formatters.js'));
  assert.equal(summarizePaymentStatus([{ status: 'paid' }, { status: 'paid' }]), 'paid');
  assert.equal(summarizePaymentStatus([{ status: 'paid' }, { status: 'partial' }]), 'partial');
  assert.equal(summarizePaymentStatus([{ status: 'unpaid' }, { status: 'paid' }]), 'unpaid');
  assert.equal(summarizePaymentStatus([]), 'unpaid');
});

test('portal formatters: formatBrivaDisplay spaces 15-digit BRIVA properly', async () => {
  const { formatBrivaDisplay } = await import(moduleUrl('utils', 'formatters.js'));
  assert.equal(formatBrivaDisplay('123450000000001'), '12345 0000 0000 01');
  assert.equal(formatBrivaDisplay(''), '-');
  assert.equal(formatBrivaDisplay(null), '-');
});

test('portal shareSummary: buildShareSummaryText creates valid message', async () => {
  const { buildShareSummaryText } = await import(moduleUrl('components', 'shareSummary.js'));
  const sampleData = {
    student: {
      full_name: 'Budi Santoso',
      nim: '000000001',
      program_study: 'Sistem Informasi',
      payment_period: '2026/2027 Ganjil',
      due_date_formatted: '15 September 2026',
    },
    summary: {
      total_amount_formatted: 'Rp 2.000.000',
      paid_amount_formatted: 'Rp 500.000',
      remaining_amount_formatted: 'Rp 1.500.000',
    },
    bills: [
      { briva: '123450000000001' },
    ],
  };

  const text = buildShareSummaryText(sampleData, 'Lunas Sebagian');
  assert.match(text, /TAGIHAN BIAYA KULIAH UT SALUT AWWABIN/);
  assert.match(text, /Nama: Budi Santoso/);
  assert.match(text, /NIM: 000000001/);
  assert.match(text, /Sisa Tagihan \(Wajib Dibayar\): Rp 1\.500\.000/);
  assert.match(text, /Nomor BRIVA: 123450000000001/);
});
