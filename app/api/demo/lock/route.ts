import { z } from 'zod';

import { DateOnlySchema, emptyResponse } from '@/contracts';
import { withApi } from '@/lib/security/api';
import { ApiError, fromPostgrest } from '@/lib/domain/errors';
import { requireDemoMode } from '@/lib/demo/guard';

/**
 * POST /api/demo/lock  { date }
 *
 * Locks a work day, which is the irreversible step in a real shift: after it,
 * figures are final and any later correction is recorded as an amendment. It is
 * exposed here so a demo can show what "done" looks like.
 *
 * Deliberately routed through the service-role writer, because the day lock is
 * exactly the rule that must not be skippable by a caller holding a valid JWT,
 * and because the caller may lock a day they do not own a record in. Scope is
 * still pinned to `user.siteId`, so this cannot reach another site's day.
 */
export const POST = withApi({
  body: z.object({ date: DateOnlySchema }),
  response: emptyResponse,
  async handler({ db, writer, user, input }) {
    requireDemoMode();

    const { date } = input.body!;

    const { data, error } = await db
      .from('work_days')
      .select('id, locked_at')
      .eq('site_id', user.siteId)
      .eq('work_date', date)
      .maybeSingle();

    if (error) throw fromPostgrest(error);
    if (!data) throw ApiError.notFound();

    // Idempotent: re-locking a locked day is a no-op, not an error, so a judge
    // can press the button twice without the demo breaking.
    if (data.locked_at) return {};

    const { error: lockError } = await writer
      .from('work_days')
      .update({ locked_at: new Date().toISOString() })
      .eq('id', data.id);

    if (lockError) throw fromPostgrest(lockError);

    return {};
  },
});
