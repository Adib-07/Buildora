import { describe, expect, it } from 'vitest';

import {
  AttendanceRecordSchema,
  DaySummarySchema,
  HazardSchema,
  TimestampSchema,
  WorkerSchema,
  maskedPhone,
} from '@/contracts';
import {
  clockTime,
  isoTimestamp,
  toAttendanceRecord,
  toDispute,
  toHazard,
  toWorker,
} from '@/lib/domain/mappers';

/**
 * Row -> contract DTO.
 *
 * Two things are security-relevant here. The role argument decides what a
 * worker may see, so it is asserted from both directions. And the timestamp
 * normaliser exists because PostgREST's `+00:00` offset does not satisfy the
 * contract's `z.iso.datetime()` -- which, before it was fixed, turned a working
 * attendance screen into a 500.
 */
describe('toWorker', () => {
  const row = {
    id: '0c000001-0000-4000-8000-000000000001',
    full_name: 'Ramesh Kumar',
    phone_e164: '+919876543210',
    worker_code: '4821',
    team_id: '0a000001-0000-4000-8000-000000000001',
    lang: 'en',
    consent: 'given',
    active: true,
    teams: { name: 'Masonry' },
  };

  it('gives a supervisor the full number and the code', () => {
    const worker = toWorker(row, 'supervisor');
    expect(worker.phone).toBe('+919876543210');
    expect(worker.workerCode).toBe('4821');
    expect(WorkerSchema.parse(worker)).toBeTruthy();
  });

  it('masks the number and hides the code from an engineer', () => {
    const worker = toWorker(row, 'engineer');
    expect(worker.phone).toBe(maskedPhone('+919876543210'));
    expect(worker.phone).not.toContain('9876543210');
    // The code disambiguates shared phones, which is a supervisor's concern.
    expect(worker.workerCode).toBeNull();
    expect(JSON.stringify(worker)).not.toContain('4821');
  });

  it('hides the code from an owner too', () => {
    expect(toWorker(row, 'owner').workerCode).toBeNull();
    expect(toWorker(row, 'owner').phone).not.toContain('9876543210');
  });

  it('survives a left join that matched no team', () => {
    // PostgREST can return [] rather than null for an unmatched embed.
    const worker = toWorker({ ...row, teams: [] }, 'supervisor');
    expect(worker.teamName).toBeNull();
    expect(WorkerSchema.parse(worker)).toBeTruthy();
  });
});

describe('isoTimestamp', () => {
  it('normalises the offset PostgREST actually returns', () => {
    // This exact shape is what made every attendance record fail its contract.
    expect(isoTimestamp('2026-09-28T09:18:30.435684+00:00')).toBe(
      '2026-09-28T09:18:30.435Z',
    );
  });

  it('converts a non-UTC offset to UTC rather than truncating it', () => {
    expect(isoTimestamp('2026-09-28T14:48:30+05:30')).toBe('2026-09-28T09:18:30.000Z');
  });

  it('leaves an already-UTC value valid', () => {
    expect(TimestampSchema.safeParse(isoTimestamp('2026-09-28T09:18:30Z')).success).toBe(true);
  });
});

describe('clockTime', () => {
  it('trims the seconds Postgres time carries', () => {
    expect(clockTime('17:30:00')).toBe('17:30');
  });
});

describe('toAttendanceRecord', () => {
  it('produces a contract-valid record from a database row', () => {
    const record = toAttendanceRecord({
      id: '2a000001-0000-4000-8000-000000000009',
      worker_id: '0c000001-0000-4000-8000-000000000001',
      status: 'present',
      late: false,
      hours: 8,
      version: 1,
      worker_state: 'no_reply',
      updated_at: '2026-09-28T09:18:30.435684+00:00',
      workers: { full_name: 'Ramesh Kumar', teams: { name: 'Masonry' } },
    });

    expect(AttendanceRecordSchema.safeParse(record).success).toBe(true);
    expect(record.hours).toBe(8);
    expect(record.updatedAt.endsWith('Z')).toBe(true);
  });

  it('coerces a numeric column that arrives as a string', () => {
    // Postgres `numeric` is not guaranteed to reach the client as a JSON number,
    // and HoursSchema requires a real number.
    const record = toAttendanceRecord({
      id: '2a000001-0000-4000-8000-000000000009',
      worker_id: '0c000001-0000-4000-8000-000000000001',
      status: 'half_day',
      late: false,
      hours: '4.5',
      version: 1,
      worker_state: 'no_reply',
      updated_at: '2026-09-28T09:18:30.435684+00:00',
      workers: { full_name: 'Suresh Patel', teams: null },
    });
    expect(record.hours).toBe(4.5);
    expect(AttendanceRecordSchema.safeParse(record).success).toBe(true);
  });

  it('degrades a missing worker to a placeholder rather than throwing', () => {
    const record = toAttendanceRecord({
      id: '2a000001-0000-4000-8000-000000000009',
      worker_id: '0c000001-0000-4000-8000-000000000001',
      status: 'present',
      late: false,
      hours: 8,
      version: 1,
      worker_state: 'confirmed',
      updated_at: '2026-09-28T09:18:30.435684+00:00',
      workers: null,
    });
    expect(record.workerName).toBe('Unknown worker');
    expect(record.teamName).toBeNull();
  });
});

