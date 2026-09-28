import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    setupFiles: ['tests/helpers/env.ts'],
    globalSetup: ['tests/setup/server.ts'],
    // Contract smoke + IDOR suites share one local Supabase; run files serially
    // so they cannot trample each other's fixtures.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./', import.meta.url)),
      // `server-only` throws on import unless the bundler has replaced it, which
      // is what stops a server module reaching a client bundle. Vitest is plain
      // Node and these modules genuinely are server-side, so the guard is
      // mapped to a no-op rather than removed from the source.
      'server-only': fileURLToPath(new URL('./tests/stubs/server-only.ts', import.meta.url)),
    },
  },
});
