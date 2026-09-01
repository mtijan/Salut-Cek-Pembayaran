import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { BASE_URL, apiFetch } from '../../src/services/http.js';
import { authApi } from '../../src/services/authApi.js';
import { dashboardApi } from '../../src/services/dashboardApi.js';
import { studentsApi } from '../../src/services/studentsApi.js';
import { billsApi } from '../../src/services/billsApi.js';
import { masterApi, templateApi } from '../../src/services/masterApi.js';
import { reportsApi } from '../../src/services/reportsApi.js';
import { importApi } from '../../src/services/importApi.js';
import { usersApi } from '../../src/services/usersApi.js';
import { auditApi } from '../../src/services/auditApi.js';

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const sourceDirectory = path.resolve(testDirectory, '../../src');

test('http transport module exports BASE_URL and apiFetch', () => {
  assert.equal(BASE_URL, '/api');
  assert.equal(typeof apiFetch, 'function');
});

test('authApi exports all required authentication methods', () => {
  assert.equal(typeof authApi.login, 'function');
  assert.equal(typeof authApi.logout, 'function');
  assert.equal(typeof authApi.getMe, 'function');
});

test('dashboardApi exports getStats', () => {
  assert.equal(typeof dashboardApi.getStats, 'function');
});

test('studentsApi exports all required student management methods', () => {
  assert.equal(typeof studentsApi.list, 'function');
  assert.equal(typeof studentsApi.getDetail, 'function');
  assert.equal(typeof studentsApi.create, 'function');
  assert.equal(typeof studentsApi.update, 'function');
  assert.equal(typeof studentsApi.delete, 'function');
  assert.equal(typeof studentsApi.getTransactions, 'function');
});

test('billsApi exports all required billing methods', () => {
  assert.equal(typeof billsApi.list, 'function');
  assert.equal(typeof billsApi.updateStatus, 'function');
  assert.equal(typeof billsApi.create, 'function');
  assert.equal(typeof billsApi.update, 'function');
  assert.equal(typeof billsApi.updateActivation, 'function');
  assert.equal(typeof billsApi.previewActivation, 'function');
  assert.equal(typeof billsApi.bulkUpdateActivation, 'function');
  assert.equal(typeof billsApi.delete, 'function');
  assert.equal(typeof billsApi.getDetail, 'function');
  assert.equal(typeof billsApi.recordPayment, 'function');
  assert.equal(typeof billsApi.getTransactions, 'function');
});

test('masterApi and templateApi export master data methods', () => {
  assert.equal(typeof masterApi.listProdi, 'function');
  assert.equal(typeof masterApi.createProdi, 'function');
  assert.equal(typeof masterApi.updateProdi, 'function');
  assert.equal(typeof masterApi.deleteProdi, 'function');
  assert.equal(typeof masterApi.listPeriods, 'function');
  assert.equal(typeof masterApi.createPeriod, 'function');
  assert.equal(typeof masterApi.updatePeriod, 'function');
  assert.equal(typeof templateApi.downloadMasterDataUrl, 'function');
  assert.equal(templateApi.downloadMasterDataUrl(), '/api/admin/template/master-data');
});

test('reportsApi exports getFinancialSummary', () => {
  assert.equal(typeof reportsApi.getFinancialSummary, 'function');
});

test('importApi exports all required import methods', () => {
  assert.equal(typeof importApi.getGroups, 'function');
  assert.equal(typeof importApi.deleteFile, 'function');
  assert.equal(typeof importApi.preview, 'function');
  assert.equal(typeof importApi.commit, 'function');
});

test('usersApi exports all required user management methods', () => {
  assert.equal(typeof usersApi.list, 'function');
  assert.equal(typeof usersApi.getDetail, 'function');
  assert.equal(typeof usersApi.create, 'function');
  assert.equal(typeof usersApi.update, 'function');
  assert.equal(typeof usersApi.delete, 'function');
  assert.equal(typeof usersApi.resetPassword, 'function');
});

test('auditApi exports its read-only list method', () => {
  assert.equal(typeof auditApi.list, 'function');
});

test('domain service modules are canonical and compatibility barrels stay removed', () => {
  const removedBarrels = [
    path.join(sourceDirectory, 'services/api.js'),
    path.join(sourceDirectory, 'services/index.js'),
  ];
  for (const barrel of removedBarrels) assert.equal(fs.existsSync(barrel), false);

  const sourceFiles = [];
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else if (/\.(jsx?|mjs)$/.test(entry.name)) sourceFiles.push(absolute);
    }
  };
  visit(sourceDirectory);
  const violations = sourceFiles.filter((file) => {
    const source = fs.readFileSync(file, 'utf8');
    return /services\/(?:api|index)(?:\.js)?['"]/.test(source);
  });
  assert.deepEqual(violations, []);
});
