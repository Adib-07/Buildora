import { cookies } from 'next/headers';
import { z } from 'zod';

import {
  createSessionClient,
  cookieStoreFromNext,
} from '@/lib/auth/session';
import { ApiError, withApi } from '@/lib/security/api';

const EmptySchema = z.object({});

/**
 * POST /api/v1/auth/logout
 *
 * Clears the session on both sides: the Supabase Auth session and the
 * httpOnly cookies holding it.
 */
export const POST = withApi({
  response: EmptySchema,
  async handler() {
    const supabase = createSessionClient(cookieStoreFromNext(await cookies()));
    const { error } = await supabase.auth.signOut();
    if (error) throw new ApiError('INTERNAL', 'Could not end the session.');
    return {};
  },
});
