import { z } from 'zod';

import { IdSchema } from '@/contracts';

/**
 * Keyset (cursor) pagination for the contract's `Page<T>` shape.
 *
 * Keyset rather than offset because a roster changes between pages: with OFFSET
 * an inserted worker silently shifts the window and the supervisor sees one
 * duplicate and one skipped row. The cursor encodes the last row's sort key and
 * id, so the next page starts strictly after it and cannot skip or repeat.
 *
 * The id is the tiebreaker that makes the sort total, because `full_name` is
 * not unique.
 */
export const PageSize = 50;

const CursorSchema = z.object({ key: z.string().max(200), id: IdSchema });

export function encodeCursor(key: string, id: string): string {
  return Buffer.from(JSON.stringify({ key, id }), 'utf8').toString('base64url');
}

/** Returns null for anything we did not produce, so a hand-edited cursor is
 *  treated as "start from the beginning" instead of reaching the database. */
export function decodeCursor(cursor: string | null | undefined): { key: string; id: string } | null {
  if (!cursor) return null;
  try {
    const parsed = CursorSchema.safeParse(JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/**
 * Escapes a value for a PostgREST `or=` literal.
 *
 * `or()` takes a raw filter string, so a value carrying `,` `)` `.` or `"` would
 * otherwise be able to rewrite the predicate. Everything the caller can influence
 * goes through here, wrapped in double quotes with backslashes escaped; the
 * column names are ours, and the id is validated as a uuid before use.
 */
function literal(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/**
 * PostgREST filter for "strictly after (key, id)" in (key ASC, id ASC) order.
 *
 * Two clauses are needed: rows whose sort key is greater, plus rows whose sort
 * key is equal but whose id is greater. A single `key.gt` would drop the second
 * group, which is where same-name workers live.
 */
export function keysetAfter(keyColumn: string, idColumn: string, cursor: { key: string; id: string }): string {
  const k = literal(cursor.key);
  return `(${keyColumn}.gt.${k},and(${keyColumn}.eq.${k},${idColumn}.gt.${cursor.id}))`;
}

/**
 * Slices one page of `limit + 1` rows down to `limit` and derives the cursor for
 * the next page. Fetching the extra row is how we know whether more exist
 * without a second COUNT query.
 */
export function buildPage<T extends { id: string }>(
  rows: T[],
  limit: number,
  sortKey: (row: T) => string,
): { items: T[]; nextCursor: string | null } {
  if (rows.length <= limit) return { items: rows, nextCursor: null };
  const items = rows.slice(0, limit);
  const last = items[items.length - 1]!;
  return { items, nextCursor: encodeCursor(sortKey(last), last.id) };
}
