import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..');

// Shared by vite.config.ts (real builds) and vitest.config.ts (tests need
// the same __APP_VERSION__/__APP_COMMIT__ globals defined or the app
// throws a ReferenceError under jsdom) so the two configs can't drift.
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
