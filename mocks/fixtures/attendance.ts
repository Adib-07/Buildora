import type { AttendanceRecord, AttStatus, WorkerState } from "@/contracts";

import { TODAY } from "./site";
import { WORKERS, WORKERS_BY_SLUG } from "./workers";

// ~07:45 IST, when this morning's roll-call was submitted.
const ROLL_CALL_AT = `${TODAY}T02:15:00.000Z`;

type Override = { status?: AttStatus; hours?: number; late?: boolean; workerState: WorkerState };

/**
 * Lakshmi is the one dispute — the same worker and story used in the /dev/ui
 * kitchen sink, so the fixture data and the component demo agree. 20 workers
 * are confirmed, with a little variety (late, half-day, absent) so the list
 * isn't 36 identical rows; everyone else defaults to no_reply below, which
 * comes to exactly 15.
 */
const OVERRIDES: Record<string, Override> = {
  lakshmi: { status: "present", hours: 8, late: false, workerState: "disputed" },

  ramesh: { workerState: "confirmed" },
  srinivas: { workerState: "confirmed" },
  nagaraju: { workerState: "confirmed" },
  prasad: { workerState: "confirmed", late: true },
  mallesh: { workerState: "confirmed" },
  chandra: { workerState: "confirmed" },
  "venkateswara-rao": { workerState: "confirmed" },
  ravindra: { workerState: "confirmed" },
  narsimha: { workerState: "confirmed", status: "half_day", hours: 4 },
  satish: { workerState: "confirmed" },
  padma: { workerState: "confirmed" },
  anitha: { workerState: "confirmed" },
  sudhakar: { workerState: "confirmed", late: true },
  kanakamma: { workerState: "confirmed" },
  venkat: { workerState: "confirmed" },
  bhaskar: { workerState: "confirmed" },
  krishna: { workerState: "confirmed" },
  suresh: { workerState: "confirmed" },
  kiran: { workerState: "confirmed" },
  vijaya: { workerState: "confirmed", status: "absent", hours: 0 },
};

export const ATTENDANCE: AttendanceRecord[] = Object.entries(WORKERS_BY_SLUG).map(([slug, worker]) => {
  const override = OVERRIDES[slug];
  return {
    id: worker.id,
    workerId: worker.id,
    workerName: worker.fullName,
    teamName: worker.teamName,
    status: override?.status ?? "present",
    late: override?.late ?? false,
    hours: override?.hours ?? 8,
    version: 1,
    workerState: override?.workerState ?? "no_reply",
    updatedAt: ROLL_CALL_AT,
  };
});

export const ATTENDANCE_COUNTS = {
  total: WORKERS.length,
  confirmed: ATTENDANCE.filter((r) => r.workerState === "confirmed").length,
  disputed: ATTENDANCE.filter((r) => r.workerState === "disputed").length,
  noReply: ATTENDANCE.filter((r) => r.workerState === "no_reply").length,
};
