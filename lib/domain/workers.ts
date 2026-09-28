import 'server-only';
import { randomInt } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

import {
  CreateWorkerRequestSchema,
  PageSchema,
  TeamSchema,
  UpdateWorkerRequestSchema,
  WorkerSchema,
  type CreateWorkerRequest,
  type Role,
  type Team,
  type UpdateWorkerRequest,
  type Worker,
} from '@/contracts';

import { recordEvent } from '@/lib/domain/events';
import { toWorker, type WorkerRow } from '@/lib/domain/mappers';
import { buildPage, keysetAfter, decodeCursor, PageSize } from '@/lib/domain/pagination';
import { ApiError, fromPostgrest } from '@/lib/domain/errors';

const WORKER_SELECT = `
  id, full_name, phone_e164, worker_code, team_id, lang, consent, active,
  teams ( name )
`;

/**
 * A worker code is a unique 4-digit number per site, used to disambiguate
 * several workers who share one phone. Drawing it from a CSPRNG and retrying on
 * the unique index is simpler and more collision-resistant than `max(code)+1`,
 * which leaks the roster size and races under concurrent inserts.
 */
function drawWorkerCode(): string {
  return String(randomInt(1000, 10000));
}

export async function listTeams(db: SupabaseClient): Promise<Team[]> {
  // RLS restricts this to the caller's own site, so no site filter is needed --
  // and adding one from the client would be the wrong place to enforce tenancy.
  const { data, error } = await db.from('teams').select('id, name').order('name');
  if (error) throw fromPostgrest(error);
  return (data ?? []).map((row) => TeamSchema.parse({ id: row.id, name: row.name }));
}

export async function listWorkers(
  db: SupabaseClient,
  role: Role,
  filters: { teamId?: string; active?: boolean; cursor?: string | null },
): Promise<{ items: Worker[]; nextCursor: string | null }> {
  let query = db
    .from('workers')
    .select(WORKER_SELECT)
    .order('full_name', { ascending: true })
    .order('id', { ascending: true })
    .limit(PageSize + 1);

  if (filters.teamId) query = query.eq('team_id', filters.teamId);
  if (filters.active !== undefined) query = query.eq('active', filters.active);

  // A cursor we did not issue is ignored rather than trusted: it can only make
  // the query start from the beginning, never reach further into another site.
  const cursor = decodeCursor(filters.cursor);
  if (cursor) query = query.or(keysetAfter('full_name', 'id', cursor));

  const { data, error } = await query;
  if (error) throw fromPostgrest(error);

  const rows = (data ?? []) as unknown as WorkerRow[];
  const page = buildPage(rows, PageSize, (row) => row.full_name);
  return { items: page.items.map((row) => toWorker(row, role)), nextCursor: page.nextCursor };
}

export async function getWorker(db: SupabaseClient, role: Role, id: string): Promise<Worker> {
  const { data, error } = await db.from('workers').select(WORKER_SELECT).eq('id', id).maybeSingle();
  // RLS makes another site's row invisible, so "not found" and "not yours" are
  // the same answer -- which is what stops an id being used to probe for
  // existence.
  if (error) throw fromPostgrest(error);
  if (!data) throw ApiError.notFound();
  return toWorker(data as unknown as WorkerRow, role);
}

export async function createWorker(
  reader: SupabaseClient,
  writer: SupabaseClient,
  siteId: string,
  staffId: string,
  input: CreateWorkerRequest,
): Promise<Worker> {
  const body = CreateWorkerRequestSchema.parse(input);

  // The team must belong to the caller's site. RLS hides foreign teams, so this
  // is an existence check that doubles as a tenancy check.
  const { data: team } = await reader
    .from('teams')
    .select('id')
    .eq('id', body.teamId)
    .maybeSingle();
  if (!team) throw ApiError.validation({ teamId: 'Unknown team.' });

  // Up to 10 attempts covers a full 9000-code space with negligible failure
  // odds; beyond that the site's codes are exhausted and the error is honest.
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const { data, error } = await writer
      .from('workers')
      .insert({
        site_id: siteId,
        team_id: body.teamId,
        full_name: body.fullName,
        phone_e164: body.phone,
        worker_code: drawWorkerCode(),
        lang: body.lang,
        // A new worker has not yet been contacted, so consent is pending until
        // they reply. Never 'given' by default.
        consent: 'pending',
        active: true,
      })
      .select(WORKER_SELECT)
      .single();

    if (!error && data) {
      const worker = toWorker(data as unknown as WorkerRow, 'supervisor');
      await recordEvent(writer, {
        siteId,
        entityType: 'worker',
        entityId: worker.id,
        kind: 'worker.created',
        actorType: 'staff',
        actorId: staffId,
        // No phone number: this table is site-readable and not redacted.
        payload: { fullName: worker.fullName, teamId: worker.teamId },
      });
      return worker;
    }

    // 23505 is the partial unique index on (site_id, worker_code): the code
    // collided, so redraw. Anything else is a real failure.
    if (error?.code !== '23505') throw fromPostgrest(error);
  }

  throw new ApiError('INTERNAL', 'Could not allocate a unique worker code.');
}

export async function updateWorker(
  reader: SupabaseClient,
  writer: SupabaseClient,
  siteId: string,
  staffId: string,
  id: string,
  input: UpdateWorkerRequest,
): Promise<Worker> {
  const body = UpdateWorkerRequestSchema.parse(input);

  // Read through the RLS-scoped client first. If the row is not visible, it is
  // either missing or another site's, and both must be indistinguishable.
  const existing = await getWorker(reader, 'supervisor', id);

  if (body.teamId !== undefined) {
    const { data: team } = await reader
      .from('teams')
      .select('id')
      .eq('id', body.teamId)
      .maybeSingle();
    if (!team) throw ApiError.validation({ teamId: 'Unknown team.' });
  }

  const patch: Record<string, unknown> = {};
  if (body.fullName !== undefined) patch.full_name = body.fullName;
  if (body.phone !== undefined) patch.phone_e164 = body.phone;
  if (body.teamId !== undefined) patch.team_id = body.teamId;
  if (body.lang !== undefined) patch.lang = body.lang;
  if (body.active !== undefined) patch.active = body.active;

  if (Object.keys(patch).length === 0) return toWorker(await refetch(reader, id), 'supervisor');

  // Writes go through the service role, so the site guard has to be explicit:
  // `id` is a uuid, and without this a caller could name another site's row.
  const { data, error } = await writer
    .from('workers')
    .update(patch)
    .eq('id', id)
    .eq('site_id', siteId)
    .select(WORKER_SELECT)
    .maybeSingle();
  if (error) throw fromPostgrest(error);
  if (!data) throw ApiError.notFound();

  const worker = toWorker(data as unknown as WorkerRow, 'supervisor');
  await recordEvent(writer, {
    siteId,
    entityType: 'worker',
    entityId: id,
    kind: 'worker.updated',
    actorType: 'staff',
    actorId: staffId,
    payload: {
      changed: Object.keys(patch),
      fullName: worker.fullName,
      wasActive: existing.active,
      isActive: worker.active,
    },
  });
  return worker;
}

async function refetch(reader: SupabaseClient, id: string): Promise<WorkerRow> {
  const { data, error } = await reader.from('workers').select(WORKER_SELECT).eq('id', id).single();
  if (error) throw fromPostgrest(error);
  return data as unknown as WorkerRow;
}

export const WorkerPageSchema = PageSchema(WorkerSchema);
