import fs from 'node:fs';
import path from 'node:path';
import type { Persistence } from 'firebase/auth';
import { credentialsFile } from '../config.js';

// The Firebase JS SDK's built-in persistence backends (browserLocalPersistence,
// indexedDBLocalPersistence) assume a browser. Node has neither, so a plain
// getAuth() call here would silently fall back to in-memory persistence —
// nothing survives past one `npx` invocation, which defeats the whole
// "log in once" point of this server. This implements the SDK's internal
// Persistence contract backed by a single JSON file on disk instead.
//
// The file holds the SDK's own internal auth-state blob (includes the
// refresh token), so the SDK's normal token-refresh logic keeps working
// unmodified once this state is restored on a later run.
function readAll(): Record<string, string> {
  try {
    return JSON.parse(fs.readFileSync(credentialsFile, 'utf8'));
  } catch {
    return {};
  }
}

function writeAll(data: Record<string, string>): void {
  fs.mkdirSync(path.dirname(credentialsFile), { recursive: true });
  fs.writeFileSync(credentialsFile, JSON.stringify(data, null, 2), { mode: 0o600 });
}

// initializeAuth's `persistence` option is typed publicly as `Persistence`
// (just a `{ type }` shape), but the SDK's internal _getInstance() actually
// requires a *class* — it asserts `cls instanceof Function` and does
// `new cls()` itself to obtain a singleton (confirmed by reading
// @firebase/auth's dist: InMemoryPersistence, IndexedDBLocalPersistence,
// etc. are all exported as bare classes, cast to `Persistence` at the
// public API boundary). A plain object literal fails that assertion with
// "INTERNAL ASSERTION FAILED: Expected a class definition" — so this must
// be an actual class, passed as the class itself (not `new FileAuthPersistence()`).
class FileAuthPersistence {
  type = 'LOCAL' as const;

  async _isAvailable(): Promise<boolean> {
    return true;
  }

  async _set(key: string, value: unknown): Promise<void> {
    const all = readAll();
    all[key] = JSON.stringify(value);
    writeAll(all);
  }

  async _get<T>(key: string): Promise<T | null> {
    const all = readAll();
    const raw = all[key];
    return raw ? (JSON.parse(raw) as T) : null;
  }

  async _remove(key: string): Promise<void> {
    const all = readAll();
    delete all[key];
    writeAll(all);
  }

  // No cross-tab/process listening needed — this server is a single
  // short-lived process per invocation, not a long-running app with
  // multiple concurrent auth listeners to keep in sync.
  _addListener(): void {}
  _removeListener(): void {}
}

export const fileAuthPersistence = FileAuthPersistence as unknown as Persistence;

export function hasCachedSession(): boolean {
  return fs.existsSync(credentialsFile);
}
