import { DisputeSchema, ResolveDisputeRequestSchema } from '@/contracts';
import { resolveDispute } from '@/lib/domain/disputes';
import { routeId } from '@/lib/domain/params';
import { withApi } from '@/lib/security/api';

/**
 * POST /api/v1/disputes/:id/resolve
 *
 * Supervisor only. The transition is guarded twice: the handler checks the
 * dispute is still `open`, and the UPDATE's own WHERE clause carries
 * `status = 'open'`, so two resolves racing produce one 409 rather than a
 * silent overwrite.
 */
export const POST = withApi({
  roles: ['supervisor'],
  body: ResolveDisputeRequestSchema,
  response: DisputeSchema,
  async handler({ db, writer, user, params, input }) {
    return resolveDispute(db, writer, user.siteId, user.staffId, routeId(params), input.body);
  },
});
