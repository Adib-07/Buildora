import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

import { logger } from '@/lib/security/logger';

/**
 * Appends to the audit trail.
 *
 * `events` has no INSERT policy for `authenticated` and a trigger that rejects
 * UPDATE/DELETE, so this is the only way a staff action is recorded -- and a
 * signed-in caller cannot forge an entry by talking to PostgREST directly.
 *
 * Never let this fail the request it is describing. An audit write that throws
 * would roll back a change the supervisor legitimately made, so the error is
 * logged (server-side, with the request id) and swallowed. The row is the
 * record; losing it is a bug, but failing the user action over it is worse.
 */
export async function recordEvent(
  writer: SupabaseClient,
  event: {
    siteId: string;
    entityType: string;
    entityId?: string | null;
    kind: string;
    actorType: 'staff' | 'worker' | 'system';
    actorId?: string | null;
    payload?: Record<string, unknown>;
  },
): Promise<void> {
  const { error } = await writer.from('events').insert({
    site_id: event.siteId,
    entity_type: event.entityType,
    entity_id: event.entityId ?? null,
    kind: event.kind,
    actor_type: event.actorType,
    actor_id: event.actorId ?? null,
    // The payload is a description of the change, not the change itself. Phone
    // numbers and message bodies must never be written here: `events` is not
    // redacted the way the logger is, and this table is readable by every
    // authenticated member of the site.
    payload: event.payload ?? {},
  });

  if (error) {
    logger.error({ err: error.message, kind: event.kind }, 'failed to append audit event');
  }
}
