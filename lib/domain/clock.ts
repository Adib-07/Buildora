import type { SupabaseClient } from '@supabase/supabase-js';

import { isDemoMode } from '@/lib/config/env';

/**
 * Application clock.
 *
 * In demo mode a site can move time forward (`/api/demo/jump-to-shift-end`), so
 * date calculations read `sites.demo_now` rather than `Date.now()`. Outside demo
 * mode the override is never consulted, so a stray demo_now in the database
 * cannot shift real attendance.
 *
 * The client is passed in rather than created here: callers already hold a
 * session-scoped client, whose RLS policy restricts the lookup to the caller's
 * own site.
 */
export async function now(db: SupabaseClient, siteId: string): Promise<Date> {
  if (!isDemoMode()) return new Date();

  const { data, error } = await db
    .from('sites')
    .select('demo_now')
    .eq('id', siteId)
    .maybeSingle();

  if (error) throw new Error('Failed to read the site clock.');
  if (!data?.demo_now) return new Date();
  return new Date(data.demo_now);
}

/** YYYY-MM-DD for a site's local timezone. */
export function localDate(date: Date, timezone = 'Asia/Kolkata'): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export type SiteClock = {
  timezone: string;
  shiftEnd: string;
  summaryCutoff: string;
  serverNow: string;
  today: string;
};

export async function siteClock(db: SupabaseClient, siteId: string): Promise<SiteClock> {
  const { data, error } = await db
    .from('sites')
    .select('name, timezone, shift_end, summary_cutoff')
    .eq('id', siteId)
    .maybeSingle();

  if (error || !data) throw new Error('Site not found.');

  const current = await now(db, siteId);
  return {
    timezone: data.timezone,
    shiftEnd: data.shift_end,
    summaryCutoff: data.summary_cutoff,
    serverNow: current.toISOString(),
    today: localDate(current, data.timezone),
  };
}
