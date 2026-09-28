import { z } from 'zod';
import { HazardStatusSchema, HazardCategorySchema, SeveritySchema, IdSchema, TimestampSchema } from './common';

export const HazardOwnerSchema = z.object({
  type: z.enum(['worker', 'staff']),
  id: IdSchema,
  name: z.string(),
});
export type HazardOwner = z.infer<typeof HazardOwnerSchema>;

export const HazardSchema = z.object({
  id: IdSchema,
  /** Short human code, e.g. 'HZ-014'. */
  code: z.string(),
  category: HazardCategorySchema,
  locationText: z.string().nullable(),
  /** null until triaged by staff. */
  severity: SeveritySchema.nullable(),
  summary: z.string(),
  status: HazardStatusSchema,
  owner: HazardOwnerSchema.nullable(),
  dueAt: TimestampSchema.nullable(),
  reporterCount: z.number().int().positive(),
  createdAt: TimestampSchema,
  /** null when AI was not involved in the summary. */
  aiStatus: z.enum(['ok', 'fallback']).nullable(),
  possibleDuplicate: z.object({ id: IdSchema, code: z.string() }).nullable(),
});
export type Hazard = z.infer<typeof HazardSchema>;

export const HazardReportSchema = z.object({
  id: IdSchema,
  reporterName: z.string().nullable(),
  /** True when the reporter phone could not be matched to a worker. */
  unverifiedReporter: z.boolean(),
  transcript: z.string().nullable(),
  /** Signed, short-lived URL. */
  audioUrl: z.string().url().nullable(),
  receivedAt: TimestampSchema,
});
export type HazardReport = z.infer<typeof HazardReportSchema>;

export const HazardPhotoSchema = z.object({
  id: IdSchema,
  /** Signed, short-lived URL. */
  url: z.string().url(),
  uploadedAt: TimestampSchema,
});
export type HazardPhoto = z.infer<typeof HazardPhotoSchema>;

export const HazardHistoryEntrySchema = z.object({
  action: z.string(),
  at: TimestampSchema,
  actorName: z.string(),
});
export type HazardHistoryEntry = z.infer<typeof HazardHistoryEntrySchema>;

export const HazardDetailSchema = HazardSchema.extend({
  reports: z.array(HazardReportSchema),
  photos: z.array(HazardPhotoSchema),
  history: z.array(HazardHistoryEntrySchema),
});
export type HazardDetail = z.infer<typeof HazardDetailSchema>;

export const PatchHazardRequestSchema = z.object({
  severity: SeveritySchema.optional(),
  category: HazardCategorySchema.optional(),
  locationText: z.string().max(200).optional(),
  summary: z.string().min(1).max(500).optional(),
  owner: z.object({ type: z.enum(['worker', 'staff']), id: IdSchema }).optional(),
  dueAt: TimestampSchema.optional(),
  /** Merge this hazard into the target and archive the source. */
  mergeIntoId: IdSchema.optional(),
});
export type PatchHazardRequest = z.infer<typeof PatchHazardRequestSchema>;

export const PhotoUrlRequestSchema = z.object({
  mime: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  bytes: z.number().int().positive().max(8_000_000),
});
export type PhotoUrlRequest = z.infer<typeof PhotoUrlRequestSchema>;

export const PhotoUrlResponseSchema = z.object({
  uploadUrl: z.string().url(),
  /** Single-use token to be presented to POST /hazards/:id/fix. */
  photoToken: z.string(),
  expiresAt: TimestampSchema,
});
export type PhotoUrlResponse = z.infer<typeof PhotoUrlResponseSchema>;

export const FixHazardRequestSchema = z.object({
  photoToken: z.string(),
});
export type FixHazardRequest = z.infer<typeof FixHazardRequestSchema>;
