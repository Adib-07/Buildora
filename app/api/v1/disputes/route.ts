import { z } from 'zod';

import { DisputeSchema } from '@/contracts';
import { listDisputes } from '@/lib/domain/disputes';
import { withApi } from '@/lib/security/api';

const Query = z.object({ status: z.enum(['open', 'all']).optional() });
const Response = z.object({ items: z.array(DisputeSchema) });

/**
 * GET /api/v1/disputes?status=open|all
 *
 * `open` is the default because the supervisor's queue is what they have not
 * acted on yet; resolved disputes are history.
 */
export const GET = withApi({
  response: Response,
  query: Query,
  async handler({ db, input }) {
    return { items: await listDisputes(db, { status: input.query?.status ?? 'open' }) };
  },
});
