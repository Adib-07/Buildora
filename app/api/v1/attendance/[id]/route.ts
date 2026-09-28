import { AttendanceRecordSchema, PatchAttendanceRequestSchema } from '@/contracts';
import { patchAttendance } from '@/lib/domain/attendance';
import { routeId } from '@/lib/domain/params';
import { withApi } from '@/lib/security/api';

/**
 * PATCH /api/v1/attendance/:id
 *
 * Supervisor only: this is the site overriding what a worker was told, so it is
 * the site's decision to make. `expectedVersion` is mandatory and enforced as a
 * compare-and-swap in the UPDATE, which is what makes two supervisors editing
 * the same record safe.
 */
export const PATCH = withApi({
  roles: ['supervisor'],
  body: PatchAttendanceRequestSchema,
  response: AttendanceRecordSchema,
  async handler({ db, writer, user, params, input }) {
    return patchAttendance(db, writer, user.siteId, user.staffId, routeId(params), input.body);
  },
});
