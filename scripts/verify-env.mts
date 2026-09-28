/**
 * Environment validator.
 *
 * Run in CI and available as `pnpm verify:env` so a misconfigured deployment is
 * caught *before* it is promoted, rather than by the first visitor to hit a 500.
 * The Vercel equivalent is to add `pnpm verify:env` to the project's Build
 * Command, or run it as a separate CI step against production env.
 *
 * Reports every missing or malformed variable at once. Fixing them one deploy at
 * a time is how an app ends up 500ing on the second variable after the first was
 * finally set.
 *
 * Exit codes: 0 all good, 1 problems found, 2 --strict and DEMO_MODE is on.
 */
import { parsePublicEnv, describePublicEnvIssues, isDemoMode } from '@/lib/config/env';

const strict = process.argv.includes('--strict');

const parsed = parsePublicEnv();

if (!parsed.success) {
  console.error('Buildora environment is not configured:\n');
  for (const issue of describePublicEnvIssues(parsed.error)) {
    console.error(`  - ${issue}`);
  }
  console.error('\nSee .env.example for the full list.');
  process.exit(1);
}

console.log('Buildora environment OK:');
console.log('  NEXT_PUBLIC_SUPABASE_URL           set');
console.log('  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY  set');
console.log(`  NEXT_PUBLIC_SITE_URL               ${parsed.data.NEXT_PUBLIC_SITE_URL ?? '(unset, defaults to localhost)'}`);
console.log(`  DEMO_MODE                          ${isDemoMode() ? 'true' : 'false'}`);

if (strict && isDemoMode()) {
  console.error('\nDEMO_MODE must not be enabled on a production deployment.');
  process.exit(2);
}
