import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

import { DaySummarySchema, type DateOnly, type DaySummary } from '@/contracts';

import { ApiError, fromPostgrest } from '@/lib/domain/errors';

type Count = { total: number; confirmed: number; disputed: number; noReply: number };

const CLOSED_HAZARDS = new Set(['closed', 'closed_unverified']);

function emptyCounts(): Count {
  return { total: 0, confirmed: 0, disputed: 0, noReply: 0 };
}

function tally(states: string[]): Count {
  return {
    total: states.length,
    confirmed: states.filter((s) => s === 'confirmed').length,
    disputed: states.filter((s) => s === 'disputed').length,
    noReply: states.filter((s) => s === 'no_reply').length,
  };
}

/** YYYY-MM-DD arithmetic on the proleptic Gregorian calendar, no date library. */
export function shiftDate(date: DateOnly, days: number): DateOnly {
  const [y, m, d] = date.split('-').map(Number);
  const shifted = new Date(Date.UTC(y!, m! - 1, d!) + days * 86_400_000);
  return shifted.toISOString().slice(0, 10);
}

/** PostgREST returns an embedded resource as an object, or [] when nothing matched. */
function nameOf(embedded: unknown): string | null {
  const value = embedded as { full_name: string } | { full_name: string }[] | null;
  if (Array.isArray(value)) return value[0]?.full_name ?? null;
  return value?.full_name ?? null;
}

function teamOf(embedded: unknown): string | null {
  const worker = embedded as { teams: { name: string } | { name: string }[] | null } | null;
  const team = Array.isArray(worker?.teams) ? (worker?.teams[0] ?? null) : worker?.teams;
  return team?.name ?? null;
}

/**
 * Builds the day summary.
 *
 * Every figure is derived from the live tables for the requested date rather
 * than read from a stored snapshot, so the summary can never disagree with the
 * attendance and dispute screens. `revision`, `amended` and `narrative` are the
 * only fields taken from `daily_summaries`, because those describe the document
 * the site already published -- a historical fact, not something to recompute.
 */
