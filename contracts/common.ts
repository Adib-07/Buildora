import { z } from 'zod';

export const RoleSchema = z.enum(['supervisor', 'engineer', 'owner']);
export type Role = z.infer<typeof RoleSchema>;

export const LangSchema = z.enum(['en', 'te', 'hi']);
export type Lang = z.infer<typeof LangSchema>;

export const AttStatusSchema = z.enum(['present', 'absent', 'half_day']);
export type AttStatus = z.infer<typeof AttStatusSchema>;

export const WorkerStateSchema = z.enum(['no_reply', 'confirmed', 'disputed']);
export type WorkerState = z.infer<typeof WorkerStateSchema>;

export const DisputeStatusSchema = z.enum(['open', 'corrected', 'upheld', 'escalated']);
export type DisputeStatus = z.infer<typeof DisputeStatusSchema>;

export const HazardStatusSchema = z.enum([
  'reported',
  'assigned',
  'fixed_awaiting_reporter',
  'closed',
  'closed_unverified',
  'reopened',
]);
export type HazardStatus = z.infer<typeof HazardStatusSchema>;

export const HazardCategorySchema = z.enum([
  'fall_edge',
  'electrical',
  'excavation',
  'scaffold',
  'machinery',
  'fire',
  'housekeeping',
  'other',
]);
export type HazardCategory = z.infer<typeof HazardCategorySchema>;

export const SeveritySchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);
export type Severity = z.infer<typeof SeveritySchema>;

export const ChannelSchema = z.enum(['sms', 'missed_call', 'voice', 'simulator', 'kiosk']);
export type Channel = z.infer<typeof ChannelSchema>;

export const DateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export type DateOnly = z.infer<typeof DateOnlySchema>;

export const PhoneSchema = z.string().regex(/^\+91\d{10}$/);
export type Phone = z.infer<typeof PhoneSchema>;

export const HoursSchema = z.number().min(0).max(16).multipleOf(0.5);
export type Hours = z.infer<typeof HoursSchema>;

export const IdSchema = z.string().uuid();
export type Id = z.infer<typeof IdSchema>;

export const TimestampSchema = z.iso.datetime();
export type Timestamp = z.infer<typeof TimestampSchema>;

export const ClockSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export type Clock = z.infer<typeof ClockSchema>;

/** '+919876543210' -> '+91XXXXXX3210'. Last 4 digits are kept for recognition. */
export function maskedPhone(phone: string): string {
  return phone.replace(/^(\+91)\d{6}(\d{4})$/, '$1XXXXXX$2');
}

export function PageSchema<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    items: z.array(itemSchema),
    nextCursor: z.string().nullable(),
  });
}
export type Page<T> = { items: T[]; nextCursor: string | null };

export const ErrorCodeSchema = z.enum([
  'VALIDATION',
  'MALFORMED',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'VERSION_CONFLICT',
  'BAD_TRANSITION',
  'DAY_LOCKED',
  'PAYLOAD_TOO_LARGE',
  'RATE_LIMITED',
  'PHOTO_REUSED',
  'PHOTO_INVALID',
  'DEPENDENCY_DOWN',
  'INTERNAL',
]);
export type ErrorCode = z.infer<typeof ErrorCodeSchema>;

export const ErrorResponseSchema = z.object({
  error: z.object({
    code: ErrorCodeSchema,
    message: z.string(),
    fields: z.record(z.string(), z.string()).optional(),
  }),
  requestId: z.string(),
});
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

export const errorStatus: Record<ErrorCode, number> = {
  VALIDATION: 422,
  MALFORMED: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VERSION_CONFLICT: 409,
  BAD_TRANSITION: 409,
  DAY_LOCKED: 423,
  PAYLOAD_TOO_LARGE: 413,
  RATE_LIMITED: 429,
  PHOTO_REUSED: 422,
  PHOTO_INVALID: 422,
  DEPENDENCY_DOWN: 503,
  INTERNAL: 500,
};