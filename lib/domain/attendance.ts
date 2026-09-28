import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

import {
  DayAttendanceSchema,
  PatchAttendanceRequestSchema,
  type AttendanceRecord,
  type DateOnly,
  type DayAttendance,
} from '@/contracts';

import { recordEvent } from '@/lib/domain/events';
import { ApiError, fromPostgrest } from '@/lib/domain/errors';
import { toAttendanceRecord, type AttendanceRow } from '@/lib/domain/mappers';

const RECORD_SELECT = `
  id, worker_id, work_day_id, status, late, hours, version, worker_state, updated_at,
  workers ( full_name, teams ( name ) )
`;

/**
 * Resolves a site-local date to its work_day row.
 *
 * The row is what carries the lock, so nothing that can mutate attendance can
 * skip this step: a caller must not be able to edit a locked day by guessing an
 * id instead of a date.
 */
export async function findWorkDay(db: SupabaseClient, siteId: string, date: DateOnly) {
  const { data, error } = await db
    .from('work_days')
    .select('id, work_date, locked_at')
    .eq('site_id', siteId)
    .eq('work_date', date)
    .maybeSingle();
  if (error) throw fromPostgrest(error);
  return data;
}

export async function getDayAttendance(
  db: SupabaseClient,
  siteId: string,
  date: DateOnly,
): Promise<DayAttendance> {
  const workDay = await findWorkDay(db, siteId, date);
  if (!workDay) throw ApiError.notFound();

  const { data, error } = await db
    .from('attendance_records')
    .select(RECORD_SELECT)
    .eq('work_day_id', workDay.id)
    .order('worker_id');
  if (error) throw fromPostgrest(error);

  const records = (data ?? []).map((row) => toAttendanceRecord(row as unknown as AttendanceRow));

  // Counts are derived here from the same rows the caller is shown, never read
  // from a stored snapshot, so a card and its table can never disagree.
  return DayAttendanceSchema.parse({
    date: workDay.work_date,
    locked: workDay.locked_at !== null,
    lockedAt: workDay.locked_at,
    counts: {
      total: records.length,
      confirmed: records.filter((r) => r.workerState === 'confirmed').length,
      disputed: records.filter((r) => r.workerState === 'disputed').length,
      noReply: records.filter((r) => r.workerState === 'no_reply').length,
    },
    records,
  });
}

/**
 * Most recent day that has records, used to land the dashboard on real data
 * rather than an empty today.
 */
export async function latestDayWithRecords(
  db: SupabaseClient,
  siteId: string,
): Promise<DateOnly | null> {
  const { data, error } = await db
    .from('work_days')
    .select('id, work_date')
    .eq('site_id', siteId)
    .order('work_date', { ascending: false })
    .limit(8);
  if (error) throw fromPostgrest(error);

  // `attendance_records` is keyed by `work_day_id`, not by date, so the count
  // has to go through the day rows rather than filtering a date column that
  // does not exist on the records table.
  const days = (data ?? []) as { id: string; work_date: DateOnly }[];
  if (days.length === 0) return null;

  const { data: records, error: countError } = await db
    .from('attendance_records')
    .select('work_day_id')
    .in('work_day_id', days.map((day) => day.id));
  if (countError) throw fromPostgrest(countError);

  const populated = new Set((records ?? []).map((row) => row.work_day_id));

  // `work_days` can legitimately hold a day whose roster has not been filled
  // yet, so confirm there is something to show before choosing it.
  for (const day of days) {
    if (populated.has(day.id)) return day.work_date;
  }
  return null;
}

/**
 * Supervisor edit to one attendance record.
 *
 * The concurrency check is a compare-and-swap in the UPDATE's own WHERE clause
 * rather than a read-then-write. Two supervisors editing the same record on
 * slow connections would both pass a read-then-write check and the second write
 * would silently overwrite the first; with `.eq('version', expectedVersion)` the
 * loser's update matches zero rows, and the zero rows *are* the conflict.
 */
export async function patchAttendance(
  reader: SupabaseClient,
  writer: SupabaseClient,
  siteId: string,
  staffId: string,
  recordId: string,
  input: unknown,
): Promise<AttendanceRecord> {
  const body = PatchAttendanceRequestSchema.parse(input);

  // Read through the RLS-scoped client: an invisible record is either missing or
  // another site's, and both are the same answer.
  const { data: existing, error: readError } = await reader
    .from('attendance_records')
    .select(RECORD_SELECT)
    .eq('id', recordId)
    .maybeSingle();
  if (readError) throw fromPostgrest(readError);
  if (!existing) throw ApiError.notFound();
  const current = toAttendanceRecord(existing as unknown as AttendanceRow);

  // The lock lives on the work day, not the record, so it has to be consulted
  // before the write. A record whose day is locked is read-only, and the
  // contract surfaces that as DAY_LOCKED rather than a generic 422.
  const { data: workDay } = await reader
    .from('work_days')
    .select('id, locked_at')
    .eq('id', (existing as unknown as { work_day_id: string }).work_day_id)
    .maybeSingle();
  if (workDay?.locked_at) {
    throw new ApiError('DAY_LOCKED', 'This day has been locked and can no longer be edited.');
  }

  const next = {
    status: body.status ?? current.status,
    hours: body.hours ?? current.hours,
    late: body.late ?? current.late,
  };

  // A supervisor edit supersedes whatever the worker last replied to, so the
  // record goes back to `no_reply`: the worker is re-notified, and the old
  // confirmation no longer applies to the values on screen.
  const { data: updated, error } = await writer
    .from('attendance_records')
    .update({
      ...next,
      version: current.version + 1,
      worker_state: 'no_reply',
      state_version: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', recordId)
    .eq('site_id', siteId)
    .eq('version', body.expectedVersion)
    .select(RECORD_SELECT)
    .maybeSingle();

  if (error) throw fromPostgrest(error);
  if (!updated) {
    // Either the caller's expectedVersion is stale, or a concurrent edit won.
    // Both are the same client problem: reload and re-apply.
    throw new ApiError(
      'VERSION_CONFLICT',
      'This record was changed by someone else. Reload and try again.',
    );
  }

  const record = toAttendanceRecord(updated as unknown as AttendanceRow);

  // Append-only history. This is what DisputeDetail.history renders and what
  // makes an attendance dispute auditable after the fact.
  await writer.from('attendance_versions').insert({
    record_id: recordId,
    version: record.version,
    status: record.status,
    hours: record.hours,
    late: record.late,
    reason: 'corrected by supervisor',
  });

  await recordEvent(writer, {
    siteId,
    entityType: 'attendance_record',
    entityId: recordId,
    kind: 'attendance.patched',
    actorType: 'staff',
    actorId: staffId,
    // Deliberately no worker name or phone: this table is site-readable and is
    // not passed through the logger's redaction.
    payload: {
      fromVersion: current.version,
      toVersion: record.version,
      from: { status: current.status, hours: current.hours, late: current.late },
      to: { status: record.status, hours: record.hours, late: record.late },
    },
  });

  return record;
}
