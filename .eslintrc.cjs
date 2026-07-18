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
  ignorePatterns: ['dist', '.eslintrc.cjs'],
  parser: '@typescript-eslint/parser',
  plugins: ['react-refresh', 'no-secrets'],
  rules: {
    'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    '@typescript-eslint/no-unused-vars': ['error', { varsIgnorePattern: '^_', argsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_' }],
    'no-secrets/no-secrets': 'error',
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
