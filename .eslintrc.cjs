module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
    'plugin:security/recommended-legacy',
    'plugin:no-unsanitized/recommended-legacy',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs', 'functions', 'mcp'],
  parser: '@typescript-eslint/parser',
  plugins: ['react-refresh', 'no-secrets'],
  rules: {
    'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    '@typescript-eslint/no-unused-vars': ['error', { varsIgnorePattern: '^_', argsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_' }],
    // tolerance 4.2 avoids false positives on short random strings (ids,
    // hashes in test fixtures) while still catching real keys/tokens.
    'no-secrets/no-secrets': ['error', { tolerance: 4.2 }],
    // Flags any obj[x] where x isn't a literal, including plain array
    // indexing (arr[i]) — extremely high false-positive rate on ordinary
    // TypeScript and not useful signal here.
    'security/detect-object-injection': 'off',
  },
  overrides: [
    {
      files: ['**/*.test.ts', '**/*.test.tsx'],
      rules: {
        // Test fixtures resolve paths via path.resolve/__dirname, not user input.
        'security/detect-non-literal-fs-filename': 'off',
      },
    },
  ],
};
