import { z } from 'zod';

import { CreateWorkerRequestSchema, PageSchema, WorkerSchema } from '@/contracts';
import { createWorker, listWorkers } from '@/lib/domain/workers';
import { withApi } from '@/lib/security/api';

const Query = z.object({
  teamId: z.string().uuid().optional(),
  // Strings, not booleans: `?active=false` must be distinguishable from
  // `?active` being absent, which a boolean query param cannot express.
  active: z.enum(['true', 'false']).optional(),
  cursor: z.string().optional(),
});

const Page = PageSchema(WorkerSchema);

/** GET /api/v1/workers -- the caller's own site's roster, paginated. */
export const GET = withApi({
  response: Page,
  query: Query,
  async handler({ db, user, input }) {
    return listWorkers(db, user.role, {
      teamId: input.query?.teamId,
      active: input.query?.active === undefined ? undefined : input.query.active === 'true',
      cursor: input.query?.cursor,
    });
  },
});

/** POST /api/v1/workers -- supervisor only; engineers and owners are read-only. */
export const POST = withApi({
  roles: ['supervisor'],
  body: CreateWorkerRequestSchema,
  response: WorkerSchema,
  async handler({ db, writer, user, input }) {
    return createWorker(db, writer, user.siteId, user.staffId, input.body);
  },
});
