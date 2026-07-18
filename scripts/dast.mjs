/**
 * DAST security scan — runs against the production preview build.
 * Checks: security headers, XSS escaping, unauthenticated access gate.
 *
 * Usage: npm run build && npm run security:dast
 */

import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { chromium } from 'playwright';

const PORT = 5174;
const BASE = `http://localhost:${PORT}`;
const ERRORS = [];

function fail(msg) {
  ERRORS.push(msg);
  console.error(`  ✗ ${msg}`);
}

function pass(msg) {
  console.log(`  ✓ ${msg}`);
}

// ── Start vite preview ───────────────────────────────────────────────────────

const preview = spawn('npx', ['vite', 'preview', '--port', String(PORT)], {
  stdio: 'ignore',
  shell: true,
});

// Give the server a moment to start
await sleep(3000);

// ── Run checks ───────────────────────────────────────────────────────────────

const browser = await chromium.launch();
const page = await browser.newPage();

try {
  // 1. Header check
  const response = await page.goto(BASE);
  const headers = response.headers();

  const required = ['x-frame-options', 'x-content-type-options', 'content-security-policy'];
  for (const h of required) {
    if (headers[h]) {
      pass(`Header present: ${h}`);
    } else {
      fail(`Missing security header: ${h} (add it to nginx.conf or vite server.headers)`);
    }
  }

  // 2. Auth gate — app should show sign-in page before trip data
  const html = await page.content();
  if (html.includes('Sign in') || html.includes('sign-in') || html.includes('signin')) {
    pass('Auth gate: sign-in page rendered for unauthenticated users');
  } else if (html.includes('Trip Planner') && !html.includes('JFK')) {
    pass('Auth gate: trip data not exposed without auth');
  } else {
    fail('Auth gate: app may be rendering trip data without authentication');
  }

  // 3. XSS check — inject payload into URL hash; page should not execute it
  await page.goto(`${BASE}/#<img src=x onerror="window.__xss=1">`);
  const xss = await page.evaluate(() => window.__xss);
  if (xss) {
    fail('XSS: window.__xss was set — hash-based XSS vector exists');
  } else {
    pass('XSS: payload in hash was not executed');
  }
} finally {
  await browser.close();
  preview.kill();
}

// ── Result ───────────────────────────────────────────────────────────────────

if (ERRORS.length > 0) {
  console.error(`\nDASTscan failed with ${ERRORS.length} issue(s):`);
  ERRORS.forEach((e) => console.error(`  • ${e}`));
  process.exit(1);
} else {
  console.log('\nDASTscan passed.');
}
