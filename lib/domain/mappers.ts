import 'server-only';

import type {
  AttendanceRecord,
  Dispute,
  Hazard,
  Role,
  Task,
  Worker,
} from '@/contracts';
import { maskedPhone } from '@/contracts';

/**
 * Database row -> contract DTO.
 *
 * This is the only place a row becomes something the browser sees, so it is
 * also where redaction happens. Role is taken from the *session* (resolved from
 * `public.staff`), never from a request body, and a role that is not in the
 * closed `RoleSchema` union is treated as the least privileged one rather than
 * trusted.
 */

// ---------------------------------------------------------------------------
// serialization
// ---------------------------------------------------------------------------

/**
 * Normalises a Postgres `timestamptz` to the contract's timestamp format.
 *
 * PostgREST returns `2026-09-28T09:18:30.435684+00:00` -- an offset, and with
 * microsecond precision. `TimestampSchema` is `z.iso.datetime()`, which requires
 * a literal `Z`, so an unnormalised value fails the response contract and
 * surfaces to the user as an opaque 500 on an otherwise working screen.
 *
 * `Date` parses the offset correctly and re-emits UTC, so this is a
 * normalisation rather than a truncation: no information is lost.
 */
export function isoTimestamp(value: string): string {
  return new Date(value).toISOString();
}

/** postgres `time` arrives as HH:MM:SS; the contract's ClockSchema wants HH:mm. */
export function clockTime(value: string): string {
  return value.slice(0, 5);
}

// ---------------------------------------------------------------------------
// workers
// ---------------------------------------------------------------------------

export type WorkerRow = {
  id: string;
  full_name: string;
  phone_e164: string;
  worker_code: string | null;
  team_id: string | null;
  lang: string;
  consent: string;
  active: boolean;
  teams: { name: string } | { name: string }[] | null;
};

/**
 * PostgREST returns an embedded many-to-one as an object, but a left join that
 * matched nothing can come back as an empty array. Normalise both so callers
 * never have to care.
 */
function one<T>(value: T | T[] | null): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export function toWorker(row: WorkerRow, role: Role): Worker {
  const team = one(row.teams);
  return {
    id: row.id,
    fullName: row.full_name,
    // Supervisors dial workers; engineers and owners only need to recognise
    // them. The last four digits are kept so the two are still distinguishable.
    phone: role === 'supervisor' ? row.phone_e164 : maskedPhone(row.phone_e164),
    // The code is a shared-phone disambiguator. Only the supervisor resolves
    // inbound replies with it, so only they are shown it.
    workerCode: role === 'supervisor' ? row.worker_code : null,
    teamId: row.team_id,
    teamName: team?.name ?? null,
    lang: row.lang as Worker['lang'],
    consent: row.consent as Worker['consent'],
    active: row.active,
  };
}

// ---------------------------------------------------------------------------
// attendance
// ---------------------------------------------------------------------------

export type AttendanceRow = {
  id: string;
  worker_id: string;
  status: string;
  late: boolean;
  hours: number | string;
  version: number;
  worker_state: string;
  updated_at: string;
  workers: { full_name: string; teams: { name: string } | { name: string }[] | null } | null;
};

export function toAttendanceRecord(row: AttendanceRow): AttendanceRecord {
  const worker = one(row.workers);
  return {
    id: row.id,
    workerId: row.worker_id,
    workerName: worker?.full_name ?? 'Unknown worker',
    teamName: one(worker?.teams)?.name ?? null,
    status: row.status as AttendanceRecord['status'],
    late: row.late,
    // Postgres `numeric` arrives as a JSON number, but coerce defensively:
    // HoursSchema requires a real number, and a string would fail the response
    // contract and surface to the user as an opaque 500.
    hours: Number(row.hours),
    version: row.version,
    workerState: row.worker_state as AttendanceRecord['workerState'],
    updatedAt: isoTimestamp(row.updated_at),
  };
}

// ---------------------------------------------------------------------------
// tasks
// ---------------------------------------------------------------------------

