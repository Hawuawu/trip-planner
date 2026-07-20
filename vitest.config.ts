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
      thresholds: {
        lines: 85,
        functions: 80,
        branches: 80,
        statements: 85,
      },
    },
  },
});
