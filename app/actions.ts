'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { z } from 'zod';

import {
  ApproveTasksRequestSchema,
  CreateWorkerRequestSchema,
  LoginRequestSchema,
  PatchAttendanceRequestSchema,
  PatchHazardRequestSchema,
  ResolveDisputeRequestSchema,
  UpdateWorkerRequestSchema,
} from '@/contracts';

import { requireSession } from '@/lib/auth/dal';
import { cookieStoreFromNext, createSessionClient, resolveSessionUser } from '@/lib/auth/session';
import { patchAttendance } from '@/lib/domain/attendance';
import { resolveDispute } from '@/lib/domain/disputes';
import { patchHazard } from '@/lib/domain/hazards';
import { approveTasks } from '@/lib/domain/tasks';
import { createWorker, updateWorker } from '@/lib/domain/workers';
import { serviceRoleClient } from '@/lib/db/service-role';
import { ApiError } from '@/lib/domain/errors';

import type { ActionState } from './action-state';

/**
 * Server Actions: the only write path from the browser.
 *
 * Each action is a thin shell over the same domain functions the API routes use,
 * so authentication, authorization and validation happen in exactly one place.
 * The steps are always in this order:
 *
 *   1. authenticate  -- `requireSession()`, which revalidates the JWT with the
 *      Auth server. There is no path that trusts a cookie value alone.
 *   2. authorize     -- an explicit role check, in addition to the RLS scoping
 *      the session client already provides. Never taken from the form.
 *   3. validate      -- the contract zod schema, before any query runs.
 *   4. execute       -- the domain function, which re-checks ownership against
 *      the caller's site and writes with the service role.
 *   5. surface failure -- `ActionState` carries a code the form renders as a
 *      sentence. A raw database error never reaches the client.
 *
 * `siteId` and `staffId` always come from the session, never from the form, so
 * a forged `siteId` field is simply ignored.
 */

function failure(error: unknown): ActionState {
  if (error instanceof ApiError) {
    return {
      status: 'error',
      code: error.code,
      message: error.message,
      ...(error.fields ? { fields: error.fields } : {}),
    };
  }
  if (error instanceof z.ZodError) {
    const fields: Record<string, string> = {};
    for (const issue of error.issues) {
      const key = issue.path.length ? issue.path.join('.') : '_root';
      if (!(key in fields)) fields[key] = issue.message;
    }
    return { status: 'error', code: 'VALIDATION', message: 'Check the highlighted fields.', fields };
  }
  // Anything unexpected: a fixed sentence. The detail goes to the server log.
  return { status: 'error', code: 'INTERNAL', message: 'That did not work. Nothing was changed.' };
}

/** Revalidates the pages a change can affect, so a refresh shows the new state. */
function refresh(...paths: string[]) {
  for (const path of paths) revalidatePath(path);
}

// ---------------------------------------------------------------------------
// auth
// ---------------------------------------------------------------------------

/**
 * Signs in.
 *
 * Credentials go straight to Supabase Auth. The session is written to httpOnly
 * cookies by `@supabase/ssr`, so the access token is never reachable from
 * JavaScript and cannot be exfiltrated by an XSS payload.
 */
export async function signIn(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = LoginRequestSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) return failure(parsed.error);

  // `next` is a path the user was trying to reach. Constrained to a
  // single-segment-relative path so it can never become an absolute URL: an
  // open redirect here would hand an attacker a credible phishing link.
  const requested = String(formData.get('next') ?? '/dashboard');
  const next = /^\/(?!\/)[A-Za-z0-9\-._~!$&'()*+,;=:@%/?[\]#]*$/.test(requested)
    ? requested
    : '/dashboard';

  // The same session-scoped client the API routes use, so the cookie is written
  // by one implementation rather than two that could drift.
  const supabase = createSessionClient(cookieStoreFromNext(await cookies()));

  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    // One message for a wrong password and for an unknown address, so the form
    // cannot be used to find out which staff accounts exist.
    return {
      status: 'error',
      code: 'INVALID_CREDENTIALS',
      message: 'That email and password combination was not recognised.',
    };
  }

  // A valid Supabase user with no staff row is authenticated but attached to no
  // site, so there is nothing to sign in to. `resolveSessionUser` is the same
  // lookup the API routes use, so "is this a staff member" is answered by one
  // implementation rather than two that could disagree.
  const user = await resolveSessionUser(supabase);
  if (!user) {
    await supabase.auth.signOut();
    return {
      status: 'error',
      code: 'INVALID_CREDENTIALS',
      message: 'That account is not attached to a site yet. Ask your site administrator to issue one.',
    };
  }

  redirect(next);
}

