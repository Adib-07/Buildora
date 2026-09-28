import { TaskDraftRequestSchema, TaskDraftResponseSchema } from '@/contracts';
import { fromPostgrest } from '@/lib/domain/errors';
import { draftTasksFromText } from '@/lib/domain/tasks';
import { withApi } from '@/lib/security/api';

/**
 * POST /api/v1/tasks/draft
 *
 * Turns a supervisor's note into draft tasks, each still missing an owner until
 * the supervisor confirms one. The JSON variant is the text path; the
 * multipart/audio variant described in contracts/tasks.ts is not implemented,
 * because it would need a speech-to-text provider this deployment does not
 * configure (AI_DISABLED=true). With AI disabled this route is the
 * deterministic fallback the contract specifies -- real parsing over the real
 * roster -- and `fallback: true` is reported so the UI can say so.
 */
export const POST = withApi({
  roles: ['supervisor'],
  body: TaskDraftRequestSchema,
  response: TaskDraftResponseSchema,
  async handler({ db, input }) {
    const { data, error } = await db
      .from('workers')
      .select('id, full_name, team_id, active')
      .eq('active', true);
    if (error) throw fromPostgrest(error);

    return draftTasksFromText(
      input.body.text,
      (data ?? []).map((row) => ({
        id: row.id,
        fullName: row.full_name,
        teamId: row.team_id,
        active: row.active,
      })),
    );
  },
});
