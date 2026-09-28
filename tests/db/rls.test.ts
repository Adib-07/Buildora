import { beforeAll, describe, expect, it } from 'vitest';

import { IDS } from '../helpers/env';
import { anonymous, siteAEngineer, siteASupervisor, siteBSupervisor } from '../helpers/supabase';

/**
 * Row level security, verified against the running local Postgres rather than
 * by reading the policy text.
 *
 * Every client here is authenticated as a real seeded staff member and issues
 * queries as that user, so PostgREST applies the policies under test.
 */
describe('RLS tenant isolation', () => {
  beforeAll(async () => {
    // Fail loudly rather than silently passing against an empty database.
    const { data, error } = await siteASupervisor().then((a) =>
      a.client.from('sites').select('id'),
    );
    if (error) throw new Error(`local Supabase unreachable: ${error.message}`);
    if (!data?.length) {
      throw new Error('Seed data missing. Run `supabase db reset` before the tests.');
    }
  });

  it('denies the anonymous role outright rather than returning empty rows', async () => {
    // The publishable key is not a data path: `anon` holds no SELECT grant on
    // any tenant table, so PostgREST refuses before RLS is even consulted. That
    // is deny-by-privilege, which is stronger than an empty result set, and it
    // is asserted here so a future GRANT cannot quietly widen access.
    const anon = anonymous();
    for (const table of ['sites', 'workers', 'hazards', 'attendance_records'] as const) {
      const { data, error } = await anon.from(table).select('*');
      expect(error, `${table} was reachable by anon`).not.toBeNull();
      expect(error?.code, `${table} error code`).toBe('42501');
      expect(data, table).toBeNull();
    }
  });

  it('a supervisor sees only their own site', async () => {
    const a = await siteASupervisor();

    const { data: sites } = await a.client.from('sites').select('id');
    expect(sites?.map((s) => s.id)).toEqual([IDS.siteA]);

    const { data: workers } = await a.client.from('workers').select('id, site_id');
    expect(workers?.length).toBeGreaterThan(0);
    expect(new Set(workers?.map((w) => w.site_id))).toEqual(new Set([IDS.siteA]));
  });

  it('site B cannot read site A rows even with the exact id', async () => {
    const b = await siteBSupervisor();

    // Hazard and worker ids from site A are known to the test; RLS must still
    // hide them rather than returning the row.
    const { data: hazard, error: hazardError } = await b.client
      .from('hazards')
      .select('*')
      .eq('id', IDS.hazardA1)
      .maybeSingle();
    expect(hazardError).toBeNull();
    expect(hazard).toBeNull();

    const { data: worker } = await b.client
      .from('workers')
      .select('*')
      .eq('id', IDS.workerA1)
      .maybeSingle();
    expect(worker).toBeNull();
  });

  it('refuses a cross-site write: site B cannot insert a site A row', async () => {
    const b = await siteBSupervisor();

    const { error } = await b.client.from('teams').insert({
      site_id: IDS.siteA,
      name: 'Injected Team',
    });

    // The WITH CHECK clause must reject it, not the FK.
    expect(error).not.toBeNull();
  });

  it('refuses a cross-site update: site B cannot retag a site A row', async () => {
    const b = await siteBSupervisor();

    const { error } = await b.client
      .from('hazards')
      .update({ summary: 'defaced' })
      .eq('id', IDS.hazardA1);

    expect(error).not.toBeNull();
  });

  it('site B cannot delete a site A row', async () => {
    const b = await siteBSupervisor();

    const { error } = await b.client.from('hazards').delete().eq('id', IDS.hazardA1);
    expect(error).not.toBeNull();

    const a = await siteASupervisor();
    const { data } = await a.client
      .from('hazards')
      .select('id')
      .eq('id', IDS.hazardA1)
      .maybeSingle();
    expect(data, 'target row survived the cross-site delete').not.toBeNull();
  });

  it('child tables inherit isolation through their parent', async () => {
    const b = await siteBSupervisor();

    // attendance_versions and disputes reach their site only via attendance_records.
    const { data: versions } = await b.client.from('attendance_versions').select('*');
    expect(versions).toEqual([]);

    const { data: disputes } = await b.client.from('disputes').select('*');
    expect(disputes).toEqual([]);

    const { data: reports } = await b.client.from('hazard_reports').select('*');
    expect(reports).toEqual([]);
  });

  it('an engineer of site A has the same row visibility as the supervisor', async () => {
    const supervisor = await siteASupervisor();
    const engineer = await siteAEngineer();

    const { data: a } = await supervisor.client.from('workers').select('id').order('id');
    const { data: b } = await engineer.client.from('workers').select('id').order('id');

    // RLS is site-scoped, not role-scoped: restricting the engineer's rows is
    // the API's job (phone masking), not the database's.
    expect(b?.map((w) => w.id)).toEqual(a?.map((w) => w.id));
  });

  it('reads a staff row for the site but not another site\'s', async () => {
    const a = await siteASupervisor();

    const { data: staff } = await a.client.from('staff').select('id, site_id');
    expect(staff?.length).toBeGreaterThan(0);
    expect(new Set(staff?.map((s) => s.site_id))).toEqual(new Set([IDS.siteA]));
  });
});
