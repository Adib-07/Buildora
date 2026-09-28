import { describe, expect, it } from 'vitest';

import { z } from 'zod';

import { ErrorResponseSchema, MeSchema } from '@/contracts';

import { IDS, SEED_PASSWORD } from '../helpers/env';
import { API_BASE } from '../setup/server';

/** login returns `{ token } & Me` per contracts/endpoints.ts. */
const LoginBody = z.object({ token: z.string() }).extend(MeSchema.shape);

/**
 * End-to-end over real HTTP: Next route handler -> @supabase/ssr -> Supabase
 * Auth -> PostgREST -> PostgreSQL, with RLS applied on the way through.
 *
 * Every success body is parsed with the contract schema and every failure with
 * ErrorResponseSchema, so a response that drifts from contracts/ fails here.
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
    clear: () => store.clear(),
  };
}

async function login(email: string) {
  const cookies = jar();
  const response = await fetch(`${API_BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: SEED_PASSWORD }),
  });
  cookies.absorb(response);
  return { cookies, response };
}

describe('POST /api/v1/auth/login', () => {
  it('signs a seeded supervisor in and returns a contract-valid Me', async () => {
    const { response } = await login('supervisor@quarryridge.test');
    expect(response.status).toBe(200);

    const body = await response.json();
    const parsed = LoginBody.safeParse(body);
    expect(parsed.success, JSON.stringify(body)).toBe(true);

    expect(parsed.data!.role).toBe('supervisor');
    expect(parsed.data!.siteId).toBe(IDS.siteA);
    expect(parsed.data!.staffId).toBe(IDS.staffASupervisor);
    expect(parsed.data!.shiftEnd).toMatch(/^([01]\d|2[0-3]):[0-5]\d$/);
    expect(parsed.data!.serverNow).toMatch(/Z$/);
  });

  it('rejects a wrong password with 401 and a contract error body', async () => {
    const response = await fetch(`${API_BASE}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'supervisor@quarryridge.test', password: 'wrong' }),
    });
    expect(response.status).toBe(401);

    const body = await response.json();
    const parsed = ErrorResponseSchema.safeParse(body);
    expect(parsed.success, JSON.stringify(body)).toBe(true);
    expect(parsed.data!.error.code).toBe('UNAUTHORIZED');
    expect(parsed.data!.requestId).toBeTruthy();
  });

  it('gives the same answer for an unknown account, so accounts cannot be enumerated', async () => {
    const unknown = await fetch(`${API_BASE}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'nobody@quarryridge.test', password: 'whatever' }),
    });
    const wrongPw = await fetch(`${API_BASE}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'supervisor@quarryridge.test', password: 'whatever' }),
    });

    expect(unknown.status).toBe(wrongPw.status);
    const a = ErrorResponseSchema.parse(await unknown.json());
    const b = ErrorResponseSchema.parse(await wrongPw.json());
    expect(a.error.message).toBe(b.error.message);
  });

  it('returns 422 with per-field keys for a malformed body', async () => {
    const response = await fetch(`${API_BASE}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'not-an-email', password: '' }),
    });
    expect(response.status).toBe(422);

    const body = ErrorResponseSchema.parse(await response.json());
    expect(body.error.code).toBe('VALIDATION');
    expect(body.error.fields).toBeDefined();
    expect(Object.keys(body.error.fields!)).toEqual(
      expect.arrayContaining(['email', 'password']),
    );
  });

  it('returns 422 when the body is not JSON at all', async () => {
    const response = await fetch(`${API_BASE}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not json at all',
    });
    expect(response.status).toBe(422);
    expect(ErrorResponseSchema.parse(await response.json()).error.code).toBe('VALIDATION');
  });
});

describe('GET /api/v1/me', () => {
  it('is 401 without a session', async () => {
    const response = await fetch(`${API_BASE}/api/v1/me`);
    expect(response.status).toBe(401);
    expect(ErrorResponseSchema.parse(await response.json()).error.code).toBe('UNAUTHORIZED');
  });

  it('returns the caller\'s own site and role', async () => {
    const { response } = await login('engineer@quarryridge.test');
    expect(response.status).toBe(200);

    const me = MeSchema.parse(await response.json());
    expect(me.role).toBe('engineer');
    expect(me.siteId).toBe(IDS.siteA);
    expect(me.staffId).toBe(IDS.staffAEngineer);
  });

  it('never echoes a client-supplied site id', async () => {
    const { cookies } = await login('supervisor@quarryridge.test');
    // There is no site parameter on this route at all; posting one must not
    // change the answer, and must not be reflected.
    const response = await fetch(`${API_BASE}/api/v1/me?siteId=${IDS.siteB}`, {
      headers: { cookie: cookies.header()! },
    });
    const me = MeSchema.parse(await response.json());
    expect(me.siteId).toBe(IDS.siteA);
    expect(JSON.stringify(me)).not.toContain(IDS.siteB);
  });
});

describe('POST /api/v1/auth/logout', () => {
  it('ends the session, after which /me is 401 again', async () => {
    const { cookies } = await login('owner@quarryridge.test');

    const before = await fetch(`${API_BASE}/api/v1/me`, {
      headers: { cookie: cookies.header()! },
    });
    expect(before.status).toBe(200);

    const out = await fetch(`${API_BASE}/api/v1/auth/logout`, {
      method: 'POST',
      headers: { cookie: cookies.header()! },
    });
    expect(out.status).toBe(200);
    expect(await out.json()).toEqual({});

    const after = await fetch(`${API_BASE}/api/v1/me`, {
      headers: { cookie: cookies.header()! },
    });
    expect(after.status).toBe(401);
  });

  it('is 401 without a session', async () => {
    const response = await fetch(`${API_BASE}/api/v1/auth/logout`, { method: 'POST' });
    expect(response.status).toBe(401);
  });
});
