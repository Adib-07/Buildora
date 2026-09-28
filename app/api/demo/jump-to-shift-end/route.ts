import { emptyResponse } from '@/contracts';
import { withApi } from '@/lib/security/api';
import { ApiError, fromPostgrest } from '@/lib/domain/errors';
import { requireDemoMode } from '@/lib/demo/guard';
import { clockTime } from '@/lib/domain/mappers';

/**
 * POST /api/demo/jump-to-shift-end
 *
 * Moves the simulated wall clock (`sites.demo_now`) to 45 minutes past the
 * site's shift end, so the dashboard reads "shift over" and the queues a
 * supervisor actually closes at 17:30 are the ones on screen.
 *
 * It writes the same override `lib/domain/clock.ts` reads everywhere, so every
 * date on every screen moves together rather than just this one. Passing
 * `demo_now = null` restores the real clock.
 */
export const POST = withApi({
  response: emptyResponse,
  async handler({ db, user }) {
    requireDemoMode();

    // Read the site through the session client rather than reaching for `me`:
    // the shift end is the site's setting, and going back to the row keeps this
    // route honest if the shift end changes between the session and this call.
    const { data: site, error } = await db
      .from('sites')
      .select('timezone, shift_end')
      .eq('id', user.siteId)
      .maybeSingle();

    if (error) throw fromPostgrest(error);
    if (!site) throw new ApiError('INTERNAL', 'Site lookup failed.');

    // The target date is taken in the site's own timezone: 17:30 in Asia/Kolkata
    // is not 17:30 UTC, and a demo that jumps to the wrong hour is worse than no
    // demo at all. Take the local calendar day first, then pin the local clock
    // time to it.
    const localDay = new Intl.DateTimeFormat('en-CA', {
      timeZone: site.timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());

    const [year, month, day] = localDay.split('-').map(Number);
    const [shiftHour, shiftMinute] = clockTime(site.shift_end).split(':').map(Number);

    const jumped = new Date(
      Date.UTC(year, month - 1, day, shiftHour, shiftMinute + 45),
    );

    const { error: updateError } = await db
      .from('sites')
      .update({ demo_now: jumped.toISOString() })
      .eq('id', user.siteId);

    if (updateError) throw fromPostgrest(updateError);

    return {};
  },
});
