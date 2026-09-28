import { DayAttendanceSchema } from '@/contracts';
import { getDayAttendance } from '@/lib/domain/attendance';
import { routeDate } from '@/lib/domain/params';
import { withApi } from '@/lib/security/api';

/**
 * GET /api/v1/days/:date/attendance
 *
 * `:date` is a site-local YYYY-MM-DD, not a timestamp, so "today" means the
 * supervisor's today. The work-day row is what carries the lock flag, so a
 * date with no work day is a 404 rather than an empty list that looks like a
 * quiet site.
 */
export const GET = withApi({
  response: DayAttendanceSchema,
  async handler({ db, user, params }) {
    return getDayAttendance(db, user.siteId, routeDate(params));
  },
});
