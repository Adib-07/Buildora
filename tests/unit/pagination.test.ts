import { describe, expect, it } from 'vitest';

import {
  buildPage,
  decodeCursor,
  encodeCursor,
  keysetAfter,
  PageSize,
} from '@/lib/domain/pagination';

/**
 * Keyset pagination.
 *
 * The cursor reaches the database inside a PostgREST `or()` filter, which is a
 * raw string. That makes the escaping the security-relevant part of this file:
 * a sort key that is not quoted correctly can close the predicate and append a
 * clause of the caller's choosing.
 */
describe('cursor encoding', () => {
  it('round-trips a key and id', () => {
    const cursor = { key: 'Ramesh Kumar', id: '0c000001-0000-4000-8000-000000000001' };
    expect(decodeCursor(encodeCursor(cursor.key, cursor.id))).toEqual(cursor);
  });

  it('returns null for a cursor it did not issue', () => {
    // Hand-edited or attacker-supplied values must not reach the query as a
    // predicate; ignoring them is the only safe reading.
    expect(decodeCursor('not-a-cursor')).toBeNull();
    expect(decodeCursor('')).toBeNull();
    expect(decodeCursor(null)).toBeNull();
    expect(decodeCursor(undefined)).toBeNull();
  });

  it('rejects a cursor whose id is not a uuid', () => {
    const forged = Buffer.from(
      JSON.stringify({ key: 'x', id: "1) or id.gt.00000000-0000-0000-0000-000000000000--" }),
      'utf8',
    ).toString('base64url');
    expect(decodeCursor(forged)).toBeNull();
  });
});

describe('keysetAfter', () => {
  it('emits two clauses so rows sharing a sort key are not skipped', () => {
    const filter = keysetAfter('full_name', 'id', {
      key: 'Ramesh Kumar',
      id: '0c000001-0000-4000-8000-000000000001',
    });
    expect(filter).toContain('full_name.gt."Ramesh Kumar"');
    expect(filter).toContain('full_name.eq."Ramesh Kumar"');
    expect(filter).toContain('id.gt.0c000001-0000-4000-8000-000000000001');
  });

  it('quotes a value containing the filter separator', () => {
    const filter = keysetAfter('full_name', 'id', {
      key: 'Kumar, Ramesh',
      id: '0c000001-0000-4000-8000-000000000001',
    });
    // The comma is inside the quotes, so it cannot split the clause.
    expect(filter).toContain('"Kumar, Ramesh"');
  });

  it('neutralises an attempt to close the predicate and add a clause', () => {
    const filter = keysetAfter('full_name', 'id', {
      key: 'x"),or(id.gt.00000000-0000-0000-0000-000000000000',
      id: '0c000001-0000-4000-8000-000000000001',
    });
    // The double quote is escaped, so the literal stays one value and the
    // injected `or(...)` is text rather than syntax.
    expect(filter).toContain('\\"');
    // The unescaped form must not appear anywhere in the output.
    expect(filter).not.toMatch(/full_name\.gt\."x"\),or\(/);
  });

  it('escapes a backslash so it cannot be used to escape the closing quote', () => {
    const filter = keysetAfter('full_name', 'id', {
      key: 'a\\",or(1.eq.1',
      id: '0c000001-0000-4000-8000-000000000001',
    });
    expect(filter).toContain('\\\\');
  });
});

describe('buildPage', () => {
  const rows = Array.from({ length: PageSize + 1 }, (_, i) => ({
    id: `0c000001-0000-4000-8000-00000000000${i % 10}`,
    full_name: `Worker ${String(i).padStart(3, '0')}`,
  }));

  it('returns a cursor only when there is more to fetch', () => {
    const full = buildPage(rows, PageSize, (r) => r.full_name);
    expect(full.items).toHaveLength(PageSize);
    expect(full.nextCursor).not.toBeNull();

    const exact = buildPage(rows.slice(0, PageSize), PageSize, (r) => r.full_name);
    expect(exact.nextCursor).toBeNull();
  });

  it('derives the cursor from the last returned row, not the last fetched', () => {
    const page = buildPage(rows, PageSize, (r) => r.full_name);
    const last = page.items[page.items.length - 1]!;
    const decoded = decodeCursor(page.nextCursor);
    // If this used the extra probe row, the next page would skip one worker.
    expect(decoded?.key).toBe(last.full_name);
    expect(decoded?.id).toBe(last.id);
  });
});
