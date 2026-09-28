/**
 * Environment access.
 *
 * Server-only secrets are read lazily and never through a NEXT_PUBLIC_ prefix,
 * so Next cannot inline them into the client bundle. `assertServerEnv` fails
 * loudly rather than letting a route start with a half-configured client.
 */

export function serverEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
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
