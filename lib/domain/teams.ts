import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { TeamSchema, type Team } from '@/contracts';

import { fromPostgrest } from '@/lib/domain/errors';

export async function listTeams(db: SupabaseClient): Promise<Team[]> {
  // RLS restricts this to the caller's own site, so no site filter is needed --
  // and adding one from the client would be the wrong layer to enforce tenancy.
  const { data, error } = await db.from('teams').select('id, name').order('name');
  if (error) throw fromPostgrest(error);
  return (data ?? []).map((row) => TeamSchema.parse({ id: row.id, name: row.name }));
}
