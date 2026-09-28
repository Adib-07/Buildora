import { z } from 'zod';
import { AttStatusSchema, WorkerStateSchema, DateOnlySchema, HoursSchema, IdSchema, TimestampSchema } from './common';

export const AttendanceRecordSchema = z.object({
  id: IdSchema,
  workerId: IdSchema,
  workerName: z.string(),
  teamName: z.string().nullable(),
  status: AttStatusSchema,
  late: z.boolean(),
  hours: HoursSchema,
  /** Bumped on every supervisor edit; drives optimistic concurrency. */
  version: z.number().int().positive(),
  workerState: WorkerStateSchema,
  updatedAt: TimestampSchema,
});
export type AttendanceRecord = z.infer<typeof AttendanceRecordSchema>;

export const DayAttendanceSchema = z.object({
  date: DateOnlySchema,
  locked: z.boolean(),
  lockedAt: TimestampSchema.nullable(),
  counts: z.object({
    total: z.number().int().nonnegative(),
    confirmed: z.number().int().nonnegative(),
    disputed: z.number().int().nonnegative(),
    noReply: z.number().int().nonnegative(),
  }),
  records: z.array(AttendanceRecordSchema),
});
export type DayAttendance = z.infer<typeof DayAttendanceSchema>;

export const PatchAttendanceRequestSchema = z
  .object({
    status: AttStatusSchema.optional(),
    hours: HoursSchema.optional(),
    late: z.boolean().optional(),
    expectedVersion: z.number().int().positive(),
  })
  .refine((v) => v.status !== undefined || v.hours !== undefined || v.late !== undefined, {
    message: 'At least one of status, hours, late is required',
  });
export type PatchAttendanceRequest = z.infer<typeof PatchAttendanceRequestSchema>;
