#!/usr/bin/env node
// Claude PreToolUse SAST gate — lints the post-edit content of a Write/Edit
// call before it's applied, denying the tool call if a security ESLint rule
// (or any other project lint rule) fails.
//
// Write's tool_input.content is already the full file, but Edit's new_string
// is often a bare fragment that isn't valid syntax on its own — so for Edit
// we reconstruct the whole post-edit file by replacing old_string with
// new_string in the current on-disk content, then lint that reconstruction.
//
// Linted via `eslint --stdin --stdin-filename <relative path>` rather than
// writing to a temp file: ESLint resolves filename-scoped overrides (e.g.
// the `**/*.test.ts` and `vite.config.ts` blocks in .eslintrc.cjs) against
// the filename it's given, so a synthesized temp name would silently skip
// those overrides and produce false-positive denials.

import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { relative } from 'node:path';

const PROJECT_ROOT = '/Users/maya/Repositories/trip-planner';

// functions/ and mcp/ are independent Node sub-projects (own package.json,
// own ESLint config extending eslint.node-subproject.cjs — see CLAUDE.md's
// "Repo structure") and are listed in the root .eslintrc.cjs's
// ignorePatterns. Linting one of their files against the root config always
// reports "file ignored", which --max-warnings 0 turns into a false-positive
// denial — so route each sub-project's files to its own config/cwd instead.
const SUBPROJECTS = ['functions', 'mcp'];

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

const repoRelativePath = relative(PROJECT_ROOT, filePath);
const subproject = SUBPROJECTS.find(
  (name) => repoRelativePath === name || repoRelativePath.startsWith(`${name}/`),
);
const lintRoot = subproject ? `${PROJECT_ROOT}/${subproject}` : PROJECT_ROOT;
const stdinFilename = relative(lintRoot, filePath);

let result = '';
let failed = false;
try {
  execFileSync(
    'npx',
    [
      'eslint',
      '--config', `${lintRoot}/.eslintrc.cjs`,
      '--resolve-plugins-relative-to', lintRoot,
      '--max-warnings', '0',
      '--stdin',
      '--stdin-filename', stdinFilename,
    ],
    { cwd: lintRoot, encoding: 'utf8', input: newContent },
  );
} catch (err) {
  failed = true;
  result = `${err.stdout ?? ''}${err.stderr ?? ''}`;
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
