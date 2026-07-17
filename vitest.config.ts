import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      // Thresholds are enforced once the test suite reaches meaningful breadth.
      // Re-enable when component and store tests are in place:
      //   lines: 80, functions: 80, branches: 80
    },
  },
});
