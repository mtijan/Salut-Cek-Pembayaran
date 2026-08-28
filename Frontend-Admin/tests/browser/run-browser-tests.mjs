import { spawn } from 'node:child_process';
import { access, mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(scriptDirectory, '..', '..');
const projectRoot = path.resolve(frontendRoot, '..');
const port = process.env.BROWSER_TEST_PORT || '8765';
const healthUrl = `http://127.0.0.1:${port}/api/health`;
const pythonExecutable = process.env.BROWSER_TEST_PYTHON || 'python';
const playwrightCli = path.join(frontendRoot, 'node_modules', '@playwright', 'test', 'cli.js');

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function stopProcess(child) {
  if (!child || child.exitCode !== null) return;

  child.kill('SIGTERM');
  const stopped = await Promise.race([
    new Promise((resolve) => child.once('exit', () => resolve(true))),
    delay(5_000).then(() => false),
  ]);
  if (!stopped && child.exitCode === null) child.kill('SIGKILL');
}

async function waitForServer(child) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (child.exitCode !== null) {
      throw new Error(
        `Synthetic browser server exited before health check (exit ${child.exitCode}).`,
      );
    }
    try {
      const response = await fetch(healthUrl, { signal: AbortSignal.timeout(1_000) });
      if (response.ok) return;
    } catch {
      // The server may still be starting; retry until the bounded deadline.
    }
    await delay(250);
  }
  throw new Error('Synthetic browser server was not healthy within 15 seconds.');
}

async function runPlaywright(environment) {
  return new Promise((resolve, reject) => {
    const testProcess = spawn(process.execPath, [playwrightCli, 'test'], {
      cwd: frontendRoot,
      env: environment,
      stdio: 'inherit',
      windowsHide: true,
    });
    testProcess.once('error', reject);
    testProcess.once('exit', (code, signal) => {
      if (signal) reject(new Error(`Playwright terminated by signal ${signal}.`));
      else resolve(code ?? 1);
    });
  });
}

const runtimeRoot = await mkdtemp(path.join(tmpdir(), 'salut-browser-'));
const importDirectory = path.join(runtimeRoot, 'imports');
await mkdir(importDirectory, { recursive: true });

const environment = {
  ...process.env,
  APP_ENV: 'development',
  DATABASE_URL: path.join(runtimeRoot, 'synthetic-browser.sqlite'),
  IMPORT_DIR: importDirectory,
  WEB_CONCURRENCY: '1',
  ADMIN_BOOTSTRAP_EMAIL: 'browser-admin@synthetic.test',
  ADMIN_BOOTSTRAP_PASSWORD: 'Synthetic-Browser-Only-2026!',
  LOOKUP_HASH_SECRET: 'synthetic-browser-secret-not-for-production',
  PORT: port,
};

if (process.platform === 'win32' && !environment.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
  const windowsChrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  try {
    await access(windowsChrome);
    environment.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH = windowsChrome;
  } catch {
    // Fall back to Playwright-managed Chromium when system Chrome is unavailable.
  }
}

let serverProcess;
let exitCode;
try {
  serverProcess = spawn(
    pythonExecutable,
    ['-m', 'uvicorn', 'Backend.app.main:app', '--host', '127.0.0.1', '--port', port],
    {
      cwd: projectRoot,
      env: environment,
      stdio: ['ignore', 'inherit', 'inherit'],
      windowsHide: true,
    },
  );
  await waitForServer(serverProcess);
  exitCode = await runPlaywright(environment);
} finally {
  await stopProcess(serverProcess);
  await rm(runtimeRoot, { recursive: true, force: true });
}

process.exitCode = exitCode;
