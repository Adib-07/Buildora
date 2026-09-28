import { describe, expect, it } from 'vitest';

import { buildShiftReport, reportFilename, type ReportInput } from '@/lib/domain/report';
import { computeReadiness } from '@/lib/domain/readiness';

/**
 * The exported report is what a supervisor sends to payroll, so the tests cover
 * the two things that would embarrass them: a pipe or newline in worker-supplied
 * text silently breaking the Markdown table, and an empty site rendering a
 * document full of NaN.
 */

const readiness = computeReadiness({
  date: '2026-09-28',
  total: 12,
  confirmed: 10,
  disputed: 1,
  noReply: 1,
  openDisputes: 1,
  untriagedHazards: 1,
  hazardsTotal: 2,
  locked: false,
});

const base: ReportInput = {
  siteName: 'Quarry Ridge',
  date: '2026-09-28',
  readableDate: 'Monday, 28 September',
  timezone: 'Asia/Kolkata',
  shiftEnd: '17:30',
  locked: false,
  readiness,
  workers: { total: 12, confirmed: 10, disputed: 1, noReply: 1, hoursBooked: 94.5 },
  openDisputes: [{ workerName: 'Ramesh G', reason: 'I left at 2pm not 5pm', hours: 8 }],
  hazards: [{ code: 'HZ-004', summary: 'Missing guardrail on level 2', severity: 2, status: 'reported' }],
  tasks: [{ title: 'Plastering B2', owner: 'Sita R', location: 'Block B floor 2' }],
  awaitingReply: ['Kiran P'],
  generatedAt: '2026-09-28T12:00:00.000Z',
};

describe('buildShiftReport', () => {
  it('leads with the score and the headline', () => {
    const markdown = buildShiftReport(base);
    expect(markdown).toContain(`**${readiness.score}/100**`);
    expect(markdown).toContain(readiness.headline);
  });

  it('includes every section heading', () => {
    const markdown = buildShiftReport(base);
    for (const heading of ['## Readiness', '## Attendance', '## Disputes', '## Safety', '## Tasks']) {
      expect(markdown).toContain(heading);
    }
  });

  it('lists the next actions', () => {
    expect(buildShiftReport(base)).toContain('### Next actions');
  });

  it('escapes a pipe so worker text cannot break the table', () => {
    // The reason field comes straight from an SMS. An unescaped pipe would split
    // the row and the whole payroll table after it.
    const markdown = buildShiftReport({
      ...base,
      openDisputes: [{ workerName: 'A|B', reason: 'line one\nline two', hours: 8 }],
    });
    expect(markdown).toContain('A\\|B');
    expect(markdown).toContain('line one line two');
    expect(markdown).not.toMatch(/\| A\|B \|/);
  });

  it('renders a dash rather than a blank cell for missing values', () => {
    const markdown = buildShiftReport({
      ...base,
      hazards: [{ code: 'HZ-001', summary: 'Spillage', severity: null, status: 'reported' }],
      tasks: [{ title: 'Clear drain', owner: 'Unassigned', location: null }],
    });
    expect(markdown).toContain('| — |');
  });

  it('states plainly when there is nothing outstanding', () => {
    const markdown = buildShiftReport({
      ...base,
      openDisputes: [],
      hazards: [],
      tasks: [],
      awaitingReply: [],
    });
    expect(markdown).toContain('None. Every worker who disagreed has had a decision.');
    expect(markdown).toContain('No hazards reported.');
  });

  it('computes confirmation as a percentage', () => {
    expect(buildShiftReport(base)).toContain('10 (83%)');
  });

  it('never emits NaN or undefined for an empty site', () => {
    const markdown = buildShiftReport({
      ...base,
      workers: { total: 0, confirmed: 0, disputed: 0, noReply: 0, hoursBooked: 0 },
      openDisputes: [],
      hazards: [],
      tasks: [],
      awaitingReply: [],
    });
    expect(markdown).not.toContain('NaN');
    expect(markdown).not.toContain('undefined');
  });
});

describe('reportFilename', () => {
  it('includes a slug of the site and the date', () => {
    expect(reportFilename('Quarry Ridge', '2026-09-28')).toBe(
      'buildora-shift-report-quarry-ridge-2026-09-28.md',
    );
  });

  it('stays filesystem-safe for a name with punctuation or non-latin characters', () => {
    const name = reportFilename('Site #4 — Block B/2', '2026-09-28');
    expect(name).toMatch(/^buildora-shift-report-[a-z0-9-]*-2026-09-28\.md$/);
  });

  it('still produces a usable name when the slug is empty', () => {
    expect(reportFilename('***', '2026-09-28')).toBe('buildora-shift-report-2026-09-28.md');
  });
});
