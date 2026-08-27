import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const sourceRoot = dirname(fileURLToPath(import.meta.url));
const projectRoot = dirname(sourceRoot);

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    if (entry.name.endsWith('.test.js')) return [];
    return ['.js', '.jsx'].includes(extname(entry.name)) ? [path] : [];
  });
}

test('admin entrypoint does not load third-party font stylesheets', () => {
  const html = readFileSync(join(projectRoot, 'index.html'), 'utf8');
  assert.doesNotMatch(html, /fonts\.googleapis\.com|fonts\.gstatic\.com/);
});

test('admin source has no runtime style element and does not increase inline-style debt', () => {
  const sources = sourceFiles(sourceRoot).map((path) => readFileSync(path, 'utf8'));
  assert.equal(
    sources.some((source) => /<style(?:\s|>)/i.test(source)),
    false,
  );
  const inlineStyleCount = sources.reduce(
    (total, source) => total + (source.match(/\bstyle\s*=/g) || []).length,
    0,
  );
  assert.ok(inlineStyleCount <= 659, `inline style debt increased to ${inlineStyleCount}`);
});
