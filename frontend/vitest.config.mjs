import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Vitest has no client/server bundle split - Next.js's own webpack
      // config aliases `server-only` to a no-op on the server bundle and
      // to a throwing stub on the client bundle; mirror the server-side
      // behavior here so importing lib/auth.js / lib/api.js in tests
      // doesn't unconditionally throw.
      'server-only': path.resolve(__dirname, 'test-utils/server-only-noop.js'),
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.js'],
    globals: true,
    css: false,
    pool: 'threads',
    exclude: [
      'e2e/**',
      'node_modules/**',
      '.next/**',
      'test-results/**',
    ],
    coverage: {
      reporter: ['text', 'lcov'],
    },
  },
});
