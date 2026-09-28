import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

import {
  ApproveTasksRequestSchema,
  TaskDraftResponseSchema,
  type ApproveTasksRequest,
  type DateOnly,
  type Task,
  type TaskDraft,
  type TaskDraftResponse,
  type Worker,
} from '@/contracts';

import { recordEvent } from '@/lib/domain/events';
import { ApiError, fromPostgrest } from '@/lib/domain/errors';
import { toTask, type TaskRow } from '@/lib/domain/mappers';

const TASK_SELECT = `id, title, location, owner_worker_id, source, created_at, workers ( full_name )`;

/** Reads the roster the draft matcher needs: id, name, team, active flag. */
export type RosterEntry = Pick<Worker, 'id' | 'fullName' | 'teamId' | 'active'>;

export async function listDayTasks(
  db: SupabaseClient,
  siteId: string,
  date: DateOnly,
): Promise<Task[]> {
  const { data: workDay, error: dayError } = await db
    .from('work_days')
    .select('id')
    .eq('site_id', siteId)
    .eq('work_date', date)
    .maybeSingle();
  if (dayError) throw fromPostgrest(dayError);
  if (!workDay) throw ApiError.notFound();

  const { data, error } = await db
    .from('tasks')
    .select(TASK_SELECT)
    .eq('work_day_id', workDay.id)
    .order('created_at');
  if (error) throw fromPostgrest(error);
  return (data ?? []).map((row) => toTask(row as unknown as TaskRow));
}

/**
 * Resolves or creates the work day for a date.
 *
 * Approving tasks for a day that has no work_day yet is legitimate -- the
 * supervisor is planning a shift, not editing an existing one. RLS is enabled
 * with a site-scoped policy, and a duplicate is absorbed rather than surfaced
 * as an error, because the unique index on (site_id, work_date) means losing
 * that race means someone else just created the very row we wanted.
 */
async function ensureWorkDay(writer: SupabaseClient, siteId: string, date: DateOnly) {
  const { data, error } = await writer
    .from('work_days')
    .insert({ site_id: siteId, work_date: date })
    .select('id, locked_at')
    .single();

  if (!error && data) return data;
  if (error?.code !== '23505') throw fromPostgrest(error);

  const { data: existing, error: readError } = await writer
    .from('work_days')
    .select('id, locked_at')
    .eq('site_id', siteId)
    .eq('work_date', date)
    .single();
  if (readError) throw fromPostgrest(readError);
  return existing;
}

// ---------------------------------------------------------------------------
// Drafting
// ---------------------------------------------------------------------------

/** Sentence-ish split that survives the punctuation supervisors actually type. */
function splitStatements(text: string): string[] {
  return text
    .split(/[\n;]+|(?<=[.!?])\s+/)
    .map((line) => line.replace(/^[\s\-*\d.)\]]+/, '').trim())
    .filter((line) => line.length > 0);
}

/** Drops a leading lead-in ("ask ramesh to", "ramesh:") to leave the work itself. */
function toTitle(statement: string): string {
  const cleaned = statement
    // Trailing punctuation is the split artefact, not part of the task, and it
    // would be written straight into the task list.
    .replace(/[.!?;,]+$/, '')
    .replace(/^(please\s+)?(ask|tell|instruct|tell him|tell her)\s+/i, '')
    .replace(/^[A-Za-z][A-Za-z\s]{1,30}?\s+(to|will|should|must|needs? to)\s+/i, '')
    .trim();
  const capped = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  return capped.length > 120 ? capped.slice(0, 117).trimEnd() + '...' : capped;
}

/**
 * Finds workers named in a line of text.
 *
 * Matching is on the full name or on any single name token, case-insensitively,
 * so both "Ramesh Kumar" and "Ramesh" resolve. A match is a *candidate*, not a
 * decision: the contract requires the supervisor to confirm the owner before
 * approval, and two people called Ramesh must not be resolved by coin-flip.
 */
