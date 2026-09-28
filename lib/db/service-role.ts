import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { supabaseConfig } from '@/lib/config/env';

/**
 * Service-role client: bypasses RLS.
 *
 * Used for the API *write* path only. Reads deliberately run as the signed-in
 * user (`lib/auth/session.ts`) so Postgres scopes them through RLS rather than
 * through query construction, which is what makes cross-tenant leakage a
 * database failure instead of an application bug.
 *
 * The write path needs it because the rules that guard writes -- expectedVersion
 * via compare-and-swap, the day lock, exactly one task owner, one open dispute
 * per record -- live in this layer, so the caller's JWT is deliberately not
 * granted INSERT/UPDATE (see docs/db/README.md). The same client also serves
 * the HMAC- and Bearer-authenticated endpoints, where no user session exists.
 *
 * Every caller must already have authenticated and authorised its caller by
 * other means.
 */
let cached: SupabaseClient | undefined;

export function serviceRoleClient(): SupabaseClient {
  if (cached) return cached;

  const key = supabaseConfig.serviceRoleKey();
  if (!key) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is not set. It is required for every write in the app.',
    );
  }
  const url = supabaseConfig.url();
  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set.');

  cached = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return cached;
}
