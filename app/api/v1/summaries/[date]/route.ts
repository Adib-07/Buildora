import { DaySummarySchema } from '@/contracts';
import { routeDate } from '@/lib/domain/params';
import { getDaySummary } from '@/lib/domain/summary';
import { withApi } from '@/lib/security/api';

/**
 * GET /api/v1/summaries/:date
 *
 * Engineer and owner only, per the contract: the summary is the client-facing
 * artefact, while the supervisor works from the individual attendance and
 * dispute queues it is built from.
 */
export const GET = withApi({
  roles: ['engineer', 'owner'],
  response: DaySummarySchema,
  async handler({ db, user, params }) {
    return getDaySummary(db, user.siteId, routeDate(params));
  },
});
