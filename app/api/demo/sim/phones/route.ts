import { z } from 'zod';

import { SimPhoneSchema, type SimPhone } from '@/contracts';
import { withApi } from '@/lib/security/api';
import { fromPostgrest } from '@/lib/domain/errors';
import { requireDemoMode } from '@/lib/demo/guard';

/**
 * GET /api/demo/sim/phones
 *
 * The roster as a set of "SIM phones" -- the numbers a demo can send from and
 * receive on. Derived from `public.workers` for the caller's own site and run
 * under the same RLS as every other read, so it cannot expose another site's
 * crew.
 *
 * Reports `shared` because a shared phone is a first-class case in this schema
 * (`workers.phone_e164` is deliberately not unique), not an edge case to hide.
 */
const Response = z.object({ items: z.array(SimPhoneSchema) });

export const GET = withApi({
  response: Response,
  async handler({ db, user }) {
    requireDemoMode();

    const { data, error } = await db
      .from('workers')
      .select('id, full_name, phone_e164, worker_code, active')
      .eq('site_id', user.siteId)
      .eq('active', true)
      .order('full_name');

    if (error) throw fromPostgrest(error);

    const workers = data ?? [];
    const perPhone = new Map<string, number>();
    for (const worker of workers) {
      perPhone.set(worker.phone_e164, (perPhone.get(worker.phone_e164) ?? 0) + 1);
    }

    const items: SimPhone[] = workers.map((worker) => ({
      label: worker.worker_code
        ? `${worker.full_name} · ${worker.worker_code}`
        : worker.full_name,
      phone: worker.phone_e164 as SimPhone['phone'],
      workerId: worker.id,
      workerName: worker.full_name,
      shared: (perPhone.get(worker.phone_e164) ?? 0) > 1,
    }));

    return { items };
  },
});
