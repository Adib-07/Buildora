import { z } from 'zod';
import { DisputeStatusSchema, AttStatusSchema, HoursSchema, IdSchema, TimestampSchema } from './common';

export const DisputeRecordSnapshotSchema = z.object({
  status: AttStatusSchema,
  hours: HoursSchema,
  late: z.boolean(),
});
export type DisputeRecordSnapshot = z.infer<typeof DisputeRecordSnapshotSchema>;

export const DisputeSchema = z.object({
  id: IdSchema,
  recordId: IdSchema,
  workerId: IdSchema,
  workerName: z.string(),
  /** Record version this dispute is bound to. */
  recordVersion: z.number().int().positive(),
  status: DisputeStatusSchema,
  reasonText: z.string().nullable(),
  createdAt: TimestampSchema,
  resolvedAt: TimestampSchema.nullable(),
  resolutionNote: z.string().nullable(),
  record: DisputeRecordSnapshotSchema,
});
export type Dispute = z.infer<typeof DisputeSchema>;

export const DisputeHistoryEntrySchema = z.object({
  version: z.number().int().positive(),
  status: AttStatusSchema,
  hours: HoursSchema,
  changedAt: TimestampSchema,
  reason: z.string().nullable(),
});
export type DisputeHistoryEntry = z.infer<typeof DisputeHistoryEntrySchema>;

export const DisputeDetailSchema = DisputeSchema.extend({
  /** Signed, short-lived URL for the worker's voice reason. */
  reasonAudioUrl: z.string().url().nullable(),
  history: z.array(DisputeHistoryEntrySchema),
});
export type DisputeDetail = z.infer<typeof DisputeDetailSchema>;

export const ResolveDisputeRequestSchema = z.discriminatedUnion('outcome', [
  z.object({
    outcome: z.literal('corrected'),
    status: AttStatusSchema,
    hours: HoursSchema,
    late: z.boolean(),
    note: z.string().max(200).optional(),
  }),
  z.object({
    outcome: z.literal('upheld'),
    note: z.string().min(3).max(200),
  }),
]);
export type ResolveDisputeRequest = z.infer<typeof ResolveDisputeRequestSchema>;
