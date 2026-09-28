import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

/**
 * Unit and static-analysis suites.
 *
 * Deliberately separate from `vitest.config.mts`: that config declares a
 * `globalSetup` which spawns a `next dev` server and waits for it, because the
 * API/RLS suites need a live Next request context and a real database. None of
 * that is needed to test `siteUrl`, the env schema or the secret scanner, and
 * coupling them means a unit test fails whenever the dev server or Supabase is
 * unavailable -- which is why the whole suite used to be red on a clean clone.
 *
 * This config therefore has no `globalSetup` and runs in well under a second,
 * so it can gate every push.
 */
export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts', 'tests/security/**/*.test.ts'],
    environment: 'node',
    setupFiles: ['tests/helpers/env.ts'],
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./', import.meta.url)),
      'server-only': fileURLToPath(new URL('./tests/stubs/server-only.ts', import.meta.url)),
    },
  },
});
