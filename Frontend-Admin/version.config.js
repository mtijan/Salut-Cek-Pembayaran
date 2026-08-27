import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const VERSION_FILE = fileURLToPath(new URL('../VERSION', import.meta.url));
const SEMANTIC_VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:[-+][0-9A-Za-z.-]+)?$/;

export function readApplicationVersion(versionFile = VERSION_FILE) {
  const version = readFileSync(versionFile, 'utf8').trim();
  if (!SEMANTIC_VERSION_PATTERN.test(version)) {
    throw new Error(`Application version must use semantic versioning: ${versionFile}`);
  }
  return version;
}
