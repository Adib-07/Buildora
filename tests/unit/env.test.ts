import { describe, expect, it } from 'vitest';

import {
  ConfigurationError,
  type EnvSource,
  describePublicEnvIssues,
  isSupabaseConfigured,
  parsePublicEnv,
  requireSupabasePublicEnv,
  siteUrl,
} from '@/lib/config/env';

/**
 * These are the exact conditions that produced "Buildora could not start" in
 * production: a Vercel project with no NEXT_PUBLIC_SUPABASE_* variables set, and
 * a NEXT_PUBLIC_SITE_URL that is not an absolute URL. Both used to throw from
 * module scope, taking down every route.
 */

const valid = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://abc.supabase.co',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_x',
  NEXT_PUBLIC_SITE_URL: 'https://buildora.example',
} as EnvSource;

describe('parsePublicEnv', () => {
  it('accepts a complete configuration', () => {
    expect(parsePublicEnv(valid).success).toBe(true);
  });

  it('treats an unset variable as empty, not as valid', () => {
    const parsed = parsePublicEnv({});
    expect(parsed.success).toBe(false);
  });

  it('treats a variable set to an empty string as missing', () => {
    // This is what Vercel serves for a variable that exists but has no value,
    // and the single most likely cause of the production outage.
    const parsed = parsePublicEnv({
      ...valid,
      NEXT_PUBLIC_SUPABASE_URL: '',
    });
    expect(parsed.success).toBe(false);
    expect(describePublicEnvIssues(parsed.error!).join()).toContain(
      'NEXT_PUBLIC_SUPABASE_URL',
    );
  });

  it('rejects a URL with no scheme', () => {
    const parsed = parsePublicEnv({ ...valid, NEXT_PUBLIC_SUPABASE_URL: 'abc.supabase.co' });
    expect(parsed.success).toBe(false);
  });

  it('rejects a non-http protocol', () => {
    const parsed = parsePublicEnv({
      ...valid,
      NEXT_PUBLIC_SUPABASE_URL: 'javascript:alert(1)',
    });
    expect(parsed.success).toBe(false);
  });

  it('reports every problem at once, not just the first', () => {
    const parsed = parsePublicEnv({ NEXT_PUBLIC_SUPABASE_URL: 'not-a-url' });
    expect(parsed.success).toBe(false);
    const issues = describePublicEnvIssues(parsed.error!).join('\n');
    expect(issues).toContain('NEXT_PUBLIC_SUPABASE_URL');
    expect(issues).toContain('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
  });
});

describe('isSupabaseConfigured', () => {
  it('is false for an empty environment', () => {
    expect(isSupabaseConfigured({})).toBe(false);
  });

  it('is true once both required variables are present', () => {
    expect(isSupabaseConfigured(valid)).toBe(true);
  });
});

describe('requireSupabasePublicEnv', () => {
  it('returns the validated values when configured', () => {
    expect(requireSupabasePublicEnv(valid)).toEqual({
      url: valid.NEXT_PUBLIC_SUPABASE_URL,
      key: valid.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    });
  });

  it('throws a ConfigurationError naming the gap, not a raw TypeError', () => {
    // The distinction matters: callers branch on ConfigurationError to answer
    // 503 DEPENDENCY_DOWN and to fail closed rather than propagate.
    expect(() => requireSupabasePublicEnv({})).toThrow(ConfigurationError);
    try {
      requireSupabasePublicEnv({});
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigurationError);
      expect((error as ConfigurationError).message).toContain(
        'NEXT_PUBLIC_SUPABASE_URL',
      );
      expect((error as ConfigurationError).issues.length).toBeGreaterThan(0);
    }
  });
});

describe('siteUrl', () => {
  it('returns an absolute URL unchanged', () => {
    expect(siteUrl(valid).toString()).toBe('https://buildora.example/');
  });

  it('assumes https for a bare host instead of throwing', () => {
    // Reproduces the reported build failure: setting
    // NEXT_PUBLIC_SITE_URL=quorvexhackathon.vercel.app made `new URL()` throw
    // from app/layout.tsx while the root layout module loaded.
    expect(siteUrl({ NEXT_PUBLIC_SITE_URL: 'quorvexhackathon.vercel.app' }).toString()).toBe(
      'https://quorvexhackathon.vercel.app/',
    );
  });

  it('falls back to localhost rather than throwing on garbage', () => {
    expect(siteUrl({ NEXT_PUBLIC_SITE_URL: 'http://' }).toString()).toBe(
      'http://localhost:3000/',
    );
  });

  it('falls back when unset', () => {
    expect(siteUrl({}).toString()).toBe('http://localhost:3000/');
  });

  it('never throws, whatever it is given', () => {
    for (const value of ['', '   ', 'https://', 'not a url', '::::', '//']) {
      expect(() => siteUrl({ NEXT_PUBLIC_SITE_URL: value })).not.toThrow();
    }
  });
});
