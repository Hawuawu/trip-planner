#!/usr/bin/env node
// Claude PreToolUse SAST gate — lints the post-edit content of a Write/Edit
// call before it's applied, denying the tool call if a security ESLint rule
// (or any other project lint rule) fails.
//
// Write's tool_input.content is already the full file, but Edit's new_string
// is often a bare fragment that isn't valid syntax on its own — so for Edit
// we reconstruct the whole post-edit file by replacing old_string with
// new_string in the current on-disk content, then lint that reconstruction.

import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const PROJECT_ROOT = '/Users/maya/Repositories/trip-planner';

let input = '';
process.stdin.setEncoding('utf8');
for await (const chunk of process.stdin) input += chunk;

let payload;
try {
  payload = JSON.parse(input);
} catch {
  process.exit(0);
}

const filePath = payload?.tool_input?.file_path ?? '';
if (!/\.(ts|tsx|js|jsx)$/.test(filePath)) process.exit(0);

const toolName = payload?.tool_name ?? '';
let newContent;

if (toolName === 'Write') {
  newContent = payload?.tool_input?.content ?? '';
} else {
  const oldString = payload?.tool_input?.old_string ?? '';
  const newString = payload?.tool_input?.new_string ?? '';
  let current = '';
  try {
    current = existsSync(filePath) ? readFileSync(filePath, 'utf8') : '';
  } catch {
    process.exit(0);
  }
  // Can't reliably simulate the edit (e.g. old_string not found) — skip
  // rather than lint something that doesn't reflect the real result.
  if (!current || !current.includes(oldString)) process.exit(0);
  newContent = current.replace(oldString, newString);
}

const ext = filePath.split('.').pop();
// No leading dot — ESLint ignores dotfiles by default.
// Preserve a `.test.<ext>` suffix so the `**/*.test.ts(x)` overrides in
// .eslintrc.cjs (e.g. the non-literal-fs-filename exemption for test
// fixtures) still match — otherwise every test file would be linted as if
// it were production code.
const isTestFile = /\.test\.(ts|tsx)$/.test(filePath);
const tmpFile = isTestFile
  ? `${PROJECT_ROOT}/sast-gate-tmp-${process.pid}.test.${ext}`
  : `${PROJECT_ROOT}/sast-gate-tmp-${process.pid}.${ext}`;
writeFileSync(tmpFile, newContent, 'utf8');

let result = '';
let failed = false;
try {
  execFileSync(
    'npx',
    [
      'eslint',
      '--config', `${PROJECT_ROOT}/.eslintrc.cjs`,
      '--resolve-plugins-relative-to', PROJECT_ROOT,
      '--max-warnings', '0',
      tmpFile,
    ],
    { cwd: PROJECT_ROOT, encoding: 'utf8' },
  );
} catch (err) {
  failed = true;
  result = `${err.stdout ?? ''}${err.stderr ?? ''}`;
} finally {
  try {
    unlinkSync(tmpFile);
  } catch {
    // already gone, nothing to clean up
  }
}

if (failed) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: `SAST failed:\n${result}`,
      },
    }),
  );
}
