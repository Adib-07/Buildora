import { UpdateWorkerRequestSchema, WorkerSchema } from '@/contracts';
import { routeId } from '@/lib/domain/params';
import { updateWorker } from '@/lib/domain/workers';
import { withApi } from '@/lib/security/api';

/**
 * PATCH /api/v1/workers/:id
 *
 * The target is resolved through the RLS-scoped client first, so another site's
 * worker is indistinguishable from one that does not exist, and the write is
 * additionally pinned to the caller's `site_id`.
 */
export const PATCH = withApi({
  roles: ['supervisor'],
  body: UpdateWorkerRequestSchema,
  response: WorkerSchema,
  async handler({ db, writer, user, params, input }) {
    return updateWorker(db, writer, user.siteId, user.staffId, routeId(params), input.body);
  },
});
