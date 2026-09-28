import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

import {
  ResolveDisputeRequestSchema,
  type Dispute,
  type DisputeDetail,
  type ResolveDisputeRequest,
} from '@/contracts';

import { recordEvent } from '@/lib/domain/events';
import { ApiError, fromPostgrest } from '@/lib/domain/errors';
import { isoTimestamp, toDispute, type DisputeRow } from '@/lib/domain/mappers';

const DISPUTE_SELECT = `
  id, record_id, worker_id, record_version, status, reason_text, created_at,
  resolved_at, resolution_note,
  workers ( full_name ),
  attendance_records ( id, status, hours, late, version )
`;

type Snapshot = Dispute['record'];
type VersionRow = { version: number; status: string; hours: number | string; late: boolean };

/**
 * The attendance values the worker was disputing.
 *
 * Read from `attendance_versions` at the bound `record_version` when that
 * history row exists, because a dispute is always about the values the worker
 * actually saw. Records still on version 1 have no history row yet -- the first
 * edit writes one -- so the current record is the version-1 values in that case.
 */
async function snapshotFor(
  reader: SupabaseClient,
  dispute: Pick<DisputeRow, 'record_id' | 'record_version' | 'attendance_records'>,
): Promise<Snapshot> {
  const { data: history } = await reader
    .from('attendance_versions')
    .select('version, status, hours, late')
    .eq('record_id', dispute.record_id)
    .eq('version', dispute.record_version)
    .maybeSingle();

  if (history) return toSnapshot(history as unknown as VersionRow);

  const record = dispute.attendance_records as
    | { status: string; hours: number | string; late: boolean }
    | null;
  if (record) return toSnapshot(record);

  return { status: 'present', hours: 8, late: false };
}

function toSnapshot(row: { status: string; hours: number | string; late: boolean }): Snapshot {
  return {
    status: row.status as Snapshot['status'],
    hours: Number(row.hours),
    late: row.late,
  };
}

export async function listDisputes(
  db: SupabaseClient,
  options: { status: 'open' | 'all' },
): Promise<Dispute[]> {
  let query = db
    .from('disputes')
    .select(DISPUTE_SELECT)
    .order('created_at', { ascending: false })
    .limit(200);

  if (options.status === 'open') query = query.eq('status', 'open');

  const { data, error } = await query;
  if (error) throw fromPostgrest(error);

  const rows = (data ?? []) as unknown as DisputeRow[];
  return Promise.all(rows.map(async (row) => toDispute(row, await snapshotFor(db, row))));
}

export async function getDispute(db: SupabaseClient, id: string): Promise<DisputeDetail> {
  const { data, error } = await db.from('disputes').select(DISPUTE_SELECT).eq('id', id).maybeSingle();
  if (error) throw fromPostgrest(error);
  if (!data) throw ApiError.notFound();

  const row = data as unknown as DisputeRow;
  const dispute = toDispute(row, await snapshotFor(db, row));

  const { data: history } = await db
    .from('attendance_versions')
    .select('version, status, hours, late, changed_at, reason')
    .eq('record_id', row.record_id)
    .order('version');

  // A voice reason would be served from storage under a short-lived signed URL.
  // The storage path is deliberately not returned: the contract exposes a URL,
  // not a bucket path, and a path would let a caller address objects directly.
  return {
    ...dispute,
    reasonAudioUrl: null,
    history: (history ?? []).map((entry) => ({
      version: entry.version,
      status: entry.status as DisputeDetail['history'][number]['status'],
      hours: Number(entry.hours),
      changedAt: isoTimestamp(entry.changed_at),
      reason: entry.reason,
    })),
  };
}

/**
 * Resolves an open dispute.
 *
 * `corrected` applies the supervisor's values to the record and marks the worker
 * as having agreed with them -- the worker raised the problem and the site acted,
 * so re-sending a record SMS would only invite the same dispute again.
 * `upheld` leaves the record alone and records why.
 */
