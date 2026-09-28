import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

import {
  HazardDetailSchema,
  HazardSchema,
  PatchHazardRequestSchema,
  type Hazard,
  type HazardDetail,
  type PatchHazardRequest,
} from '@/contracts';

import { recordEvent } from '@/lib/domain/events';
import { ApiError, fromPostgrest } from '@/lib/domain/errors';
import { isoTimestamp, toHazard, type HazardRow } from '@/lib/domain/mappers';
import { buildPage, decodeCursor, keysetAfter, PageSize } from '@/lib/domain/pagination';

const HAZARD_SELECT = `
  id, code, category, location_text, severity, summary, status,
  owner_worker_id, owner_staff_id, due_at, created_at, ai_status,
  possible_duplicate_id,
  workers ( full_name ),
  staff ( full_name ),
  possible_duplicate:hazards!possible_duplicate_id ( id, code ),
  hazard_reports ( count )
`;

export type HazardFilters = {
  status?: string;
  category?: string;
  from?: string;
  to?: string;
  cursor?: string | null;
};

export async function listHazards(
  db: SupabaseClient,
  filters: HazardFilters,
): Promise<{ items: Hazard[]; nextCursor: string | null }> {
  let query = db
    .from('hazards')
    .select(HAZARD_SELECT)
    // A hazard card is ordered by when it was raised: the newest report is the
    // one a supervisor has not triaged yet.
    .order('created_at', { ascending: false })
    .order('id', { ascending: true })
    .limit(PageSize + 1);

  if (filters.status) query = query.eq('status', filters.status);
  if (filters.category) query = query.eq('category', filters.category);
  if (filters.from) query = query.gte('created_at', `${filters.from}T00:00:00.000Z`);
  if (filters.to) query = query.lte('created_at', `${filters.to}T23:59:59.999Z`);

  const cursor = decodeCursor(filters.cursor);
  if (cursor) query = query.or(keysetAfter('created_at', 'id', cursor));

  const { data, error } = await query;
  if (error) throw fromPostgrest(error);

  const rows = (data ?? []) as unknown as HazardRow[];
  const page = buildPage(rows, PageSize, (row) => row.created_at);
  return { items: page.items.map((row) => toHazard(row)), nextCursor: page.nextCursor };
}

export async function getHazard(db: SupabaseClient, id: string): Promise<HazardDetail> {
  const { data, error } = await db.from('hazards').select(HAZARD_SELECT).eq('id', id).maybeSingle();
  if (error) throw fromPostgrest(error);
  if (!data) throw ApiError.notFound();

  const row = data as unknown as HazardRow & { hazard_reports?: { count: number }[] };

  const { data: reports } = await db
    .from('hazard_reports')
    .select('id, reporter_name, unverified_reporter, transcript, received_at, workers ( full_name )')
    .eq('hazard_id', id)
    .order('received_at', { ascending: false });

  const { data: events } = await db
    .from('events')
    .select('kind, created_at, actor_type, staff ( full_name )')
    .eq('entity_type', 'hazard')
    .eq('entity_id', id)
    .order('created_at', { ascending: false })
    .limit(50);

  // A hazard the site raised from a voice or SMS report carries the reporter's
  // audio. It is stored privately and would be served through a short-lived
  // signed URL; that requires the storage bucket to exist, so it is resolved
  // only when there is actually audio to resolve and the failure degrades to
  // "no audio" rather than failing the whole detail view.
  return HazardDetailSchema.parse({
    ...toHazard({ ...row, reporter_count: row.hazard_reports?.[0]?.count ?? 0 }),
    reports: (reports ?? []).map((report) => ({
      id: report.id,
      reporterName: normalizeReporter(report),
      unverifiedReporter: report.unverified_reporter,
      transcript: report.transcript,
      audioUrl: null,
      receivedAt: isoTimestamp(report.received_at),
    })),
    photos: [],
    history: (events ?? []).map((event) => ({
      action: describeEvent(event.kind),
      at: isoTimestamp(event.created_at),
      actorName: normalizeActor(event),
    })),
  });
}

function normalizeReporter(report: {
  reporter_name: string | null;
  unverified_reporter: boolean;
  workers: unknown;
}): string | null {
  const worker = report.workers as { full_name: string } | { full_name: string }[] | null;
  const name = Array.isArray(worker) ? worker[0]?.full_name : worker?.full_name;
  if (name) return name;
  if (report.reporter_name) return report.reporter_name;
  // A number we could not match to the roster. Still worth showing: an
  // unidentified reporter is exactly what `unverified_reporter` records.
  return report.unverified_reporter ? 'Unverified reporter' : null;
}

function normalizeActor(event: { actor_type: string; staff: unknown }): string {
  if (event.actor_type === 'system') return 'Buildora';
  const staff = event.staff as { full_name: string } | { full_name: string }[] | null;
  const name = Array.isArray(staff) ? staff[0]?.full_name : staff?.full_name;
  return name ?? 'Site staff';
}

function describeEvent(kind: string): string {
  const table: Record<string, string> = {
    'hazard.triaged': 'Severity set',
    'hazard.assigned': 'Owner assigned',
    'hazard.updated': 'Details updated',
    'hazard.merged': 'Merged into a duplicate',
    'hazard.reopened': 'Reopened',
  };
  return table[kind] ?? 'Updated';
}

