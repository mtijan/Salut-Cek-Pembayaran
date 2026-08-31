import test from 'node:test';
import assert from 'node:assert/strict';

import { isAbortError } from '../../src/services/http.js';

test('isAbortError identifies standard AbortError objects and messages', () => {
  const domAbort = new DOMException('The operation was aborted', 'AbortError');
  const genericAbort = new Error('Request was aborted');
  genericAbort.name = 'AbortError';
  const customCanceled = new Error('request canceled by client');
  const numericCode = new Error('operation canceled');
  numericCode.code = 20;

  assert.equal(isAbortError(domAbort), true);
  assert.equal(isAbortError(genericAbort), true);
  assert.equal(isAbortError(customCanceled), true);
  assert.equal(isAbortError(numericCode), true);
});

test('isAbortError returns false for non-abort application and network errors', () => {
  assert.equal(isAbortError(new Error('Validation failed')), false);
  assert.equal(isAbortError(new TypeError('Failed to fetch')), false);
  assert.equal(isAbortError(new Error('Internal Server Error 500')), false);
  assert.equal(isAbortError(null), false);
  assert.equal(isAbortError(undefined), false);
  assert.equal(isAbortError({}), false);
});

test('request sequencing discards stale responses from aborted in-flight calls', async () => {
  let activeState = null;
  let activeController = null;
  const errorLog = [];

  // Simulated asynchronous API fetch with configurable latency
  const simulateApiCall = (queryText, delayMs, signal) =>
    new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (signal?.aborted) {
          const err = new Error('Request was aborted');
          err.name = 'AbortError';
          reject(err);
        } else {
          resolve({ query: queryText, timestamp: Date.now() });
        }
      }, delayMs);

      signal?.addEventListener('abort', () => {
        clearTimeout(timer);
        const err = new Error('Request was aborted');
        err.name = 'AbortError';
        reject(err);
      });
    });

  // Simulated hook fetch handler
  const executeSearch = async (queryText, delayMs) => {
    if (activeController) {
      activeController.abort();
    }
    const controller = new AbortController();
    activeController = controller;

    try {
      const result = await simulateApiCall(queryText, delayMs, controller.signal);
      if (activeController === controller) {
        activeState = result;
      }
    } catch (err) {
      if (isAbortError(err)) return;
      if (activeController === controller) {
        errorLog.push(err.message);
      }
    }
  };

  // Dispatch Q1 (slow: 60ms), Q2 (medium: 40ms), Q3 (fast: 10ms) in rapid succession
  const p1 = executeSearch('Q1_slow', 60);
  const p2 = executeSearch('Q2_medium', 40);
  const p3 = executeSearch('Q3_fast', 10);

  await Promise.allSettled([p1, p2, p3]);

  // Assert that only Q3_fast updated the state, and no abort errors were logged
  assert.notEqual(activeState, null);
  assert.equal(activeState.query, 'Q3_fast');
  assert.equal(errorLog.length, 0);
});

test('request sequencing cleanly records real errors when latest request fails', async () => {
  let activeState = null;
  let activeController = null;
  const errorLog = [];

  const simulateFailingApi = (shouldFail, delayMs, signal) =>
    new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (signal?.aborted) {
          const err = new Error('Request was aborted');
          err.name = 'AbortError';
          reject(err);
        } else if (shouldFail) {
          reject(new Error('Server error 500'));
        } else {
          resolve({ data: 'ok' });
        }
      }, delayMs);

      signal?.addEventListener('abort', () => {
        clearTimeout(timer);
        const err = new Error('Request was aborted');
        err.name = 'AbortError';
        reject(err);
      });
    });

  const execute = async (shouldFail, delayMs) => {
    if (activeController) activeController.abort();
    const controller = new AbortController();
    activeController = controller;

    try {
      const result = await simulateFailingApi(shouldFail, delayMs, controller.signal);
      if (activeController === controller) {
        activeState = result;
      }
    } catch (err) {
      if (isAbortError(err)) return;
      if (activeController === controller) {
        errorLog.push(err.message);
      }
    }
  };

  const p1 = execute(false, 50); // Initial query gets aborted
  const p2 = execute(true, 10); // Newest query fails with 500

  await Promise.allSettled([p1, p2]);

  assert.equal(activeState, null);
  assert.equal(errorLog.length, 1);
  assert.equal(errorLog[0], 'Server error 500');
});
