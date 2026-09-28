import { z } from 'zod';
import { ClockSchema, IdSchema, TimestampSchema, RoleSchema } from './common';

export const LoginRequestSchema = z.object({
  email: z.email(),
  password: z.string().min(1).max(200),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const MeSchema = z.object({
  staffId: IdSchema,
  name: z.string(),
  role: RoleSchema,
  siteId: IdSchema,
  siteName: z.string(),
  timezone: z.string(),
  shiftEnd: ClockSchema,
  summaryCutoff: ClockSchema,
  demoMode: z.boolean(),
  serverNow: TimestampSchema,
});
export type Me = z.infer<typeof MeSchema>;
