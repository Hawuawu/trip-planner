// Shared SAST base for Node (non-browser) TypeScript sub-projects in this
// repo (functions/, mcp/, and any future one) — same security-focused
// rules as the root app's .eslintrc.cjs, minus the browser/React-specific
// plugins it needs and doesn't. Each sub-project's own .eslintrc.cjs
// should be a thin file that requires this, not a copy — one ruleset,
// referenced everywhere, so there's nothing to keep back in sync by hand.
module.exports = {
  root: true,
  env: { node: true, es2022: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:security/recommended-legacy',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
  plugins: ['no-secrets'],
  ignorePatterns: ['dist', 'lib', 'node_modules'],
  rules: {
    '@typescript-eslint/no-unused-vars': [
      'error',
      { varsIgnorePattern: '^_', argsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_' },
    ],
    // Same tolerance as the root config — see its comment for why.
    'no-secrets/no-secrets': ['error', { tolerance: 4.2 }],
    // Same rationale as the root config: extremely high false-positive
    // rate on ordinary TypeScript (flags plain array indexing).
    'security/detect-object-injection': 'off',
  },
};
