import { z } from 'zod';
import { DateOnlySchema, DisputeStatusSchema, HazardStatusSchema, SeveritySchema, TimestampSchema } from './common';

export const DaySummarySchema = z.object({
  date: DateOnlySchema,
  locked: z.boolean(),
  lockedAt: TimestampSchema.nullable(),
  revision: z.number().int().positive(),
  /** True when the summary was regenerated after the day was already sent out. */
  amended: z.boolean(),
  counts: z.object({
    total: z.number().int().nonnegative(),
    confirmed: z.number().int().nonnegative(),
    disputed: z.number().int().nonnegative(),
    noReply: z.number().int().nonnegative(),
    disputesOpen: z.number().int().nonnegative(),
    disputesResolved: z.number().int().nonnegative(),
  }),
  byTeam: z.array(
    z.object({
      teamName: z.string(),
      total: z.number().int().nonnegative(),
      confirmed: z.number().int().nonnegative(),
      disputed: z.number().int().nonnegative(),
      noReply: z.number().int().nonnegative(),
    })
  ),
  disputes: z.array(
    z.object({
      workerName: z.string(),
      outcome: DisputeStatusSchema,
      note: z.string().nullable(),
    })
  ),
  tasks: z.array(
    z.object({
      title: z.string(),
      ownerName: z.string(),
    })
  ),
  hazards: z.object({
    opened: z.number().int().nonnegative(),
    closed: z.number().int().nonnegative(),
    open: z.number().int().nonnegative(),
    untriaged: z.number().int().nonnegative(),
    items: z.array(
      z.object({
        code: z.string(),
        summary: z.string(),
        severity: SeveritySchema.nullable(),
        status: HazardStatusSchema,
        photoUrl: z.string().url().nullable(),
      })
    ),
  }),
  trend: z.array(
    z.object({
      date: DateOnlySchema,
      /** confirmed / total, 0-1. Zero total yields 0. */
      confirmationRate: z.number().min(0).max(1),
    })
  ),
  /** AI-drafted prose; always render as escaped plain text. */
  narrative: z.string().nullable(),
});
export type DaySummary = z.infer<typeof DaySummarySchema>;
