import { cookies } from 'next/headers';
import { z } from 'zod';

import { LoginRequestSchema, MeSchema } from '@/contracts';
import { isDemoMode } from '@/lib/config/env';
import { now } from '@/lib/domain/clock';
import {
  createSessionClient,
  cookieStoreFromNext,
  resolveSessionUser,
} from '@/lib/auth/session';
import { ApiError, withApi } from '@/lib/security/api';

const LoginResponseSchema = z.object({ token: z.string() }).extend(MeSchema.shape);

/** postgres `time` arrives as HH:MM:SS; the contract's ClockSchema wants HH:mm. */
function formatClock(value: string): string {
  return value.slice(0, 5);
}

/**
 * POST /api/v1/auth/login
 *
 * The only staff route with no role guard: it is how a caller obtains a role in
 * the first place. Credentials are verified by Supabase Auth; the site and role
 * in the response are read from `public.staff`, never from the request body.
 */
export const POST = withApi({
  auth: false,
  body: LoginRequestSchema,
  response: LoginResponseSchema,
  async handler({ input }) {
    const supabase = createSessionClient(cookieStoreFromNext(await cookies()));

    const { data, error } = await supabase.auth.signInWithPassword({
      email: input.body.email,
      password: input.body.password,
    });

    // A wrong password and an unknown address produce the same response, so the
    // endpoint cannot be used to enumerate staff accounts.
    if (error || !data.user) {
      throw ApiError.unauthorized('Invalid email or password.');
    }

    const user = await resolveSessionUser(supabase);
    if (!user) throw ApiError.unauthorized('Invalid email or password.');

    const { data: site, error: siteError } = await supabase
      .from('sites')
      .select('name, timezone, shift_end, summary_cutoff')
      .eq('id', user.siteId)
      .maybeSingle();

    if (siteError || !site) throw new ApiError('INTERNAL', 'Site lookup failed.');

    const serverNow = await now(supabase, user.siteId);

    return {
      token: data.session?.access_token ?? '',
      staffId: user.staffId,
      name: user.name,
      role: user.role,
      siteId: user.siteId,
      siteName: site.name,
      timezone: site.timezone,
      shiftEnd: formatClock(site.shift_end),
      summaryCutoff: formatClock(site.summary_cutoff),
      demoMode: isDemoMode(),
      serverNow: serverNow.toISOString(),
    };
  },
});
