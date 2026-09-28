import { z } from 'zod';
import { IdSchema, PhoneSchema, TimestampSchema } from './common';

export const SimPhoneSchema = z.object({
  label: z.string(),
  phone: PhoneSchema,
  workerId: IdSchema,
  workerName: z.string(),
  /** True when several sim phones map to the same worker. */
  shared: z.boolean(),
});
export type SimPhone = z.infer<typeof SimPhoneSchema>;

export const SimMessageSchema = z.object({
  id: IdSchema,
  direction: z.enum(['in', 'out']),
  body: z.string(),
  /** null for free-text AI/inbound content; SMS templates always carry a key. */
  templateKey: z.string().nullable(),
  createdAt: TimestampSchema,
});
export type SimMessage = z.infer<typeof SimMessageSchema>;

export const SimInboundRequestSchema = z.object({
  from: PhoneSchema,
  kind: z.enum(['sms', 'missed_call', 'voice']),
  text: z.string().max(1000).optional(),
  line: z.enum(['confirm', 'hazard']).optional(),
});
export type SimInboundRequest = z.infer<typeof SimInboundRequestSchema>;
