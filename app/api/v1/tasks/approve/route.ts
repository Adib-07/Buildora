import { z } from 'zod';

import { ApproveTasksRequestSchema, TaskSchema } from '@/contracts';
import { approveTasks } from '@/lib/domain/tasks';
import { withApi } from '@/lib/security/api';

const Response = z.object({ items: z.array(TaskSchema) });

/**
 * POST /api/v1/tasks/approve
 *
 * The step that makes a draft a task. Every draft must arrive with an owner:
 * `owner_worker_id` is NOT NULL, so an unresolved owner cannot be persisted and
 * the supervisor has to pick one.
 */
export const POST = withApi({
  roles: ['supervisor'],
  body: ApproveTasksRequestSchema,
  response: Response,
  async handler({ db, writer, user, input }) {
    return { items: await approveTasks(db, writer, user.siteId, user.staffId, input.body) };
  },
});