function matchOwners(statement: string, roster: RosterEntry[]) {
  const haystack = statement.toLowerCase();
  const candidates: { workerId: string; name: string }[] = [];
  let spokenName: string | null = null;

  for (const worker of roster) {
    const parts = worker.fullName.toLowerCase().split(/\s+/).filter((p) => p.length > 2);
    const full = worker.fullName.toLowerCase();
    const hit = haystack.includes(full) || parts.some((part) => haystack.includes(part));
    if (hit) {
      candidates.push({ workerId: worker.id, name: worker.fullName });
      if (spokenName === null) spokenName = worker.fullName;
    }
  }
  return { candidates, spokenName };
}

/**
 * Builds task drafts from free text.
 *
 * This is the deterministic fallback the contract specifies for when AI is
 * unavailable or `AI_DISABLED=true`. It is real parsing over the real roster,
 * not a stub: `AI_DISABLED` decides whether a model produces these drafts or
 * this code does, and either way the supervisor reviews and approves them, so
 * the output is never trusted blindly. `fallback: true` is reported honestly
 * so the UI can say which produced it.
 */
export function draftTasksFromText(text: string, roster: RosterEntry[]): TaskDraftResponse {
  const active = roster.filter((worker) => worker.active);
  const statements = splitStatements(text);

  const drafts: TaskDraft[] = statements.map((statement) => {
    const { candidates, spokenName } = matchOwners(statement, active);
    return {
      title: toTitle(statement),
      location: null,
      spokenOwnerName: spokenName,
      // Only an unambiguous single match is auto-assigned. Everything else is
      // left for the supervisor, which is the whole point of the review step.
      ownerWorkerId: candidates.length === 1 ? candidates[0]!.workerId : null,
      ownerCandidates: candidates,
    };
  });

  return TaskDraftResponseSchema.parse({
    drafts,
    transcript: null,
    // Anything the splitter could not turn into a work item is surfaced rather
    // than dropped, so the supervisor sees what was not understood.
    unparsedText: statements.length === 0 ? text.trim() || null : null,
    fallback: true,
  });
}

// ---------------------------------------------------------------------------
// Approval
// ---------------------------------------------------------------------------

/**
 * Persists approved tasks.
 *
 * `ownerWorkerId` is required by the contract and NOT NULL in the database, so
 * a task with an unresolved owner cannot be created -- the supervisor has to
 * pick one. Every owner id is checked against the caller's site through the
 * RLS-scoped reader, so a task cannot be assigned to another site's worker.
 */
export async function approveTasks(
  reader: SupabaseClient,
  writer: SupabaseClient,
  siteId: string,
  staffId: string,
  input: ApproveTasksRequest,
): Promise<Task[]> {
  const body = ApproveTasksRequestSchema.parse(input);

  const workDay = await ensureWorkDay(writer, siteId, body.workDate);
  if (workDay?.locked_at) {
    throw new ApiError('DAY_LOCKED', 'This day has been locked and can no longer be changed.');
  }

  const { data: owners, error: ownerError } = await reader
    .from('workers')
    .select('id')
    .eq('site_id', siteId)
    .in('id', body.tasks.map((task) => task.ownerWorkerId));
  if (ownerError) throw fromPostgrest(ownerError);

  const known = new Set((owners ?? []).map((row) => row.id));
  const unknown = body.tasks.filter((task) => !known.has(task.ownerWorkerId));
  if (unknown.length > 0) {
    throw ApiError.validation(
      { tasks: 'One or more owners are not on this site\'s roster.' },
      'Could not assign every task.',
    );
  }

  const { data, error } = await writer
    .from('tasks')
    .insert(
      body.tasks.map((task) => ({
        site_id: siteId,
        work_day_id: workDay!.id,
        title: task.title,
        location: task.location,
        owner_worker_id: task.ownerWorkerId,
        // Approved from a supervisor-typed or AI-drafted note, both of which
        // arrive as text at this point.
        source: 'text',
      })),
    )
    .select(TASK_SELECT);

  if (error) throw fromPostgrest(error);
  const tasks = (data ?? []).map((row) => toTask(row as unknown as TaskRow));

  await recordEvent(writer, {
    siteId,
    entityType: 'work_day',
    entityId: workDay!.id,
    kind: 'tasks.approved',
    actorType: 'staff',
    actorId: staffId,
    payload: { workDate: body.workDate, count: tasks.length },
  });

  return tasks;
}
