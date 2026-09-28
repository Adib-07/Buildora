import { z } from 'zod';

/**
 * Environment access and validation.
 *
 * Two hard rules this module exists to enforce:
 *
 * 1. Server-only secrets are read here and nowhere else, and never through a
 *    NEXT_PUBLIC_ prefix, so Next cannot inline them into the client bundle.
 * 2. A missing variable is a *reported* condition, not a crash. Reading config
 *    must never be the thing that takes the deployment down -- see
 *    `isSupabaseConfigured` and `requireSupabasePublicEnv`, which let a public
 *    page degrade to a signed-out state instead of returning a 500.
 *
 * Validation is schema-first: `publicEnvSchema` is the single description of
 * what the browser-facing environment must contain, so a misconfigured Vercel
 * project produces one clear message naming the exact variable instead of an
 * `undefined` surfacing three layers deep as a TypeError.
 */

/**
 * A configuration fault, kept distinct from a bug so callers can decide.
 *
 * `lib/security/api.ts` maps this to 503 DEPENDENCY_DOWN -- the deployment is
 * unhealthy, not the caller's request -- and `lib/auth/dal.ts` treats it as
 * "signed out" rather than propagating it into a rendered page.
 */
export class ConfigurationError extends Error {
  readonly issues: string[];

  constructor(message: string, issues: string[] = []) {
    super(message);
    this.name = 'ConfigurationError';
    this.issues = issues;
  }
}

/** An absolute http(s) URL, or empty (which `requireSupabasePublicEnv` rejects). */
function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Exactly one issue per variable.
 *
 * A `.refine()` stacked on `.min(1)` fires both for an empty string, producing
 * the contradictory "is set but empty *and* must be an absolute URL" pair. A
 * single `superRefine` that returns after the first problem keeps the output to
 * one actionable line per name.
 */
const supabaseUrl = z.string().trim().superRefine((value, ctx) => {
  if (value.length === 0) {
    ctx.addIssue({ code: 'custom', message: 'is required (unset or empty)' });
    return;
  }
  if (!isHttpUrl(value)) {
    ctx.addIssue({
      code: 'custom',
      message: 'must be an absolute http(s) URL, e.g. https://xxxx.supabase.co',
    });
  }
});

/** Rejects the empty string, which is what an unset Vercel variable looks like. */
const present = z.string().trim().min(1, 'is required (unset or empty)');

/**
 * What the browser bundle is allowed to see. Inlined by Next at build time, so
 * every name here is public by definition.
 */
export const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: present,
  /**
   * Only used for OpenGraph URLs, so a bad value must never be fatal -- hence
   * optional here and coerced safely by `siteUrl()` rather than validated
   * strictly and rejected.
   */
  NEXT_PUBLIC_SITE_URL: z.string().trim().optional(),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

/**
 * The environment as seen by the parser.
 *
 * A plain record rather than `NodeJS.ProcessEnv`, so a test can hand in `{ url: '' }`
 * to describe a broken deployment without having to satisfy the augmented
 * ProcessEnv that Next's types make NODE_ENV mandatory on.
 */
export type EnvSource = Record<string, string | undefined>;

/**
 * Parses the public environment, returning every problem instead of the first.
 * Never throws: callers choose whether a gap is fatal (it is not fatal for a
 * public landing page).
 */
export function parsePublicEnv(source: EnvSource = process.env) {
  // Normalise `undefined` to `''` first. Left as `undefined`, Zod reports
  // "expected string, received undefined" for every absent variable, which
  // tells an operator nothing about what to set. Both cases mean the same
  // thing -- a variable that is missing or empty -- so both must read the same.
  const read = (name: string) => source[name] ?? '';
  return publicEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: read('NEXT_PUBLIC_SUPABASE_URL'),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: read('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'),
    NEXT_PUBLIC_SITE_URL: read('NEXT_PUBLIC_SITE_URL'),
  });
}

/** Human-readable list of what is wrong, for logs and operator dashboards. */
export function describePublicEnvIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const name = issue.path.join('.') || 'environment';
    return `${name} ${issue.message}`;
  });
}

/**
 * True when the browser-facing Supabase config is usable.
 *
 * The one guard that keeps a misconfigured deployment serving pages. A public
 * landing page asks this before building a database client; if it is false the
 * page renders signed-out rather than throwing, which is the difference
 * between "the marketing page is up and the sign-in button explains itself"
 * and a whole-app 500 behind `global-error.tsx`.
 */
export function isSupabaseConfigured(source: EnvSource = process.env): boolean {
  return parsePublicEnv(source).success;
}

/**
 * The public Supabase config, or a ConfigurationError naming every missing
 * variable. Used on the paths where a database is genuinely required, so the
 * failure is a clear operator message instead of a downstream TypeError.
 */
export function requireSupabasePublicEnv(source: EnvSource = process.env) {
  const parsed = parsePublicEnv(source);
  if (!parsed.success) {
    const issues = describePublicEnvIssues(parsed.error);
    throw new ConfigurationError(
      `Supabase is not configured. Set these in Vercel (and .env.local): ${issues.join('; ')}. See .env.example.`,
      issues,
    );
  }
  return {
    url: parsed.data.NEXT_PUBLIC_SUPABASE_URL,
    key: parsed.data.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  };
}

/**
 * The canonical origin, as a URL.
 *
 * `new URL()` throws on anything that is not absolute, and `metadataBase` is
 * evaluated while the root layout module loads -- so a `NEXT_PUBLIC_SITE_URL`
 * like `quorvexhackathon.vercel.app` (no scheme) used to fail the build, and a
 * malformed one deployed to production failed every request. A metadata
 * fallback is not worth a 500, so a bad value degrades to the default here.
 */
/** A plausible host: dotted name, `localhost`, or a bare IP. */
const HOSTNAME = /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$|^localhost$|^\d{1,3}(?:\.\d{1,3}){3}$/i;

export function siteUrl(source: EnvSource = process.env): URL {
  const raw = source.NEXT_PUBLIC_SITE_URL?.trim();

  // Only add a scheme when there is not already one, and only from a real value:
  // `https://${undefined}` is the *valid* URL "https://undefined", and
  // `https://http://` parses as the host "http".
  const candidates = raw
    ? [/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`]
    : [];
  candidates.push('http://localhost:3000');

  for (const candidate of candidates) {
    try {
      const url = new URL(candidate);
      if (
        (url.protocol === 'http:' || url.protocol === 'https:') &&
        HOSTNAME.test(url.hostname)
      ) {
        return url;
      }
    } catch {
      // Try the next candidate.
    }
  }
  return new URL('http://localhost:3000');
}

export function serverEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new ConfigurationError(
      `Missing required server environment variable ${name}. See .env.example.`,
    );
  }
  return value;
}

export function optionalEnv(name: string): string | undefined {
  const value = process.env[name];
  return value && value.length > 0 ? value : undefined;
}

export function isDemoMode(): boolean {
  return process.env.DEMO_MODE === 'true';
}

export function isAiDisabled(): boolean {
  return process.env.AI_DISABLED === 'true';
}

export const supabaseConfig = {
  url: () => process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  publishableKey: () => process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '',
  serviceRoleKey: () => optionalEnv('SUPABASE_SERVICE_ROLE_KEY'),
};