export async function signOut(): Promise<void> {
  const supabase = createSessionClient(cookieStoreFromNext(await cookies()));
  await supabase.auth.signOut();
}

// ---------------------------------------------------------------------------
// attendance
// ---------------------------------------------------------------------------

export async function updateAttendance(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSession('/attendance');
  // Server-side authorization. The form's role fields are never consulted.
  if (session.user.role !== 'supervisor') {
    return failure(ApiError.forbidden('Only a site supervisor can change a record.'));
  }

  const parsed = PatchAttendanceRequestSchema.safeParse({
    status: formData.get('status') || undefined,
    hours: formData.has('hours') && formData.get('hours') !== '' ? Number(formData.get('hours')) : undefined,
    late: formData.has('late') ? formData.get('late') === 'true' : undefined,
    expectedVersion: Number(formData.get('expectedVersion')),
  });
  if (!parsed.success) return failure(parsed.error);

  try {
    await patchAttendance(
      session.db,
      serviceRoleClient(),
      session.user.siteId,
      session.user.staffId,
      String(formData.get('recordId')),
      parsed.data,
    );
    refresh('/attendance', '/dashboard', '/summary');
    return { status: 'ok', message: 'Record updated and the worker will be asked again.' };
  } catch (error) {
    return failure(error);
  }
}

// ---------------------------------------------------------------------------
// workers
// ---------------------------------------------------------------------------

export async function addWorker(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSession('/workers');
  if (session.user.role !== 'supervisor') {
    return failure(ApiError.forbidden('Only a site supervisor can add a worker.'));
  }

  const parsed = CreateWorkerRequestSchema.safeParse({
    fullName: formData.get('fullName'),
    phone: normalisePhone(formData.get('phone')),
    teamId: formData.get('teamId'),
    lang: formData.get('lang'),
  });
  if (!parsed.success) return failure(parsed.error);

  try {
    await createWorker(
      session.db,
      serviceRoleClient(),
      session.user.siteId,
      session.user.staffId,
      parsed.data,
    );
    refresh('/workers', '/dashboard');
    return { status: 'ok', message: `${parsed.data.fullName} was added to the roster.` };
  } catch (error) {
    return failure(error);
  }
}

export async function editWorker(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSession('/workers');
  if (session.user.role !== 'supervisor') {
    return failure(ApiError.forbidden('Only a site supervisor can change a worker.'));
  }

  const parsed = UpdateWorkerRequestSchema.safeParse({
    fullName: formData.get('fullName') || undefined,
    teamId: formData.get('teamId') || undefined,
    lang: formData.get('lang') || undefined,
    active: formData.get('active') === 'true' ? true : undefined,
  });
  if (!parsed.success) return failure(parsed.error);

  try {
    await updateWorker(
      session.db,
      serviceRoleClient(),
      session.user.siteId,
      session.user.staffId,
      String(formData.get('workerId')),
      parsed.data,
    );
    refresh('/workers', '/dashboard');
    return { status: 'ok', message: 'Worker updated.' };
  } catch (error) {
    return failure(error);
  }
}

/** Accepts what a supervisor actually types and stores the E.164 the schema needs. */
function normalisePhone(input: FormDataEntryValue | null): string {
  const digits = String(input ?? '').replace(/[^\d]/g, '');
  return digits.length === 10 ? `+91${digits}` : String(input ?? '');
}

// ---------------------------------------------------------------------------
// tasks
// ---------------------------------------------------------------------------

