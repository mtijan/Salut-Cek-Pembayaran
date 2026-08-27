import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { readApplicationVersion, VERSION_FILE } from '../version.config.js';

test('frontend build reads the canonical repository version', () => {
  const version = readApplicationVersion();
  const packageMetadata = JSON.parse(
    readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
  );
  assert.match(version, /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/);
  assert.equal(version, readApplicationVersion(VERSION_FILE));
  assert.equal(packageMetadata.version, version);
});

test('frontend version reader rejects invalid versions', () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'salut-version-'));
  const invalidVersion = join(tempDir, 'VERSION');
  try {
    writeFileSync(invalidVersion, 'release-latest\n', 'utf8');
    assert.throws(() => readApplicationVersion(invalidVersion), /semantic versioning/);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});
