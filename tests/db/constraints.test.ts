import { beforeAll, describe, expect, it } from 'vitest';

import { IDS } from '../helpers/env';
import { serviceRole } from '../helpers/supabase';

/**
 * Database-level invariants, each mapped to a rule in contracts/ or the
 * documented business logic. These are enforced by Postgres itself, so they
 * hold no matter which code path writes the row.
 */
// Distinct per run so a repeated `pnpm test` cannot trip the (site_id, code)
// unique index left over from a previous run.
const runSuffix = Math.floor(Math.random() * 90 + 10);

describe('schema constraints', () => {
  beforeAll(async () => {
    // Write-path checks run as service_role, which is what the API routes use.
    // The user-session role is read-only by design; see helpers/supabase.ts.
    const { data, error } = await serviceRole().from('sites').select('id');
    if (error) throw new Error(`local Supabase unreachable: ${error.message}`);
    if (!data?.length) throw new Error('Seed data missing. Run `supabase db reset`.');
  });

  it('rejects attendance hours off the 0.5 step', async () => {
    const a = serviceRole();

    const { error } = await a
      .from('attendance_records')
      .update({ hours: 7.3 })
      .eq('id', '2a000001-0000-4000-8000-000000000009');

    expect(error, '7.3h should be rejected by the HoursSchema check').not.toBeNull();
    expect(error?.code).toBe('23514');
  });

  it('rejects attendance hours outside 0..16', async () => {
    const a = serviceRole();
    const { error } = await a
      .from('attendance_records')
      .update({ hours: 16.5 })
      .eq('id', '2a000001-0000-4000-8000-000000000009');
    expect(error?.code).toBe('23514');
  });

  it('rejects a worker code that is not four digits', async () => {
    const a = serviceRole();
    const { error } = await a
      .from('workers')
      .update({ worker_code: '12345' })
      .eq('id', IDS.workerA1);
    expect(error?.code).toBe('23514');
  });

  it('rejects a duplicate worker code within the same site', async () => {
    const a = serviceRole();
    const { error } = await a
      .from('workers')
      .update({ worker_code: '7390' })
      .eq('id', IDS.workerA1);
    expect(error?.code).toBe('23505');
  });

  it('allows the same worker code in a different site', async () => {
    const b = serviceRole();
    // '4821' already exists in site A. Site B must be able to reuse it, which
    // is why the uniqueness is (site_id, worker_code) and not global.
    const { data, error } = await b
      .from('workers')
      .update({ worker_code: '4821' })
      .eq('id', IDS.workerB1)
      .select('worker_code');
    expect(error).toBeNull();
    expect(data?.[0]?.worker_code).toBe('4821');

    // Restore so the seed's own expectations still hold for later runs.
    await b.from('workers').update({ worker_code: '3311' }).eq('id', IDS.workerB1);
  });

  it('rejects a second open dispute on the same record', async () => {
    const a = serviceRole();

    const { error } = await a.from('disputes').insert({
      record_id: '2a000001-0000-4000-8000-000000000005',
      worker_id: IDS.workerA1,
      record_version: 1,
      status: 'open',
      reason_text: 'duplicate open dispute',
    });

    // Partial unique index on (record_id) where status = 'open'.
    expect(error?.code).toBe('23505');
  });

  it('rejects a upheld dispute with no note', async () => {
    const a = serviceRole();
    const { error } = await a.from('disputes').insert({
      record_id: '2a000001-0000-4000-8000-000000000006',
      worker_id: IDS.workerA1,
      record_version: 1,
      status: 'upheld',
      resolution_note: '  ',
    });
    expect(error?.code).toBe('23514');
  });

  it('rejects re-storing the same photo bytes in a site (PHOTO_REUSED)', async () => {
    const a = serviceRole();
    const sha = 'a'.repeat(64);

    const first = await a.from('hazard_photos').insert({
      site_id: IDS.siteA,
      hazard_id: IDS.hazardA1,
      storage_key: 'test/photo-1',
      mime: 'image/jpeg',
      bytes: 1000,
      sha256: sha,
      dhash: '12345',
    });
    expect(first.error, first.error?.message).toBeNull();

    const second = await a.from('hazard_photos').insert({
      site_id: IDS.siteA,
      hazard_id: IDS.hazardA1,
      storage_key: 'test/photo-2',
      mime: 'image/jpeg',
      bytes: 1000,
      sha256: sha,
      dhash: '12345',
    });
    expect(second.error?.code, 'identical bytes must be rejected').toBe('23505');

    await a.from('hazard_photos').delete().eq('storage_key', 'test/photo-1');
  });

  it('rejects a hazard with two owners, and assigned with none', async () => {
    const a = serviceRole();

    const two = await a.from('hazards').insert({
      site_id: IDS.siteA,
      code: `HZ-9${runSuffix}a`,
      category: 'other',
      summary: 'two owners',
      status: 'assigned',
      owner_worker_id: IDS.workerA1,
      owner_staff_id: IDS.staffASupervisor,
    });
    expect(two.error?.code, 'at most one owner').toBe('23514');

    const none = await a.from('hazards').insert({
      site_id: IDS.siteA,
      code: `HZ-9${runSuffix}b`,
      category: 'other',
      summary: 'assigned with no owner',
      status: 'assigned',
    });
    expect(none.error?.code, 'assigned needs an owner').toBe('23514');
  });

  it('rejects a task with no owner', async () => {
    const a = serviceRole();
    const { error } = await a.from('tasks').insert({
      site_id: IDS.siteA,
      work_day_id: '1a000001-0000-4000-8000-000000000003',
      title: 'Ownerless task',
      location: null,
      owner_worker_id: null,
      source: 'text',
    });
    expect(error?.code).toBe('23502');
  });

  it('rejects a state_version ahead of the record version', async () => {
    const a = serviceRole();
    const { error } = await a
      .from('attendance_records')
      .update({ state_version: 99 })
      .eq('id', '2a000001-0000-4000-8000-000000000009');
    expect(error?.code).toBe('23514');
  });

  it('enforces message idempotency so a job cannot double-send', async () => {
    const a = serviceRole();
    const key = 'test-idem-key';

    const first = await a.from('messages').insert({
      site_id: IDS.siteA,
      to_phone: '+919876543210',
      direction: 'out',
      body: 'test',
      template_key: 'record',
      idempotency_key: key,
    });
    expect(first.error).toBeNull();

    const second = await a.from('messages').insert({
      site_id: IDS.siteA,
      to_phone: '+919876543210',
      direction: 'out',
      body: 'test',
      template_key: 'record',
      idempotency_key: key,
    });
    expect(second.error?.code, 'second run of a job must not duplicate').toBe('23505');

    await a.from('messages').delete().eq('idempotency_key', key);
  });

  it('refuses to update or delete an event (append-only trail)', async () => {
    const a = serviceRole();

    // The API write path can append, using service_role.
    const inserted = await a
      .from('events')
      .insert({
        site_id: IDS.siteA,
        entity_type: 'worker',
        entity_id: IDS.workerA1,
        kind: 'worker.created',
        actor_type: 'system',
      })
      .select('id');
    expect(inserted.error, inserted.error?.message).toBeNull();
    const eventId = inserted.data![0].id;

    // The trigger then refuses any rewrite, independent of grants and RLS.
    const updated = await a
      .from('events')
      .update({ kind: 'tampered' })
      .eq('id', eventId);
    expect(updated.error, 'events must be append-only').not.toBeNull();

    const deleted = await a.from('events').delete().eq('id', eventId);
    expect(deleted.error, 'events must not be deletable').not.toBeNull();

    const { data: still } = await a.from('events').select('kind').eq('id', eventId);
    expect(still?.[0]?.kind, 'row survived both attempts').toBe('worker.created');

    // Clean up via a direct connection-free path: the trigger blocks DELETE,
    // so this row is intentionally left behind in the dev database.
  });

  it('does not let a staff session append to the audit trail', async () => {
    const { siteASupervisor } = await import('../helpers/supabase');
    const a = await siteASupervisor();

    // events has no INSERT policy, so a signed-in staff member cannot forge an
    // audit entry even with a valid token.
    const { error } = await a.client.from('events').insert({
      site_id: IDS.siteA,
      entity_type: 'worker',
      entity_id: IDS.workerA1,
      kind: 'forged',
      actor_type: 'system',
    });
    expect(error, 'a staff session must not be able to forge an audit row').not.toBeNull();
  });
});
