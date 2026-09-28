import { describe, expect, it } from 'vitest';

import { draftTasksFromText } from '@/lib/domain/tasks';
import { shiftDate } from '@/lib/domain/summary';

/**
 * The deterministic drafting fallback.
 *
 * `AI_DISABLED=true` in this deployment, so this is the code that actually
 * produces task drafts. It matters that it errs towards leaving an owner
 * unresolved: `owner_worker_id` is NOT NULL, and putting the wrong name on a
 * task is worse than making the supervisor choose.
 */
const TEAM = '0a000001-0000-4000-8000-000000000001';
const ROSTER = [
  { id: '0c000001-0000-4000-8000-000000000001', fullName: 'Ramesh Kumar', teamId: TEAM, active: true },
  { id: '0c000001-0000-4000-8000-000000000004', fullName: 'Ramesh Second', teamId: TEAM, active: true },
  { id: '0c000001-0000-4000-8000-000000000003', fullName: 'Lakshmi Devi', teamId: TEAM, active: true },
  { id: '0c000001-0000-4000-8000-000000000005', fullName: 'Inactive Worker', teamId: null, active: false },
];

const LAKSHMI = '0c000001-0000-4000-8000-000000000003';

describe('draftTasksFromText', () => {
  it('splits a note into one draft per statement', () => {
    const result = draftTasksFromText(
      'Plaster Block B. Fix the leaking pipe.',
      ROSTER,
    );
    expect(result.drafts).toHaveLength(2);
    expect(result.drafts[0]?.title).toBe('Plaster Block B');
    expect(result.drafts[1]?.title).toBe('Fix the leaking pipe');
  });

  it('reports that it was the fallback rather than a model', () => {
    // `fallback: true` is what lets the UI be honest about how these were made.
    expect(draftTasksFromText('Do something', ROSTER).fallback).toBe(true);
  });

  it('resolves an owner when exactly one name matches', () => {
    const result = draftTasksFromText('Lakshmi Devi to fix the pipe', ROSTER);
    expect(result.drafts[0]?.ownerWorkerId).toBe(LAKSHMI);
  });

  it('matches on a first name alone', () => {
    const result = draftTasksFromText('Lakshmi to fix the pipe', ROSTER);
    expect(result.drafts[0]?.ownerWorkerId).toBe(LAKSHMI);
  });

  it('leaves the owner unresolved when two people match', () => {
    // Two workers share the name Ramesh. Picking one silently would assign work
    // to the wrong person.
    const result = draftTasksFromText('Ask Ramesh to plaster Block B', ROSTER);
    const draft = result.drafts[0]!;
    expect(draft.ownerWorkerId).toBeNull();
    expect(draft.ownerCandidates.map((c) => c.name).sort()).toEqual([
      'Ramesh Kumar',
      'Ramesh Second',
    ]);
  });

  it('leaves the owner unresolved when nobody is named', () => {
    const result = draftTasksFromText('Clear the walkway', ROSTER);
    expect(result.drafts[0]?.ownerWorkerId).toBeNull();
    expect(result.drafts[0]?.ownerCandidates).toEqual([]);
  });

  it('never proposes an inactive worker', () => {
    const result = draftTasksFromText('Inactive Worker to clear the walkway', ROSTER);
    expect(result.drafts[0]?.ownerWorkerId).toBeNull();
    expect(result.drafts[0]?.ownerCandidates).toEqual([]);
  });

  it('strips a lead-in so the title is the work, not the instruction', () => {
    const result = draftTasksFromText('Ask Ramesh to plaster Block B', ROSTER);
    expect(result.drafts[0]?.title).toBe('Plaster Block B');
  });

  it('truncates a title to the length the database accepts', () => {
    const result = draftTasksFromText('x'.repeat(400), ROSTER);
    expect(result.drafts[0]!.title.length).toBeLessThanOrEqual(120);
  });

  it('returns no drafts for an empty note', () => {
    expect(draftTasksFromText('   ', ROSTER).drafts).toHaveLength(0);
  });

  it('always produces a contract-valid response', () => {
    for (const text of ['', 'one', 'one. two. three', 'Ramesh and Ramesh']) {
      expect(draftTasksFromText(text, ROSTER)).toHaveProperty('drafts');
      expect(draftTasksFromText(text, ROSTER).drafts.length).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('shiftDate', () => {
  it('steps backwards and forwards across a month boundary', () => {
    expect(shiftDate('2026-10-01', -1)).toBe('2026-09-30');
    expect(shiftDate('2026-09-30', 1)).toBe('2026-10-01');
  });

  it('handles a leap day', () => {
    expect(shiftDate('2028-03-01', -1)).toBe('2028-02-29');
  });

  it('crosses a year boundary', () => {
    expect(shiftDate('2026-01-01', -1)).toBe('2025-12-31');
  });
});