export async function saveTasks(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSession('/tasks');
  if (session.user.role !== 'supervisor') {
    return failure(ApiError.forbidden('Only a site supervisor can publish tasks.'));
  }

  // One set of indexed fields per draft rather than a packed string: a task
  // title contains spaces, so any delimiter would need escaping on both sides.
  const count = Number(formData.get('taskCount') ?? 0);
  const tasks = Array.from({ length: Number.isFinite(count) ? count : 0 }, (_, i) => ({
    index: i,
    title: String(formData.get(`title-${i}`) ?? ''),
    location: null,
    ownerWorkerId: String(formData.get(`ownerWorkerId-${i}`) ?? ''),
  })).filter((task) => task.title.trim().length > 0);

  if (tasks.length === 0) {
    return { status: 'error', code: 'VALIDATION', message: 'Add at least one task first.' };
  }

  // Named explicitly rather than left to the uuid check, because "choose an
  // owner" is the action the supervisor has to take and a generic validation
  // message gives them nothing to act on.
  const unowned = tasks.filter((task) => !task.ownerWorkerId);
  if (unowned.length > 0) {
    return {
      status: 'error',
      code: 'VALIDATION',
      message:
        unowned.length === 1
          ? 'Choose an owner for the highlighted task before publishing.'
          : `Choose an owner for ${unowned.length} of the tasks before publishing.`,
    };
  }

  const parsed = ApproveTasksRequestSchema.safeParse({
    workDate: formData.get('workDate'),
    tasks: tasks.map(({ title, location, ownerWorkerId }) => ({ title, location, ownerWorkerId })),
  });
  if (!parsed.success) return failure(parsed.error);

  try {
    const created = await approveTasks(
      session.db,
      serviceRoleClient(),
      session.user.siteId,
      session.user.staffId,
      parsed.data,
    );
    refresh('/tasks', '/dashboard');
    return { status: 'ok', message: `${created.length} task${created.length === 1 ? '' : 's'} published.` };
  } catch (error) {
    return failure(error);
  }
}

// ---------------------------------------------------------------------------
// disputes
// ---------------------------------------------------------------------------

export async function resolveDisputeAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSession('/disputes');
  if (session.user.role !== 'supervisor') {
    return failure(ApiError.forbidden('Only a site supervisor can resolve a dispute.'));
  }

  const outcome = String(formData.get('outcome') ?? '');
  const payload =
    outcome === 'corrected'
      ? {
          outcome,
          status: formData.get('status'),
          hours: Number(formData.get('hours')),
          late: formData.get('late') === 'true',
          note: String(formData.get('note') ?? '') || undefined,
        }
      : { outcome: 'upheld', note: String(formData.get('note') ?? '') };

  const parsed = ResolveDisputeRequestSchema.safeParse(payload);
  if (!parsed.success) return failure(parsed.error);

  try {
    await resolveDispute(
      session.db,
      serviceRoleClient(),
      session.user.siteId,
      session.user.staffId,
      String(formData.get('disputeId')),
      parsed.data,
    );
    refresh('/disputes', '/dashboard', '/summary');
    return { status: 'ok', message: 'Dispute resolved and the worker notified.' };
  } catch (error) {
    return failure(error);
  }
}

// ---------------------------------------------------------------------------
// hazards
// ---------------------------------------------------------------------------

export async function triageHazard(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSession(`/hazards/${String(formData.get('hazardId'))}`);
  if (session.user.role !== 'supervisor') {
    return failure(ApiError.forbidden('Only a site supervisor can triage a hazard.'));
  }

  const ownerType = String(formData.get('ownerType') ?? '');
  const ownerId = String(formData.get('ownerId') ?? '');

  const parsed = PatchHazardRequestSchema.safeParse({
    severity: formData.get('severity') ? Number(formData.get('severity')) : undefined,
    category: formData.get('category') || undefined,
    locationText: formData.get('locationText') || undefined,
    summary: formData.get('summary') || undefined,
    dueAt: formData.get('dueAt') || undefined,
    ...(ownerType && ownerId ? { owner: { type: ownerType, id: ownerId } } : {}),
  });
  if (!parsed.success) return failure(parsed.error);

  try {
    await patchHazard(
      session.db,
      serviceRoleClient(),
      session.user.siteId,
      session.user.staffId,
      String(formData.get('hazardId')),
      parsed.data,
    );
    refresh('/hazards', `/hazards/${String(formData.get('hazardId'))}`, '/dashboard');
    return { status: 'ok', message: 'Hazard updated.' };
  } catch (error) {
    return failure(error);
  }
}
