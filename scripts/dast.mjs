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

  // 1b. CSP content check — a header can be *present* and still be wrong.
  // #117: script-src lacked apis.google.com and there was no frame-src at
  // all, silently blocking Google sign-in's popup flow while this same
  // check only asserted presence. Keep firebase.json/vite.config.ts/
  // nginx.conf mirrored — see CLAUDE.md.
  const csp = headers['content-security-policy'] || '';
  if (/script-src[^;]*\bapis\.google\.com\b/.test(csp)) {
    pass('CSP script-src allows apis.google.com (Google sign-in popup)');
  } else {
    fail('CSP script-src missing apis.google.com — Google sign-in popup will be blocked (#117)');
  }
  if (/(^|;)\s*frame-src\s+\S/.test(csp)) {
    pass('CSP frame-src directive present (Firebase Auth relay iframe)');
  } else {
    fail('CSP has no frame-src directive — Firebase Auth relay iframe will be blocked (#117)');
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
