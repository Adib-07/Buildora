import { DisputeDetailSchema } from '@/contracts';
import { getDispute } from '@/lib/domain/disputes';
import { routeId } from '@/lib/domain/params';
import { withApi } from '@/lib/security/api';

/**
 * GET /api/v1/disputes/:id
 *
 * Includes the record's full edit history, so a supervisor can see how a
 * record reached the values being disputed instead of taking the worker's word
 * or the site's on trust.
 */
export const GET = withApi({
  response: DisputeDetailSchema,
  async handler({ db, params }) {
    return getDispute(db, routeId(params));
  },
});
