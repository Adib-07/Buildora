import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { supabaseConfig } from '@/lib/config/env';

/**
 * Service-role client: bypasses RLS.
 *
 * Deliberately NOT used by the staff API. Staff routes run as the signed-in
 * user so the database enforces site isolation through RLS, and this client is
 * reserved for the two cases where no user session exists and RLS therefore has
 * nothing to scope:
 *
 *   - inbound gateway webhooks (authenticated by HMAC instead), and
 *   - /api/jobs/* (authenticated by Bearer JOB_SECRET).
 *
 * Every caller must already have authenticated its caller by other means.
 */
export function serviceRoleClient(): SupabaseClient {
  const key = supabaseConfig.serviceRoleKey();
  if (!key) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is not set. Required only for webhooks and jobs.',
    );
  }
  const url = supabaseConfig.url();
  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set.');

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
