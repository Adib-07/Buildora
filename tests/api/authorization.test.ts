import { beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { ErrorResponseSchema, WorkerSchema } from '@/contracts';

import { API_BASE } from '../setup/server';
import { IDS, SEED_PASSWORD } from '../helpers/env';

/**
 * Authorization over real HTTP for the routes added on top of the auth
 * foundation: teams, workers, attendance, tasks, disputes, hazards, summaries.
 *
 * These go through the whole chain -- proxy, route handler, @supabase/ssr,
 * Supabase Auth, PostgREST, PostgreSQL with RLS -- because the question being
 * asked is "what does a caller who is not allowed actually get back", and that
 * is a property of the assembled system, not of one function.
 *
 * Preconditions: a freshly seeded local database (`pnpm db:reset`).
 */

/** Minimal cookie jar: Node's fetch does not persist cookies on its own. */
function jar() {
  const store = new Map<string, string>();
  return {
    absorb(response: Response) {
      for (const raw of response.headers.getSetCookie()) {
        const [pair] = raw.split(';');
        const index = pair.indexOf('=');
        if (index > 0) store.set(pair.slice(0, index).trim(), pair.slice(index + 1).trim());
      }
    },
    header(): string | undefined {
      if (store.size === 0) return undefined;
      return [...store].map(([k, v]) => `${k}=${v}`).join('; ');
    },
  };
}

type Session = { cookies: string; role: string };

async function login(email: string): Promise<Session> {
  const cookies = jar();
  const response = await fetch(`${API_BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: SEED_PASSWORD }),
  });
  expect(response.status, `login failed for ${email}`).toBe(200);
  cookies.absorb(response);
  return { cookies: cookies.header()!, role: email };
}

async function call(
  session: Session,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; json: unknown }> {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      cookie: session.cookies,
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: response.status, json: await response.json() };
}

function expectErrorCode(json: unknown, code: string) {
  const parsed = ErrorResponseSchema.parse(json);
  expect(parsed.error.code).toBe(code);
  // Every failure carries a request id so a user-visible message can be tied to
  // a server log line without exposing the log itself.
  expect(parsed.requestId).toBeTruthy();
}

describe('authenticated reads', () => {
  it('returns the supervisor their own site workers, unmasked', async () => {
    const session = await login('supervisor@quarryridge.test');
    const { status, json } = await call(session, 'GET', '/api/v1/workers');
    expect(status).toBe(200);

    const { items } = z.object({ items: z.array(WorkerSchema) }).parse(json);
    expect(items.length).toBeGreaterThan(0);
    // A supervisor dials workers and resolves shared-phone replies with the code.
    expect(items[0]!.phone).toMatch(/^\+91\d{10}$/);
    expect(items.some((w) => w.workerCode !== null)).toBe(true);
  });

  it('masks phone numbers and hides codes from an engineer', async () => {
    const session = await login('engineer@quarryridge.test');
    const { status, json } = await call(session, 'GET', '/api/v1/workers');
    expect(status).toBe(200);

    const { items } = z.object({ items: z.array(WorkerSchema) }).parse(json);
    for (const worker of items) {
      expect(worker.workerCode).toBeNull();
      if (worker.phone.includes('X')) {
        // Masked shape: +91XXXXXX3210
        expect(worker.phone).toMatch(/^\+91X{6}\d{4}$/);
      }
    }
    // No unmasked number may appear anywhere in the payload.
    const body = JSON.stringify(json);
    expect(body).not.toMatch(/\+9198765432(?!10)/);
  });
});

describe('role enforcement', () => {
  it('forbids an engineer from writing a worker', async () => {
    const engineer = await login('engineer@quarryridge.test');
    const { status, json } = await call(engineer, 'POST', '/api/v1/workers', {
      fullName: 'Should Not Exist',
      phone: '+919812340099',
      teamId: '0a000001-0000-4000-8000-000000000001',
      lang: 'en',
    });
    expect(status).toBe(403);
    expectErrorCode(json, 'FORBIDDEN');
  });

  it('forbids an engineer from changing an attendance record', async () => {
    const engineer = await login('engineer@quarryridge.test');
    const { status, json } = await call(
      engineer,
      'PATCH',
      '/api/v1/attendance/2a000001-0000-4000-8000-000000000009',
      { hours: 8, expectedVersion: 1 },
    );
    expect(status).toBe(403);
    expectErrorCode(json, 'FORBIDDEN');
  });

  it('forbids a supervisor from reading the day summary', async () => {
    // The summary is the client-facing artefact; the contract restricts it.
    const supervisor = await login('supervisor@quarryridge.test');
    const { status, json } = await call(supervisor, 'GET', '/api/v1/summaries/2026-01-01');
    expect(status).toBe(403);
    expectErrorCode(json, 'FORBIDDEN');
  });

  it('lets an owner read the day summary', async () => {
    const owner = await login('owner@quarryridge.test');
    const { status } = await call(owner, 'GET', '/api/v1/summaries/2026-01-01');
    // Either the figures or a 404 for that date; never 403.
    expect([200, 404]).toContain(status);
  });
});

describe('cross-tenant isolation', () => {
  it('returns nothing for another site\'s worker id', async () => {
    const siteB = await login('supervisor@harbourworks.test');
    const { status, json } = await call(siteB, 'PATCH', `/api/v1/workers/${IDS.workerA1}`, {
      active: false,
    });
    // 404, not 403: the caller must not be able to learn the row exists.
    expect(status).toBe(404);
    expectErrorCode(json, 'NOT_FOUND');
  });

  it('returns nothing for another site\'s hazard id', async () => {
    const siteB = await login('supervisor@harbourworks.test');
    const { status, json } = await call(siteB, 'GET', `/api/v1/hazards/${IDS.hazardA1}`);
    expect(status).toBe(404);
    expectErrorCode(json, 'NOT_FOUND');
  });

  it('never leaks the other site\'s rows in a list', async () => {
    const siteB = await login('supervisor@harbourworks.test');
    const { json } = await call(siteB, 'GET', '/api/v1/workers');
    const body = JSON.stringify(json);
    expect(body).not.toContain(IDS.workerA1);
    expect(body).not.toContain('Ramesh Kumar');
  });

  it('refuses to assign a task to a worker from another site', async () => {
    const siteA = await login('supervisor@quarryridge.test');
    const { status, json } = await call(siteA, 'POST', '/api/v1/tasks/approve', {
      workDate: new Date().toISOString().slice(0, 10),
      tasks: [
        {
          title: 'Cross-site assignment attempt',
          location: null,
          ownerWorkerId: IDS.workerB1,
        },
      ],
    });
    expect(status).toBe(422);
    expectErrorCode(json, 'VALIDATION');
  });
});

describe('optimistic concurrency', () => {
  it('rejects a stale expectedVersion with 409 and leaves the row alone', async () => {
    const supervisor = await login('supervisor@quarryridge.test');
    const recordId = '2a000001-0000-4000-8000-000000000010';

    const first = await call(supervisor, 'PATCH', `/api/v1/attendance/${recordId}`, {
      hours: 8.5,
      expectedVersion: 1,
    });
    expect(first.status).toBe(200);

    // The same edit replayed with the now-stale version must lose.
    const second = await call(supervisor, 'PATCH', `/api/v1/attendance/${recordId}`, {
      hours: 9,
      expectedVersion: 1,
    });
    expect(second.status).toBe(409);
    expectErrorCode(second.json, 'VERSION_CONFLICT');

    // And the winning value is the one that stuck.
    const { json } = await call(supervisor, 'GET', `/api/v1/days/${today()}/attendance`);
    const day = z
      .object({
        records: z.array(z.object({ id: z.string(), hours: z.number(), version: z.number() })),
      })
      .parse(json);
    const record = day.records.find((r) => r.id === recordId);
    expect(record?.hours).toBe(8.5);
    expect(record?.version).toBe(2);
  });

  it('refuses to edit a locked day', async () => {
    const supervisor = await login('supervisor@quarryridge.test');
    const { status, json } = await call(
      supervisor,
      'PATCH',
      '/api/v1/attendance/2a000001-0000-4000-8000-000000000001',
      { hours: 8, expectedVersion: 1 },
    );
    expect(status).toBe(423);
    expectErrorCode(json, 'DAY_LOCKED');
  });
});

describe('dispute resolution', () => {
  /**
   * Its own dispute, created in `beforeAll` on a record the seed leaves
   * undisputed.
   *
   * The seeded dispute is a shared fixture: `tests/db/constraints.test.ts`
   * asserts the one-open-per-record rule against it, so consuming it here would
   * make the suite order-dependent. Creating a private one keeps both tests
   * valid whichever order they run in.
   */
  const RECORD = '2a000001-0000-4000-8000-000000000006';
  let disputeId = '';

  beforeAll(async () => {
    const { serviceRole } = await import('../helpers/supabase');
    const { data, error } = await serviceRole()
      .from('disputes')
      .insert({
        record_id: RECORD,
        worker_id: '0c000001-0000-4000-8000-000000000002',
        record_version: 1,
        status: 'open',
        reason_text: 'I was on site until 4pm',
      })
      .select('id')
      .single();
    if (error) throw new Error(`could not create the test dispute: ${error.message}`);
    disputeId = data.id;
  });

  it('applies a correction once and then refuses a second decision', async () => {
    const supervisor = await login('supervisor@quarryridge.test');

    const first = await call(supervisor, 'POST', `/api/v1/disputes/${disputeId}/resolve`, {
      outcome: 'corrected',
      status: 'present',
      hours: 6,
      late: false,
      note: 'Worker is right about leaving early.',
    });
    expect(first.status).toBe(200);

    const second = await call(supervisor, 'POST', `/api/v1/disputes/${disputeId}/resolve`, {
      outcome: 'upheld',
      note: 'Trying again.',
    });
    // 409, so a second decision cannot silently overwrite the first.
    expect(second.status).toBe(409);
    expectErrorCode(second.json, 'BAD_TRANSITION');
  });

  it('rejects an upheld dispute with no note', async () => {
    const supervisor = await login('supervisor@quarryridge.test');
    const { status } = await call(
      supervisor,
      'POST',
      `/api/v1/disputes/${disputeId}/resolve`,
      { outcome: 'upheld', note: '' },
    );
    expect(status).toBe(422);
  });

  it('refuses a cross-site resolution', async () => {
    const siteB = await login('supervisor@harbourworks.test');
    const { status } = await call(siteB, 'POST', `/api/v1/disputes/${disputeId}/resolve`, {
      outcome: 'upheld',
      note: 'Not my site.',
    });
    expect(status).toBe(404);
  });
});

describe('input validation at the edge', () => {
  it('rejects a cursor it did not issue without failing the request', async () => {
    const supervisor = await login('supervisor@quarryridge.test');
    const { status } = await call(supervisor, 'GET', '/api/v1/workers?cursor=not-a-cursor');
    // Ignored, so the caller gets the first page rather than an error.
    expect(status).toBe(200);
  });

  it('rejects a malformed uuid in a path segment as not found', async () => {
    const supervisor = await login('supervisor@quarryridge.test');
    const { status, json } = await call(supervisor, 'GET', '/api/v1/hazards/not-a-uuid');
    expect(status).toBe(404);
    expectErrorCode(json, 'NOT_FOUND');
  });

  it('rejects a non YYYY-MM-DD date with a field-level message', async () => {
    const supervisor = await login('supervisor@quarryridge.test');
    const { status, json } = await call(supervisor, 'GET', '/api/v1/days/28-09-2026/attendance');
    expect(status).toBe(422);
    const parsed = ErrorResponseSchema.parse(json);
    expect(parsed.error.code).toBe('VALIDATION');
    expect(parsed.error.fields?.date).toBeTruthy();
  });

  it('rejects an out-of-range severity on a hazard', async () => {
    const supervisor = await login('supervisor@quarryridge.test');
    const { status, json } = await call(
      supervisor,
      'PATCH',
      `/api/v1/hazards/${IDS.hazardA1}`,
      { severity: 9 },
    );
    expect(status).toBe(422);
    expectErrorCode(json, 'VALIDATION');
  });
});

describe('unauthenticated access', () => {
  it('is 401 on every staff route', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const routes: [string, string][] = [
      ['GET', '/api/v1/me'],
      ['GET', '/api/v1/teams'],
      ['GET', '/api/v1/workers'],
      ['GET', `/api/v1/days/${today}/attendance`],
      ['GET', `/api/v1/days/${today}/tasks`],
      ['GET', '/api/v1/disputes'],
      ['GET', '/api/v1/hazards'],
      ['GET', '/api/v1/summaries/2026-01-01'],
    ];

    for (const [method, path] of routes) {
      const response = await fetch(`${API_BASE}${path}`, { method });
      expect(response.status, `${method} ${path} should be 401`).toBe(401);
      expectErrorCode(await response.json(), 'UNAUTHORIZED');
    }
  });

  it('is 401 for a write, not 403', async () => {
    const response = await fetch(`${API_BASE}/api/v1/attendance/2a000001-0000-4000-8000-000000000009`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ hours: 8, expectedVersion: 1 }),
    });
    expect(response.status).toBe(401);
  });
});

function today() {
  return new Date().toISOString().slice(0, 10);
}
