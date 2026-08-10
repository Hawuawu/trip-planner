module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
    'plugin:jsx-a11y/recommended',
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
    // Every autoFocus in this app targets the first field of a
    // dialog/panel/popover the user just opened via their own action (tap
    // Edit/Add, open a link picker) — the WAI-ARIA-recommended pattern, not
    // the "steals focus on page load" case this rule guards against.
    'jsx-a11y/no-autofocus': 'off',
  },
  overrides: [
    {
      files: ['**/*.test.ts', '**/*.test.tsx'],
      rules: {
        // Test fixtures resolve paths via path.resolve/__dirname, not user input.
        'security/detect-non-literal-fs-filename': 'off',
        // react-map-gl mocks stand in for Marker/the map root with a plain
        // div + onClick to simulate the real component's onClick prop in
        // tests — mock scaffolding, not user-facing markup.
        'jsx-a11y/click-events-have-key-events': 'off',
        'jsx-a11y/no-static-element-interactions': 'off',
      },
    },
    {
      files: ['vite.config.ts'],
      rules: {
        // serveKuromojiDictRaw() reads req.url, but only after it's matched
        // against an anchored `^/dict/[\w.-]+\.dat\.gz$` regex (no `/`, `..`,
        // or other path-traversal characters allowed), so the derived path
        // can't escape the public/dist dict directory.
        'security/detect-non-literal-fs-filename': 'off',
      },
    },
  ],
};
