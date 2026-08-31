import test from 'node:test';
import assert from 'node:assert/strict';

import { BASE_URL, apiFetch } from '../../src/services/http.js';
import { authApi } from '../../src/services/authApi.js';
import { dashboardApi } from '../../src/services/dashboardApi.js';
import { studentsApi } from '../../src/services/studentsApi.js';
import { billsApi } from '../../src/services/billsApi.js';
import { masterApi, templateApi } from '../../src/services/masterApi.js';
import { reportsApi } from '../../src/services/reportsApi.js';
import { importApi } from '../../src/services/importApi.js';
import { usersApi } from '../../src/services/usersApi.js';
import * as barrelApi from '../../src/services/api.js';
import * as indexApi from '../../src/services/index.js';

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

test('compatibility barrels export all modular services identical to source modules', () => {
  assert.equal(barrelApi.authApi, authApi);
  assert.equal(barrelApi.dashboardApi, dashboardApi);
  assert.equal(barrelApi.studentsApi, studentsApi);
  assert.equal(barrelApi.billsApi, billsApi);
  assert.equal(barrelApi.masterApi, masterApi);
  assert.equal(barrelApi.templateApi, templateApi);
  assert.equal(barrelApi.reportsApi, reportsApi);
  assert.equal(barrelApi.importApi, importApi);
  assert.equal(barrelApi.usersApi, usersApi);
  assert.equal(barrelApi.apiFetch, apiFetch);

  assert.equal(indexApi.authApi, authApi);
  assert.equal(indexApi.dashboardApi, dashboardApi);
  assert.equal(indexApi.studentsApi, studentsApi);
  assert.equal(indexApi.billsApi, billsApi);
  assert.equal(indexApi.masterApi, masterApi);
  assert.equal(indexApi.templateApi, templateApi);
  assert.equal(indexApi.reportsApi, reportsApi);
  assert.equal(indexApi.importApi, importApi);
  assert.equal(indexApi.usersApi, usersApi);
  assert.equal(indexApi.apiFetch, apiFetch);
});
