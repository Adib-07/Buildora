import { HazardDetailSchema, HazardSchema, PatchHazardRequestSchema } from '@/contracts';
import { getHazard, patchHazard } from '@/lib/domain/hazards';
import { routeId } from '@/lib/domain/params';
import { withApi } from '@/lib/security/api';

/**
 * GET /api/v1/hazards/:id
 *
 * The card, the reports behind it, and the full triage history, so a supervisor
 * can see who has already touched it.
 */
export const GET = withApi({
  response: HazardDetailSchema,
  async handler({ db, params }) {
    return getHazard(db, routeId(params));
  },
});

/**
 * PATCH /api/v1/hazards/:id
 *
 * Supervisor only: triage and owner assignment are the site's call, not
 * something a worker's SMS can do. `mergeIntoId` folds a duplicate into the
 * hazard that already covers the same risk, moving its reports across so
 * nothing a worker sent is lost.
 */
export const PATCH = withApi({
  roles: ['supervisor'],
  body: PatchHazardRequestSchema,
  response: HazardSchema,
  async handler({ db, writer, user, params, input }) {
    return patchHazard(db, writer, user.siteId, user.staffId, routeId(params), input.body);
  },
});
