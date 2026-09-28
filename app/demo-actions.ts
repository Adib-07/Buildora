'use server';

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { z } from 'zod';

import { createSessionClient, cookieStoreFromNext } from '@/lib/auth/session';
import { isDemoMode } from '@/lib/config/env';

/**
 * One-click role access for demos.
 *
 * Signs in as one of the seeded demo accounts through the *real* authentication
 * path -- `signInWithPassword`, the same call `signIn` makes, writing the same
 * httpOnly cookie. It does not mint a session, set a role flag, or skip the
 * session check that every protected page makes.
 *
 * Why that matters: a launcher that skipped auth would show a judge a screen no
 * real user can reach, and it would sit one refactor away from being a genuine
 * authorisation bypass in a system whose entire tenant boundary is
 * "role and site come from the `staff` row". This way the three roles genuinely
 * have different permissions, because the database genuinely enforces it -- the
 * owner really can see the payroll summary and the engineer really cannot.
 *
 * Gated on DEMO_MODE, server-side. The credentials below are the ones in
 * `supabase/seed.sql`; they are worthless in production because production is
 * seeded by no one and DEMO_MODE is off.
 */

const RoleSchema = z.enum(['supervisor', 'engineer', 'owner']);

/**
 * The seeded accounts, keyed by the role they actually hold in `public.staff`.
 * Displayed openly on purpose: a demo that hides how you signed in teaches
 * nothing about the sign-in flow, which is the part that decides who sees a
 * site's data.
 */
const DEMO_ACCOUNTS = {
  supervisor: {
    email: 'supervisor@quarryridge.test',
    label: 'Supervisor',
    blurb: 'Shift settlement, attendance edits, task publishing, dispute decisions.',
    destination: '/attendance',
  },
  engineer: {
    email: 'engineer@quarryridge.test',
    label: 'Engineer',
    blurb: 'Day summary and payroll figures. Read-only on crew and disputes.',
    destination: '/summary',
  },
  owner: {
    email: 'owner@quarryridge.test',
    label: 'Owner',
    blurb: 'Financial reconciliation and audit export across the whole site.',
    destination: '/summary',
  },
} as const;

const DEMO_PASSWORD = 'buildora-dev-password';

export async function launchDemoRole(formData: FormData): Promise<void> {
  if (!isDemoMode()) {
    throw new Error('Demo mode is not enabled on this deployment.');
  }

  const parsed = RoleSchema.safeParse(formData.get('role'));
  if (!parsed.success) {
    throw new Error('Unknown demo role.');
  }

  const account = DEMO_ACCOUNTS[parsed.data];
  const supabase = createSessionClient(cookieStoreFromNext(await cookies()));

  const { error } = await supabase.auth.signInWithPassword({
    email: account.email,
    password: DEMO_PASSWORD,
  });

  // A failed demo sign-in is a real misconfiguration (seed not applied), not a
  // user error -- so it says exactly that instead of "invalid credentials".
  if (error) {
    throw new Error(
      'Could not sign in to the demo account. The database is reachable but the seed data is missing — run `pnpm db:reset`.',
    );
  }

  redirect(account.destination);
}

export async function demoAccountsAvailable(): Promise<boolean> {
  return isDemoMode();
}
