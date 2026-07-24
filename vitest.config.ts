import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['src/test/setup.ts'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.claude/worktrees/**',
      '**/*.firebase.test.ts',
      'functions/**',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'json-summary', 'cobertura'],
      // Without `all`, v8 only instruments files a test actually imports —
      // a source file with zero tests importing it is invisible to the
      // report entirely rather than counting as 0%, so the threshold gate
      // can't catch "this file has no tests." `include` is required for
      // `all` to know which files to scan in the first place.
      all: true,
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.{test,spec}.{ts,tsx}',
        'src/test/**',
        'src/main.tsx',
        'src/vite-env.d.ts',
        // Pure delegation, no branching logic worth unit-testing.
        'src/App.tsx',
        // Thin Firebase SDK wrappers — meaningfully testing these needs the
        // Firestore/Auth emulator (see vitest.firebase.config.ts and the
        // e2e-firebase CI job), not jsdom mocking. Tracked in issue #12.
        'src/data/firebaseAuthService.ts',
        'src/data/firebaseTripRepository.ts',
      ],
      thresholds: {
        lines: 85,
        functions: 80,
        branches: 80,
        statements: 85,
      },
    },
  },
});
