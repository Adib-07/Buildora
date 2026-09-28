import { MeSchema } from '@/contracts';
import { isDemoMode } from '@/lib/config/env';
import { clockTime } from '@/lib/domain/mappers';
import { now } from '@/lib/domain/clock';
import { ApiError, withApi } from '@/lib/security/api';

/**
 * GET /api/v1/me
 *
 * `siteId` and `role` come from the staff row, so a caller can never widen its
 * own access. `serverNow` honours `sites.demo_now` when DEMO_MODE is on, which
 * is what lets the demo move the clock without touching real attendance.
 */
export const GET = withApi({
  response: MeSchema,
  async handler({ db, user }) {
    const { data: site, error } = await db
      .from('sites')
      .select('name, timezone, shift_end, summary_cutoff')
      .eq('id', user.siteId)
      .maybeSingle();

    if (error || !site) throw new ApiError('INTERNAL', 'Site lookup failed.');

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
      serverNow: (await now(db, user.siteId)).toISOString(),
    };
  },
});