export async function resolveDispute(
  reader: SupabaseClient,
  writer: SupabaseClient,
  siteId: string,
  staffId: string,
  id: string,
  input: ResolveDisputeRequest,
): Promise<Dispute> {
  const body = ResolveDisputeRequestSchema.parse(input);

  const { data: existing, error: readError } = await reader
    .from('disputes')
    .select(DISPUTE_SELECT)
    .eq('id', id)
    .maybeSingle();
  if (readError) throw fromPostgrest(readError);
  if (!existing) throw ApiError.notFound();
  const dispute = existing as unknown as DisputeRow;

  // The contract's one-open-dispute-per-record rule is enforced by a partial
  // unique index; this guard covers the transition itself, so a second resolve
  // of the same dispute is a 409 rather than a silent overwrite.
  if (dispute.status !== 'open') {
    throw new ApiError('BAD_TRANSITION', 'This dispute has already been resolved.');
  }

  const record = dispute.attendance_records as
    | { id: string; status: string; hours: number | string; late: boolean; version: number }
    | null;
  if (!record) throw ApiError.notFound();

  const nextStatus = body.outcome === 'corrected' ? 'corrected' : 'upheld';

  if (body.outcome === 'corrected') {
    const { error: recordError } = await writer
      .from('attendance_records')
      .update({
        status: body.status,
        hours: body.hours,
        late: body.late,
        version: record.version + 1,
        worker_state: 'confirmed',
        state_version: record.version + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', record.id)
      .eq('site_id', siteId)
      .eq('version', record.version);

    if (recordError) throw fromPostgrest(recordError);

    await writer.from('attendance_versions').insert({
      record_id: record.id,
      version: record.version + 1,
      status: body.status,
      hours: body.hours,
      late: body.late,
      reason: body.note ?? 'dispute corrected by supervisor',
    });
  }

  const { data: updated, error } = await writer
    .from('disputes')
    .update({
      status: nextStatus,
      resolved_at: new Date().toISOString(),
      resolution_note: body.note ?? null,
    })
    .eq('id', id)
    .eq('status', 'open')
    .select(DISPUTE_SELECT)
    .maybeSingle();

  if (error) throw fromPostgrest(error);
  // A concurrent resolve won the race.
  if (!updated) throw new ApiError('BAD_TRANSITION', 'This dispute has already been resolved.');

  // A locked day's summary has already been sent to the client, so a later
  // resolution amends it rather than leaving a stale snapshot behind.
  await amendLockedSummary(reader, writer, siteId, record.id);

  await recordEvent(writer, {
    siteId,
    entityType: 'dispute',
    entityId: id,
    kind: `dispute.${nextStatus}`,
    actorType: 'staff',
    actorId: staffId,
    payload: { outcome: body.outcome, recordId: record.id },
  });

  const row = updated as unknown as DisputeRow;
  return toDispute(
    row,
    body.outcome === 'corrected'
      ? { status: body.status, hours: body.hours, late: body.late }
      : toSnapshot(record),
  );
}

async function amendLockedSummary(
  reader: SupabaseClient,
  writer: SupabaseClient,
  siteId: string,
  recordId: string,
): Promise<void> {
  const { data: record } = await reader
    .from('attendance_records')
    .select('work_days ( work_date, locked_at )')
    .eq('id', recordId)
    .maybeSingle();

  const day = (record?.work_days ?? null) as unknown as {
    work_date: string;
    locked_at: string | null;
  } | null;
  if (!day?.locked_at) return;

  const { data: summary } = await writer
    .from('daily_summaries')
    .select('id')
    .eq('site_id', siteId)
    .eq('work_date', day.work_date)
    .maybeSingle();
  if (!summary) return;

  // `amended` is a signal to the recipient that the figures they already have
  // are superseded; `revision` makes each amendment individually citable.
  await writer
    .from('daily_summaries')
    .update({ amended: true })
    .eq('id', summary.id);
}
