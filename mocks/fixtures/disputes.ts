import type { DisputeDetail } from "@/contracts";

import { fixtureId } from "./ids";
import { WORKERS_BY_SLUG } from "./workers";

const lakshmi = WORKERS_BY_SLUG.lakshmi;

/**
 * The one open dispute the Today counts promise. DisputeDetail is a
 * superset of the list-shaped Dispute, so /s/today's pinned card and
 * /s/disputes/[id]'s full view can both read from this one fixture.
 */
export const DISPUTES: DisputeDetail[] = [
  {
    id: fixtureId("dispute-lakshmi"),
    recordId: lakshmi.id,
    workerId: lakshmi.id,
    workerName: lakshmi.fullName,
    recordVersion: 1,
    status: "open",
    reasonText: "I was here by 8, just late to reply.",
    reasonAudioUrl: null,
    createdAt: "2026-09-28T04:40:00.000Z",
    resolvedAt: null,
    resolutionNote: null,
    record: { status: "present", hours: 8, late: false },
    history: [{ version: 1, status: "present", hours: 8, changedAt: "2026-09-28T02:15:00.000Z", reason: null }],
  },
];
