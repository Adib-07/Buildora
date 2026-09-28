import { z } from 'zod';

import { DateOnlySchema, PageSchema } from '@/contracts';
import { HazardSchema } from '@/contracts';
import { listHazards } from '@/lib/domain/hazards';
import { withApi } from '@/lib/security/api';

const Query = z.object({
  status: z.string().max(40).optional(),
  category: z.string().max(40).optional(),
  from: DateOnlySchema.optional(),
  to: DateOnlySchema.optional(),
  cursor: z.string().optional(),
});

const Page = PageSchema(HazardSchema);

/**
 * GET /api/v1/hazards
 *
 * Filters are optional strings rather than closed enums here on purpose: the
 * list must not 422 because a caller passed a status this build does not know
 * yet, it should return the hazards that match. The values that reach the
 * database are still parameterised, never interpolated.
 */
export const GET = withApi({
  response: Page,
  query: Query,
  async handler({ db, input }) {
    return listHazards(db, {
      status: input.query?.status,
      category: input.query?.category,
      from: input.query?.from,
      to: input.query?.to,
      cursor: input.query?.cursor,
    });
  },
});
