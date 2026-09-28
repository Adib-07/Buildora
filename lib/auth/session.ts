import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

import type { Me } from '@/contracts';

import { supabaseConfig, isDemoMode } from '@/lib/config/env';
import { now } from '@/lib/domain/clock';

/**
 * Cookie access is injected rather than imported from next/headers so the auth
 * flow can be exercised in tests without a Next request context.
 */
export type CookieStore = {
  getAll: () => { name: string; value: string }[];
  setAll: (
    cookies: { name: string; value: string; options: Record<string, unknown> }[],
  ) => void;
};

export function cookieStoreFromNext(cookieStore: {
  getAll: () => { name: string; value: string }[];
  set: (name: string, value: string, options: Record<string, unknown>) => void;
}): CookieStore {
  return {
    getAll: () => cookieStore.getAll(),
    setAll: (cookies) => {
      for (const c of cookies) cookieStore.set(c.name, c.value, c.options);
    },
  };
}

/**
 * A Supabase client that carries the caller's session cookie.
 *
 * Requests are therefore made as `authenticated` under the caller's own JWT, so
 * every query is filtered by the RLS policies in the initial migration. This is
 * the primary reason staff routes cannot leak another site's rows: the database
 * refuses them, not the application code.
 */
export function createSessionClient(cookies: CookieStore): SupabaseClient {
  const url = supabaseConfig.url();
  const key = supabaseConfig.publishableKey();
  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set.');
  if (!key) throw new Error('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is not set.');

  return createServerClient(url, key, {
    cookies: {
      getAll: cookies.getAll,
      setAll: cookies.setAll,
    },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export const SessionUserSchema = z.object({
  staffId: z.string().uuid(),
  siteId: z.string().uuid(),
  role: z.enum(['supervisor', 'engineer', 'owner']),
  email: z.string(),
  name: z.string(),
});

export type SessionUser = z.infer<typeof SessionUserSchema>;

/** postgres `time` arrives as HH:MM:SS; the contract's ClockSchema wants HH:mm. */
function clockTime(value: string): string {
  return value.slice(0, 5);
}

/**
 * The full `Me` payload for a signed-in staff member: identity plus the site
 * settings every screen needs (timezone, shift end, summary cutoff).
 *
 * Built in one place so no page has to assemble it, and so a page cannot
 * accidentally show a shift end from a different site than the user.
 */
export async function loadSession(
  client: SupabaseClient,
  user: SessionUser,
): Promise<Me> {
  const { data: site, error } = await client
    .from('sites')
    .select('name, timezone, shift_end, summary_cutoff')
    .eq('id', user.siteId)
    .maybeSingle();
  if (error || !site) throw new Error('Site lookup failed.');

  const serverNow = await now(client, user.siteId);
  return {
    staffId: user.staffId,
    name: user.name,
    role: user.role,
    siteId: user.siteId,
    siteName: site.name,
    timezone: site.timezone,
    shiftEnd: clockTime(site.shift_end),
    summaryCutoff: clockTime(site.summary_cutoff),
    demoMode: isDemoMode(),
    serverNow: serverNow.toISOString(),
  };
}

/**
 * Resolves the caller to a staff row.
 *
 * The role and site always come from `public.staff`, never from the JWT payload
 * or anything the client sent. `getUser()` revalidates the token with the Auth
 * server rather than trusting the locally cached session, so a forged or
 * expired cookie cannot produce a session here.
 */
export async function resolveSessionUser(
  client: SupabaseClient,
): Promise<SessionUser | null> {
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return null;

  const { data: row, error: staffError } = await client
    .from('staff')
    .select('id, site_id, role, email, full_name')
    .eq('id', data.user.id)
    .maybeSingle();

  // A valid Supabase user with no staff row is authenticated but not a member of
  // any site. Treat that as unauthenticated for API purposes.
  if (staffError || !row) return null;

  const parsed = SessionUserSchema.safeParse({
    staffId: row.id,
    siteId: row.site_id,
    role: row.role,
    email: row.email,
    name: row.full_name,
  });
  return parsed.success ? parsed.data : null;
}
