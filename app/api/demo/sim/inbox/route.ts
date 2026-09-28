import { z } from 'zod';

import { PhoneSchema, SimMessageSchema, type SimMessage } from '@/contracts';
import { withApi } from '@/lib/security/api';
import { fromPostgrest } from '@/lib/domain/errors';
import { requireDemoMode } from '@/lib/demo/guard';

/**
 * GET /api/demo/sim/inbox?phone=
 *
 * The message history for one SIM phone, in and out, so a demo can show the
 * worker-side conversation without a gateway. Scoped to the caller's own site:
 * a phone belonging to another site's roster matches no rows.
 */
const Query = z.object({ phone: PhoneSchema });
const Response = z.object({ items: z.array(SimMessageSchema) });

export const GET = withApi({
  query: Query,
  response: Response,
  async handler({ db, user, input }) {
    requireDemoMode();

    const { data, error } = await db
      .from('messages')
      .select('id, direction, body, template_key, created_at, to_phone')
      .eq('site_id', user.siteId)
      .eq('to_phone', input.query!.phone)
      .order('created_at', { ascending: true })
      .limit(50);

    if (error) throw fromPostgrest(error);

    const items: SimMessage[] = (data ?? []).map((row) => ({
      id: row.id,
      direction: row.direction,
      body: row.body,
      // null for free-text inbound content; SMS templates always carry a key.
      templateKey: row.template_key ?? null,
      createdAt: row.created_at,
    }));

    return { items };
  },
});
