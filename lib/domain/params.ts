import { z } from 'zod';

import { DateOnlySchema, type DateOnly } from '@/contracts';

import { ApiError } from '@/lib/domain/errors';

/**
 * Dynamic route segments, parsed before a handler sees them.
 *
 * A path segment is untrusted input like any other, so it goes through the same
 * contract schemas the query string uses rather than being cast to `string`.
 */

export function routeId(params: Record<string, string>): string {
  const parsed = z.uuid().safeParse(params.id);
  // NOT_FOUND, not VALIDATION: an id that is not a uuid cannot name a row, and
  // reporting it as a 422 would tell a prober that this route understands ids
  // where a wrong-shaped one would have been a shape error.
  if (!parsed.success) throw ApiError.notFound();
  return parsed.data;
}

export function routeDate(params: Record<string, string>): DateOnly {
  const parsed = DateOnlySchema.safeParse(params.date);
  if (!parsed.success) {
    throw ApiError.validation({ date: 'Date must be in YYYY-MM-DD format.' });
  }
  return parsed.data;
}
