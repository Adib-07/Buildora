import { z } from 'zod';
import { IdSchema, LangSchema, PhoneSchema } from './common';

export const TeamSchema = z.object({
  id: IdSchema,
  name: z.string(),
});
export type Team = z.infer<typeof TeamSchema>;

export const WorkerConsentSchema = z.enum(['pending', 'given', 'withdrawn']);
export type WorkerConsent = z.infer<typeof WorkerConsentSchema>;

export const WorkerSchema = z.object({
  id: IdSchema,
  fullName: z.string(),
  /** Masked for engineer/owner roles: '+91XXXXXX3210'. */
  phone: z.string(),
  /** Supervisor only; null for other roles. */
  workerCode: z.string().nullable(),
  teamId: IdSchema.nullable(),
  teamName: z.string().nullable(),
  lang: LangSchema,
  consent: WorkerConsentSchema,
  active: z.boolean(),
});
export type Worker = z.infer<typeof WorkerSchema>;

export const CreateWorkerRequestSchema = z.object({
  fullName: z.string().min(2).max(60),
  phone: PhoneSchema,
  teamId: IdSchema,
  lang: LangSchema,
});
export type CreateWorkerRequest = z.infer<typeof CreateWorkerRequestSchema>;

export const UpdateWorkerRequestSchema = z.object({
  fullName: z.string().min(2).max(60).optional(),
  phone: PhoneSchema.optional(),
  teamId: IdSchema.optional(),
  lang: LangSchema.optional(),
  active: z.boolean().optional(),
});
export type UpdateWorkerRequest = z.infer<typeof UpdateWorkerRequestSchema>;
