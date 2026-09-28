import { z } from 'zod';

import { listTeams } from '@/lib/domain/teams';
import { withApi } from '@/lib/security/api';

const Response = z.object({ items: z.array(z.object({ id: z.string(), name: z.string() })) });

/**
 * GET /api/v1/teams
 *
 * RLS restricts this to the caller's own site, so tenancy does not need to be
 * re-derived in the query.
 */
export const GET = withApi({
  response: Response,
  async handler({ db }) {
    return { items: await listTeams(db) };
  },
});