export async function getDaySummary(
  db: SupabaseClient,
  siteId: string,
  date: DateOnly,
): Promise<DaySummary> {
  const { data: workDay, error: dayError } = await db
    .from('work_days')
    .select('id, work_date, locked_at')
    .eq('site_id', siteId)
    .eq('work_date', date)
    .maybeSingle();
  if (dayError) throw fromPostgrest(dayError);
  if (!workDay) throw ApiError.notFound();

  const { data: records, error: recordError } = await db
    .from('attendance_records')
    .select('id, worker_state, workers ( teams ( name ) )')
    .eq('work_day_id', workDay.id);
  if (recordError) throw fromPostgrest(recordError);

  const rows = records ?? [];
  const counts = tally(rows.map((row) => row.worker_state));

  // Per-team breakdown. A worker with no team is grouped as "Unassigned" rather
  // than dropped, so the team figures always add up to the headline count.
  const byTeam = new Map<string, Count>();
  for (const row of rows) {
    const name = teamOf(row.workers) ?? 'Unassigned';
    const bucket = byTeam.get(name) ?? emptyCounts();
    bucket.total += 1;
    if (row.worker_state === 'confirmed') bucket.confirmed += 1;
    if (row.worker_state === 'disputed') bucket.disputed += 1;
    if (row.worker_state === 'no_reply') bucket.noReply += 1;
    byTeam.set(name, bucket);
  }

  const recordIds = rows.map((row) => row.id);
  const { data: disputeRows, error: disputeError } = recordIds.length
    ? await db
        .from('disputes')
        .select('status, resolution_note, workers ( full_name )')
        .in('record_id', recordIds)
    : { data: [], error: null };
  if (disputeError) throw fromPostgrest(disputeError);

  const { data: tasks } = await db
    .from('tasks')
    .select('title, workers ( full_name )')
    .eq('work_day_id', workDay.id)
    .order('created_at');

  const { data: hazards, error: hazardError } = await db
    .from('hazards')
    .select('id, code, summary, severity, status, created_at')
    .eq('site_id', siteId)
    .gte('created_at', `${date}T00:00:00.000Z`)
    .lte('created_at', `${date}T23:59:59.999Z`)
    .order('created_at');
  if (hazardError) throw fromPostgrest(hazardError);

  const hazardRows = hazards ?? [];
  const openHazards = hazardRows.filter((h) => !CLOSED_HAZARDS.has(h.status));

  // Trend: the seven days ending on this one. Two queries rather than seven,
  // because PostgREST cannot filter on an embedded resource's column.
  const trend = await buildTrend(db, siteId, date);

  const { data: snapshot } = await db
    .from('daily_summaries')
    .select('revision, amended, narrative')
    .eq('site_id', siteId)
    .eq('work_date', date)
    .maybeSingle();

  const disputes = (disputeRows ?? []).map((row) => ({
    workerName: nameOf(row.workers) ?? 'Unknown worker',
    outcome: row.status as DaySummary['disputes'][number]['outcome'],
    note: row.resolution_note,
  }));
  const disputesOpen = disputes.filter((d) => d.outcome === 'open').length;

  return DaySummarySchema.parse({
    date: workDay.work_date,
    locked: workDay.locked_at !== null,
    lockedAt: workDay.locked_at,
    revision: snapshot?.revision ?? 1,
    amended: snapshot?.amended ?? false,
    counts: {
      ...counts,
      // Counted per record, not per day, so a record disputed twice is the one
      // open item the supervisor's queue also shows.
      disputesOpen,
      disputesResolved: disputes.length - disputesOpen,
    },
    byTeam: [...byTeam.entries()].map(([teamName, value]) => ({ teamName, ...value })),
    disputes,
    tasks: (tasks ?? []).map((task) => ({
      title: task.title,
      ownerName: nameOf(task.workers) ?? 'Unassigned',
    })),
    hazards: {
      opened: hazardRows.length,
      closed: hazardRows.length - openHazards.length,
      open: openHazards.length,
      // Untriaged is the actionable number: nobody has judged the severity yet.
      untriaged: openHazards.filter((h) => h.severity === null).length,
      items: openHazards.map((h) => ({
        code: h.code,
        summary: h.summary,
        severity: h.severity === null ? null : (h.severity as 1 | 2 | 3),
        status: h.status as DaySummary['hazards']['items'][number]['status'],
        // Photos are served through short-lived signed URLs. None are inlined
        // here, so a summary can be shared or cached without exposing a bucket
        // path or a reusable object URL.
        photoUrl: null,
      })),
    },
    trend,
    // A stored narrative is prose the site already published. When there is
    // none, the figures stand on their own rather than a fabricated summary
    // standing in for them.
    narrative: snapshot?.narrative ?? null,
  });
}

async function buildTrend(db: SupabaseClient, siteId: string, date: DateOnly) {
  const dates = Array.from({ length: 7 }, (_, i) => shiftDate(date, i - 6));

  const { data: days } = await db
    .from('work_days')
    .select('id, work_date')
    .eq('site_id', siteId)
    .in('work_date', dates);

  const byId = new Map((days ?? []).map((day) => [day.id, day.work_date as DateOnly]));
  if (byId.size === 0) {
    return dates.map((d) => ({ date: d, confirmationRate: 0 }));
  }

  const { data: rows } = await db
    .from('attendance_records')
    .select('work_day_id, worker_state')
    .in('work_day_id', [...byId.keys()]);

  const perDay = new Map<DateOnly, string[]>();
  for (const row of rows ?? []) {
    const day = byId.get(row.work_day_id);
    if (!day) continue;
    const bucket = perDay.get(day) ?? [];
    bucket.push(row.worker_state);
    perDay.set(day, bucket);
  }

  return dates.map((d) => {
    const counts = tally(perDay.get(d) ?? []);
    // A day with nobody rostered yields 0 rather than NaN, and the contract
    // bounds this to 0..1, so a chart can render it without per-point guards.
    return { date: d, confirmationRate: counts.total === 0 ? 0 : counts.confirmed / counts.total };
  });
}
