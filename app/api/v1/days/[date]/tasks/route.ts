import { z } from 'zod';

import { TaskSchema } from '@/contracts';
import { listDayTasks } from '@/lib/domain/tasks';
import { routeDate } from '@/lib/domain/params';
import { withApi } from '@/lib/security/api';

const Response = z.object({ items: z.array(TaskSchema) });

/** GET /api/v1/days/:date/tasks */
export const GET = withApi({
  response: Response,
  async handler({ db, user, params }) {
    return { items: await listDayTasks(db, user.siteId, routeDate(params)) };
  },
});
