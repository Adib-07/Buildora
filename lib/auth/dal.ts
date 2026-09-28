import 'server-only';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { SupabaseClient } from '@supabase/supabase-js';

import type { Me, Role } from '@/contracts';

import {
  cookieStoreFromNext,
  createSessionClient,
  loadSession,
  resolveSessionUser,
  type SessionUser,
} from '@/lib/auth/session';
import { ApiError } from '@/lib/domain/errors';

/**
 * Data Access Layer for Server Components and Server Actions.
 *
 * Every page and action reaches the database through this module, which is what
 * makes the session check unavoidable: there is no other import path to
 * Supabase from `app/`. The alternative -- trusting each page to remember to
 * check -- is how a route ends up rendering another site's roster.
 *
 * The client returned here is the *session* client, so reads are executed by
 * Postgres as the signed-in user and scoped by RLS. `siteId` and `role` come
 * from the `staff` row, never from a prop, a query string or a cookie the
 * browser can edit.
 */

export type Session = {
  user: SessionUser;
  me: Me;
  /** Already authenticated and RLS-scoped. Pass it to the domain functions. */
  db: SupabaseClient;
};

/** The RLS-scoped client for this request. */
export async function db(): Promise<SupabaseClient> {
  return createSessionClient(cookieStoreFromNext(await cookies()));
}

/**
 * The session, or null. For pages that render differently when signed out.
 *
 * `getUser()` revalidates the token with the Auth server rather than reading a
 * cached one, so a revoked or expired cookie yields null here instead of a
 * stale identity.
 */
export async function getSession(): Promise<Session | null> {
  const client = await db();
  const user = await resolveSessionUser(client);
  if (!user) return null;
  return { user, me: await loadSession(client, user), db: client };
}

/**
 * The session, or a redirect to sign in. The entry point for every protected
 * page: the redirect happens before any query runs, so an unauthenticated
 * request never reaches the database.
 */
export async function requireSession(redirectTo = '/dashboard'): Promise<Session> {
  const session = await getSession();
  if (!session) redirect(`/login?next=${encodeURIComponent(redirectTo)}`);
  return session;
}

/**
 * The session, or a 404. For a page that must not exist for this role at all,
 * so that asking for it does not confirm it exists.
 */
export async function requireRole(roles: readonly Role[]): Promise<Session> {
  const session = await requireSession();
  if (!roles.includes(session.user.role)) {
    throw new ApiError('FORBIDDEN', 'Your role does not have access to this page.');
  }
  return session;
}

/**
 * Turns any thrown error into something safe to render.
 *
 * `notFound()` for a missing or invisible row -- which is also the answer for
 * another site's row -- and a generic message for everything else. Raw
 * PostgREST messages quote table and column names and must never reach a page.
 */
export function toRenderable(error: unknown): { kind: 'not-found' | 'error' | 'forbidden'; message: string } {
  if (error instanceof ApiError) {
    if (error.code === 'NOT_FOUND') {
      return { kind: 'not-found', message: 'That record does not exist, or is not yours to view.' };
    }
    if (error.code === 'FORBIDDEN') {
      return { kind: 'forbidden', message: error.message };
    }
    return { kind: 'error', message: 'Buildora could not load this right now.' };
  }
  return { kind: 'error', message: 'Buildora could not load this right now.' };
}
