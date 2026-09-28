import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { optionalEnv } from '@/lib/config/env';

import { PUBLISHABLE_KEY, SEED_PASSWORD, SUPABASE_URL } from './env';

function anonClient(): SupabaseClient {
  return createClient(SUPABASE_URL, PUBLISHABLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export type Actor = {
  client: SupabaseClient;
  accessToken: string;
  userId: string;
};

/**
 * Signs in as a seeded staff member and returns a client that sends that user's
 * JWT on every request.
 *
 * This is the important part for the security tests: queries are then executed
 * by Postgres as `authenticated`, so RLS applies exactly as it does for the
 * real API. A test that used a service-role client would prove nothing about
 * tenant isolation.
 */
export async function signIn(email: string): Promise<Actor> {
  const client = anonClient();
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password: SEED_PASSWORD,
  });
  if (error || !data.session) {
    throw new Error(`Seeded sign-in failed for ${email}: ${error?.message ?? 'no session'}`);
  }

  const scoped = createClient(SUPABASE_URL, PUBLISHABLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${data.session.access_token}` } },
  });

  return { client: scoped, accessToken: data.session.access_token, userId: data.user.id };
}

export const siteASupervisor = () => signIn('supervisor@quarryridge.test');
export const siteAEngineer = () => signIn('engineer@quarryridge.test');
export const siteBSupervisor = () => signIn('supervisor@harbourworks.test');

/** Unsigned-in client: the anonymous/anon role, for RLS denial checks. */
export const anonymous = () => anonClient();

/**
 * Service-role client, used by tests that must exercise the API's *write* path.
 *
 * `authenticated` deliberately holds SELECT only. Writes go through the API
 * routes with the service role because the business rules that guard them
 * (expectedVersion, DAY_LOCKED, one-owner, phone reuse) live in application
 * code, not in SQL. Granting the user JWT INSERT/UPDATE would let any caller
 * holding a token bypass those rules by talking to PostgREST directly.
 */
export function serviceRole(): SupabaseClient {
  // Read through the same accessor the application uses, so there is exactly
  // one place that knows how the service-role key is obtained.
  const key = optionalEnv('SUPABASE_SERVICE_ROLE_KEY');
  if (!key) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is required for write-path tests. Copy .env.example to .env.local.',
    );
  }
  return createClient(SUPABASE_URL, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
