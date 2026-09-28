import { emptyResponse } from '@/contracts';
import { withApi } from '@/lib/security/api';
import { fromPostgrest } from '@/lib/domain/errors';
import { requireDemoMode, DEMO_PROVIDER_PREFIX } from '@/lib/demo/guard';

/**
 * POST /api/demo/reset
 *
 * Returns the site to its seeded starting state so a demo can be run again, so
 * the second and third run are identical to the first. Without it a judge who
 * locks the day has left the next judge nothing to look at.
 *
 * Exactly what it touches, and why it is safe to run against a real database:
 *
 *   - inbound_messages tagged `demo:`  -- only rows POST /sim/inbound created.
 *     `provider_msg_id like 'demo:%'` cannot match a message a real worker sent.
 *   - work_days locked within the last hour -- a day locked during the demo.
 *     The seeded locked day is older, so it survives.
 *   - sites.demo_now -- set back to NULL, restoring the real clock.
 *
 * It does not touch attendance records, confirmations or disputes. Those are
 * the product's audit trail, and a demo that rewrites them would be
 * demonstrating something the product does not do.
 */
export const POST = withApi({
  response: emptyResponse,
  async handler({ writer, user }) {
    requireDemoMode();

    const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const { error: messagesError } = await writer
      .from('inbound_messages')
      .delete()
      .like('provider_msg_id', `${DEMO_PROVIDER_PREFIX}%`);

    if (messagesError) throw fromPostgrest(messagesError);

    const { error: unlockError } = await writer
      .from('work_days')
      .update({ locked_at: null })
      .eq('site_id', user.siteId)
      .gt('locked_at', hourAgo);

    if (unlockError) throw fromPostgrest(unlockError);

    const { error: clockError } = await writer
      .from('sites')
      .update({ demo_now: null })
      .eq('id', user.siteId);

    if (clockError) throw fromPostgrest(clockError);

    return {};
  },
});
