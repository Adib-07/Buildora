import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Guards against the two ways a secret reaches the browser bundle:
 * a NEXT_PUBLIC_ prefix on a server-only name, or a literal credential
 * committed into source.
 */

/** Server-only names that must never carry a NEXT_PUBLIC_ prefix. */
const SERVER_ONLY = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'WEBHOOK_HMAC_SECRET',
  'JOB_SECRET',
  'GATEWAY_PASSWORD',
  'GATEWAY_USER',
];

/**
 * Names lib/config/env.ts must actually handle today. The webhook and job
 * secrets belong to routes that do not exist yet; the prefix rule above still
 * applies to them, but env.ts has no reason to know them yet.
 */
const IMPLEMENTED_SECRETS = ['SUPABASE_SERVICE_ROLE_KEY'];

const SCAN_DIRS = ['app', 'lib', 'tests', 'contracts'];
const SKIP = new Set(['node_modules', '.git', '.next', 'supabase']);

function sourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) sourceFiles(full, acc);
    else if (/\.(ts|tsx|js|jsx|mjs)$/.test(entry)) acc.push(full);
  }
  return acc;
}

const files = SCAN_DIRS.filter((d) => {
  try {
    return statSync(d).isDirectory();
  } catch {
    return false;
  }
}).flatMap((d) => sourceFiles(d));

describe('secret handling', () => {
  it('finds source files to scan', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it('never exposes a server-only name via NEXT_PUBLIC_', () => {
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      for (const name of SERVER_ONLY) {
        expect(
          text.includes(`NEXT_PUBLIC_${name}`),
          `${relative('.', file)} re-exports ${name} to the browser`,
        ).toBe(false);
      }
    }
  });

  it('commits no Supabase credential literals', () => {
    // Local dev keys are printed by `supabase start` and are git-ignored, but
    // nothing should carry one in source regardless.
    const patterns = [/sb_secret_[A-Za-z0-9_-]{16,}/, /sb_publishable_[A-Za-z0-9_-]{16,}/];
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      for (const pattern of patterns) {
        expect(pattern.test(text), `${relative('.', file)} contains a Supabase key`).toBe(
          false,
        );
      }
    }
  });

  it('reads server secrets from process.env in exactly one module', () => {
    // Centralised so there is a single place to audit, and so no route can
    // invent its own environment handling. Naming a variable inside a
    // human-readable error message is fine; reading it directly is not.
    for (const file of files) {
      if (file.endsWith(join('lib', 'config', 'env.ts'))) continue;
      const text = readFileSync(file, 'utf8');
      for (const name of SERVER_ONLY) {
        expect(
          text.includes(`process.env.${name}`),
          `${relative('.', file)} reads ${name} directly instead of via lib/config/env`,
        ).toBe(false);
      }
    }
  });

  it('exposes the server-only names through lib/config/env', () => {
    const env = readFileSync(join('lib', 'config', 'env.ts'), 'utf8');
    for (const name of IMPLEMENTED_SECRETS) {
      expect(env, `lib/config/env.ts does not handle ${name}`).toContain(name);
    }
  });
});