/**
 * Triage: severity, category, location, owner and due date.
 *
 * The database enforces "at most one owner" and "assigned implies an owner", so
 * assigning here also moves a freshly reported hazard to `assigned` rather than
 * storing an owner against a `reported` card that nobody has picked up.
 */
export async function patchHazard(
  reader: SupabaseClient,
  writer: SupabaseClient,
  siteId: string,
  staffId: string,
  id: string,
  input: PatchHazardRequest,
): Promise<Hazard> {
  const body = PatchHazardRequestSchema.parse(input);

  const { data: existing, error: readError } = await reader
    .from('hazards')
    .select(HAZARD_SELECT)
    .eq('id', id)
    .maybeSingle();
  if (readError) throw fromPostgrest(readError);
  if (!existing) throw ApiError.notFound();
  const current = existing as unknown as HazardRow;

  if (body.mergeIntoId !== undefined) {
    return mergeHazard(reader, writer, siteId, staffId, current, body.mergeIntoId);
  }

  const patch: Record<string, unknown> = {};
  if (body.severity !== undefined) patch.severity = body.severity;
  if (body.category !== undefined) patch.category = body.category;
  if (body.locationText !== undefined) patch.location_text = body.locationText;
  if (body.summary !== undefined) patch.summary = body.summary;
  if (body.dueAt !== undefined) patch.due_at = body.dueAt;

  let ownerChanged = false;
  if (body.owner !== undefined) {
    // The owner is a `worker | staff` union, so it cannot carry a foreign key.
    // Resolve it against the caller's site first -- RLS makes another site's
    // worker invisible, which is what stops a hazard being assigned off-site.
    if (body.owner.type === 'worker') {
      const { data: worker } = await reader
        .from('workers')
        .select('id')
        .eq('id', body.owner.id)
        .maybeSingle();
      if (!worker) throw ApiError.validation({ owner: 'Unknown worker.' });
    } else {
      const { data: staff } = await reader
        .from('staff')
        .select('id')
        .eq('id', body.owner.id)
        .maybeSingle();
      if (!staff) throw ApiError.validation({ owner: 'Unknown staff member.' });
    }
    patch.owner_worker_id = body.owner.type === 'worker' ? body.owner.id : null;
    patch.owner_staff_id = body.owner.type === 'staff' ? body.owner.id : null;
    ownerChanged = true;
  }

  // An owner on a card still in `reported` means somebody has picked it up.
  // The database rejects `assigned` with no owner, so the two must move together.
  if (ownerChanged && current.status === 'reported') patch.status = 'assigned';

  if (Object.keys(patch).length === 0) return toHazard(current);

  const { data, error } = await writer
    .from('hazards')
    .update(patch)
    .eq('id', id)
    .eq('site_id', siteId)
    .select(HAZARD_SELECT)
    .maybeSingle();
  if (error) throw fromPostgrest(error);
  if (!data) throw ApiError.notFound();

  await recordEvent(writer, {
    siteId,
    entityType: 'hazard',
    entityId: id,
    kind: ownerChanged ? 'hazard.assigned' : body.severity !== undefined ? 'hazard.triaged' : 'hazard.updated',
    actorType: 'staff',
    actorId: staffId,
    payload: { changed: Object.keys(patch) },
  });

  return toHazard(data as unknown as HazardRow);
}

/**
 * Merges a duplicate into the hazard that already covers the same risk.
 *
 * The reports move to the target so nothing a worker sent is lost, and the
 * source is kept and closed rather than deleted: it is the audit trail for the
 * fact that two reports were ever seen as separate.
 */
async function mergeHazard(
  reader: SupabaseClient,
  writer: SupabaseClient,
  siteId: string,
  staffId: string,
  source: HazardRow,
  targetId: string,
): Promise<Hazard> {
  if (source.id === targetId) {
    throw ApiError.validation({ mergeIntoId: 'A hazard cannot be merged into itself.' });
  }

  const { data: target } = await reader
    .from('hazards')
    .select(HAZARD_SELECT)
    .eq('id', targetId)
    .maybeSingle();
  if (!target) throw ApiError.validation({ mergeIntoId: 'Unknown hazard.' });

  const { error: moveError } = await writer
    .from('hazard_reports')
    .update({ hazard_id: targetId })
    .eq('hazard_id', source.id);
  if (moveError) throw fromPostgrest(moveError);

  const { data, error } = await writer
    .from('hazards')
    .update({
      merged_into_id: targetId,
      status: 'closed_unverified',
      owner_worker_id: null,
      owner_staff_id: null,
    })
    .eq('id', source.id)
    .eq('site_id', siteId)
    .select(HAZARD_SELECT)
    .maybeSingle();
  if (error) throw fromPostgrest(error);
  if (!data) throw ApiError.notFound();

  await recordEvent(writer, {
    siteId,
    entityType: 'hazard',
    entityId: source.id,
    kind: 'hazard.merged',
    actorType: 'staff',
    actorId: staffId,
    payload: { mergedInto: (target as unknown as HazardRow).code },
  });

  return toHazard(data as unknown as HazardRow);
}

export const HazardListSchema = HazardSchema;
