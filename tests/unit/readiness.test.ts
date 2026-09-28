import { describe, expect, it } from 'vitest';

import { computeReadiness, type ReadinessInput } from '@/lib/domain/readiness';

/**
 * The readiness score is a number a supervisor will act on, so these tests pin
 * the behaviour that must not drift: a perfect day scores 100, unresolved work
 * drags the score down, and the advice is ordered by what actually moves the
 * number.
 */

const cleanDay: ReadinessInput = {
  date: '2026-09-28',
  total: 12,
  confirmed: 12,
  disputed: 0,
  noReply: 0,
  openDisputes: 0,
  untriagedHazards: 0,
  hazardsTotal: 2,
  locked: true,
};

describe('computeReadiness', () => {
  it('scores a fully settled, locked day at 100', () => {
    const result = computeReadiness(cleanDay);
    expect(result.score).toBe(100);
    expect(result.band).toBe('ready');
    expect(result.components.every((c) => c.status === 'good')).toBe(true);
  });

  it('never divides by zero on an empty site', () => {
    const result = computeReadiness({
      date: '2026-09-28',
      total: 0,
      confirmed: 0,
      disputed: 0,
      noReply: 0,
      openDisputes: 0,
      untriagedHazards: 0,
      hazardsTotal: 0,
      locked: false,
    });
    expect(result.score).toBe(100);
    expect(Number.isNaN(result.score)).toBe(false);
  });

  it('penalises each open dispute, since each blocks a worker\'s payroll', () => {
    const one = computeReadiness({ ...cleanDay, openDisputes: 1, locked: false });
    const four = computeReadiness({ ...cleanDay, openDisputes: 4, locked: false });
    expect(one.score).toBeGreaterThan(four.score);
  });

  it('drops the band to at-risk when workers have not replied at all', () => {
    const result = computeReadiness({
      ...cleanDay,
      confirmed: 0,
      noReply: 12,
      locked: false,
    });
    expect(result.band).toBe('at-risk');
    expect(result.headline).toContain('blocked');
  });

  it('will not let a perfect attendance board offset an untriaged hazard', () => {
    // Safety is weighted so that a clean shift cannot paper over an unjudged
    // risk; this is the case that a naive average would get wrong.
    const result = computeReadiness({
      ...cleanDay,
      hazardsTotal: 4,
      untriagedHazards: 4,
      locked: false,
    });
    const hazards = result.components.find((c) => c.key === 'hazards');
    expect(hazards?.score).toBe(0);
    expect(hazards?.status).toBe('critical');
    expect(result.score).toBeLessThan(85);
  });

  it('reports an open dispute ahead of a smaller confirmation gap', () => {
    // Ordered by the score each would recover, not by UI order.
    const result = computeReadiness({
      ...cleanDay,
      confirmed: 11,
      noReply: 1,
      openDisputes: 2,
      locked: false,
    });
    expect(result.improvements[0]?.href).toBe('/disputes');
  });

  it('links every improvement to the screen that fixes it', () => {
    const result = computeReadiness({
      ...cleanDay,
      confirmed: 6,
      noReply: 6,
      openDisputes: 1,
      untriagedHazards: 1,
      hazardsTotal: 2,
      locked: false,
    });
    expect(result.improvements.length).toBeGreaterThan(0);
    for (const item of result.improvements) {
      expect(item.href).toMatch(/^\//);
      expect(item.action.length).toBeGreaterThan(0);
      expect(item.because.length).toBeGreaterThan(0);
    }
  });

  it('suggests locking the day only when nothing is outstanding', () => {
    const tidy = computeReadiness({ ...cleanDay, locked: false });
    expect(tidy.improvements.map((i) => i.action)).toContain('Lock the day');

    const busy = computeReadiness({ ...cleanDay, noReply: 3, confirmed: 9, locked: false });
    expect(busy.improvements.map((i) => i.action)).not.toContain('Lock the day');
  });

  it('always returns a schema-valid score within range', () => {
    const worst: ReadinessInput = {
      date: '2026-09-28',
      total: 40,
      confirmed: 0,
      disputed: 40,
      noReply: 40,
      openDisputes: 8,
      untriagedHazards: 9,
      hazardsTotal: 9,
      locked: false,
    };
    const result = computeReadiness(worst);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.band).toBe('at-risk');
  });

  it('is deterministic', () => {
    expect(computeReadiness(cleanDay)).toEqual(computeReadiness(cleanDay));
  });
});
