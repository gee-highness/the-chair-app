import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

// Mirrors tsconfig.json's "@/*" -> "./src/*" path alias so route/lib
// imports resolve the same way under the test runner as under Next.js.
//
// Two test populations live side by side here:
// - API route tests (__tests__/*.test.ts) run in a plain `node`
//   environment against fakeMongo — no DOM needed, and running them under
//   jsdom would just be slower for no benefit.
// - Component/hook/page tests (__tests__/components/**, __tests__/pages/**,
//   __tests__/hooks/**) need a DOM, so those run under jsdom via
//   environmentMatchGlobs rather than flipping the global default (which
//   would slow down every route test for no reason).
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    environmentMatchGlobs: [
      ['__tests__/components/**', 'jsdom'],
      ['__tests__/pages/**', 'jsdom'],
      ['__tests__/hooks/**', 'jsdom'],
    ],
    setupFiles: ['./__tests__/setup/vitest.setup.ts'],
    globals: true,
    exclude: ['**/node_modules/**', 'e2e/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