export type TaskRow = {
  id: string;
  title: string;
  location: string | null;
  owner_worker_id: string;
  source: string;
  created_at: string;
  workers: { full_name: string } | { full_name: string }[] | null;
};

export function toTask(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    location: row.location,
    ownerWorkerId: row.owner_worker_id,
    ownerName: one(row.workers)?.full_name ?? 'Unassigned',
    source: row.source as Task['source'],
    createdAt: isoTimestamp(row.created_at),
  };
}

// ---------------------------------------------------------------------------
// disputes
// ---------------------------------------------------------------------------

export type DisputeRow = {
  id: string;
  record_id: string;
  worker_id: string;
  record_version: number;
  status: string;
  reason_text: string | null;
  created_at: string;
  resolved_at: string | null;
  resolution_note: string | null;
  workers: { full_name: string } | { full_name: string }[] | null;
  attendance_records: {
    id: string;
    status: string;
    hours: number | string;
    late: boolean;
    version: number;
  } | null;
};

type Snapshot = Dispute['record'];

export function toDispute(row: DisputeRow, snapshot: Snapshot): Dispute {
  return {
    id: row.id,
    recordId: row.record_id,
    workerId: row.worker_id,
    workerName: one(row.workers)?.full_name ?? 'Unknown worker',
    recordVersion: row.record_version,
    status: row.status as Dispute['status'],
    reasonText: row.reason_text,
    createdAt: isoTimestamp(row.created_at),
    resolvedAt: row.resolved_at ? isoTimestamp(row.resolved_at) : null,
    resolutionNote: row.resolution_note,
    record: snapshot,
  };
}

// ---------------------------------------------------------------------------
// hazards
// ---------------------------------------------------------------------------

export type HazardOwnerRow = {
  owner_worker_id: string | null;
  owner_staff_id: string | null;
  workers: { full_name: string } | { full_name: string }[] | null;
  staff: { full_name: string } | { full_name: string }[] | null;
};

/**
 * `hazards.owner_*` is two nullable FKs plus a CHECK enforcing at most one,
 * because the contract's `worker | staff` union cannot carry a foreign key.
 * The discriminated `{ type, id, name }` the contract wants is derived here.
 */
export function toHazardOwner(row: HazardOwnerRow): Hazard['owner'] {
  if (row.owner_worker_id) {
    const worker = one(row.workers);
    return { type: 'worker', id: row.owner_worker_id, name: worker?.full_name ?? 'Unknown worker' };
  }
  if (row.owner_staff_id) {
    const staff = one(row.staff);
    return { type: 'staff', id: row.owner_staff_id, name: staff?.full_name ?? 'Unknown staff' };
  }
  return null;
}

export type HazardRow = HazardOwnerRow & {
  id: string;
  code: string;
  category: string;
  location_text: string | null;
  severity: number | null;
  summary: string;
  status: string;
  due_at: string | null;
  created_at: string;
  ai_status: string | null;
  possible_duplicate_id: string | null;
  reporter_count?: number | null;
  possible_duplicate?: { id: string; code: string } | { id: string; code: string }[] | null;
};

export function toHazard(row: HazardRow): Hazard {
  const duplicate = one(row.possible_duplicate);
  return {
    id: row.id,
    code: row.code,
    category: row.category as Hazard['category'],
    locationText: row.location_text,
    severity: row.severity === null ? null : (row.severity as Hazard['severity']),
    summary: row.summary,
    status: row.status as Hazard['status'],
    owner: toHazardOwner(row),
    dueAt: row.due_at ? isoTimestamp(row.due_at) : null,
    // `hazard_reports(count)` returns an array of `{ count: n }` objects.
    reporterCount: row.reporter_count ?? 1,
    createdAt: isoTimestamp(row.created_at),
    aiStatus: row.ai_status as Hazard['aiStatus'],
    possibleDuplicate: duplicate ? { id: duplicate.id, code: duplicate.code } : null,
  };
}