describe('toHazard', () => {
  const base = {
    id: '5a000001-0000-4000-8000-000000000001',
    code: 'HZ-012',
    category: 'fall_edge',
    location_text: 'Block B floor 3',
    severity: 3,
    summary: 'Open edge without guardrail',
    status: 'assigned',
    due_at: null,
    created_at: '2026-09-26T09:00:00.000000+00:00',
    ai_status: 'ok',
    possible_duplicate_id: null,
    owner_worker_id: null,
    owner_staff_id: null,
    workers: null,
    staff: null,
  };

  it('derives a typed owner from whichever FK is set', () => {
    const workerOwned = toHazard({
      ...base,
      owner_worker_id: '0c000001-0000-4000-8000-000000000001',
      workers: { full_name: 'Ramesh Kumar' },
    });
    expect(workerOwned.owner).toEqual({
      type: 'worker',
      id: '0c000001-0000-4000-8000-000000000001',
      name: 'Ramesh Kumar',
    });
    expect(HazardSchema.safeParse(workerOwned).success).toBe(true);

    const staffOwned = toHazard({
      ...base,
      owner_staff_id: 'a1111111-1111-4111-8111-111111111111',
      staff: { full_name: 'Sita Supervisor' },
    });
    expect(staffOwned.owner?.type).toBe('staff');
  });

  it('reports no owner when neither FK is set', () => {
    expect(toHazard(base).owner).toBeNull();
  });

  it('keeps an untriaged hazard null rather than defaulting to low', () => {
    // Defaulting would make an unjudged hazard look handled.
    expect(toHazard({ ...base, severity: null }).severity).toBeNull();
  });

  it('normalises created_at so the contract is satisfied', () => {
    const hazard = toHazard(base);
    expect(hazard.createdAt.endsWith('Z')).toBe(true);
    expect(HazardSchema.safeParse(hazard).success).toBe(true);
  });

  it('resolves a possible duplicate from the embed', () => {
    const hazard = toHazard({
      ...base,
      possible_duplicate_id: '5a000001-0000-4000-8000-000000000002',
      possible_duplicate: { id: '5a000001-0000-4000-8000-000000000002', code: 'HZ-013' },
    });
    expect(hazard.possibleDuplicate).toEqual({
      id: '5a000001-0000-4000-8000-000000000002',
      code: 'HZ-013',
    });
  });
});

describe('toDispute', () => {
  it('keeps a null resolution note null on an open dispute', () => {
    const dispute = toDispute(
      {
        id: '3a000001-0000-4000-8000-000000000001',
        record_id: '2a000001-0000-4000-8000-000000000005',
        worker_id: '0c000001-0000-4000-8000-000000000001',
        record_version: 1,
        status: 'open',
        reason_text: 'I left at 2pm not 5pm',
        created_at: '2026-09-27T09:00:00.000000+00:00',
        resolved_at: null,
        resolution_note: null,
        workers: { full_name: 'Ramesh Kumar' },
        attendance_records: null,
      },
      { status: 'present', hours: 8, late: false },
    );

    expect(dispute.resolvedAt).toBeNull();
    expect(dispute.resolutionNote).toBeNull();
    expect(dispute.workerName).toBe('Ramesh Kumar');
  });
});

describe('DaySummary bounds', () => {
  it('accepts a zero-total trend point as 0 rather than NaN', () => {
    const result = DaySummarySchema.safeParse({
      date: '2026-09-28',
      locked: false,
      lockedAt: null,
      revision: 1,
      amended: false,
      counts: { total: 0, confirmed: 0, disputed: 0, noReply: 0, disputesOpen: 0, disputesResolved: 0 },
      byTeam: [],
      disputes: [],
      tasks: [],
      hazards: { opened: 0, closed: 0, open: 0, untriaged: 0, items: [] },
      trend: [{ date: '2026-09-27', confirmationRate: 0 }],
      narrative: null,
    });
    expect(result.success).toBe(true);
  });
});
