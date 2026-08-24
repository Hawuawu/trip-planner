import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..');

// Shown for `vite dev`/tests instead of computing the real version — keeps
// a running dev server visibly distinct from a deployed build at a glance,
// and avoids shelling out to git on every dev-server boot/test run.
export const DEV_PLACEHOLDER_VERSION = { version: '0.0.0-dev', commit: 'local' };

// Only `vite build` (command === 'build') pays for this — see vite.config.ts.
export function getAppVersion() {
  const { version } = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf-8'));
  let commit = 'unknown';
  try {
    commit = execSync('git rev-parse --short HEAD', { cwd: rootDir }).toString().trim();
  } catch {
    // No git metadata available (e.g. a source tarball) — keep the fallback.
  }
  return { version, commit };
}
