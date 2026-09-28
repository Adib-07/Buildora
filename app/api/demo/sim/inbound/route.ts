import { SimInboundRequestSchema, emptyResponse } from '@/contracts';
import { withApi } from '@/lib/security/api';
import { fromPostgrest } from '@/lib/domain/errors';
import { requireDemoMode, DEMO_PROVIDER_PREFIX } from '@/lib/demo/guard';

/**
 * POST /api/demo/sim/inbound
 *
 * Stands in for the SMS/voice gateway: writes a worker's reply into
 * `public.inbound_messages` exactly as the real webhook would, so the demo
 * cannot diverge from the production processing path.
 *
 * `auth: false` is correct and is why `requireDemoMode()` is the only thing
 * between the internet and this insert. It runs first, and it is server-side,
 * so a client cannot enable it.
 *
 * `processed_at` is deliberately left null: the worker-side gateway is not
 * connected yet, and filling it in would show a demo a confirmation that came
 * from a pipeline this codebase does not contain.
 */
export const POST = withApi({
  auth: false,
  body: SimInboundRequestSchema,
  response: emptyResponse,
  async handler({ db, input }) {
    requireDemoMode();

    const { from, kind, text, line } = input.body!;

    const { error } = await db.from('inbound_messages').insert({
      // site_id stays null: the gateway does not know the site until the number
      // is resolved, and resolution belongs to the processing pipeline.
      from_phone: from,
      kind,
      text: text ?? null,
      line: line ?? null,
      // The `demo:` marker is what makes POST /api/demo/reset safe -- it deletes
      // exactly the rows this route created and cannot reach a real worker's
      // message. provider_msg_id also carries a unique index, so a double click
      // cannot insert twice.
      provider_msg_id: `${DEMO_PROVIDER_PREFIX}${crypto.randomUUID()}`,
    });

    if (error) throw fromPostgrest(error);

    return {};
  },
});
