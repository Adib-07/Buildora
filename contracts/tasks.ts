import { z } from 'zod';
import { DateOnlySchema, IdSchema, TimestampSchema } from './common';

export const TaskSchema = z.object({
  id: IdSchema,
  title: z.string(),
  location: z.string().nullable(),
  /** Exactly one owner is required for every task. */
  ownerWorkerId: IdSchema,
  ownerName: z.string(),
  source: z.enum(['voice', 'text']),
  createdAt: TimestampSchema,
});
export type Task = z.infer<typeof TaskSchema>;

export const TaskDraftOwnerCandidateSchema = z.object({
  workerId: IdSchema,
  name: z.string(),
});
export type TaskDraftOwnerCandidate = z.infer<typeof TaskDraftOwnerCandidateSchema>;

export const TaskDraftSchema = z.object({
  title: z.string(),
  location: z.string().max(60).nullable(),
  /** Raw name the AI heard; null when it matched a worker or no owner was spoken. */
  spokenOwnerName: z.string().nullable(),
  /** null when unresolved — supervisor must pick before approve. */
  ownerWorkerId: IdSchema.nullable(),
  ownerCandidates: z.array(TaskDraftOwnerCandidateSchema),
});
export type TaskDraft = z.infer<typeof TaskDraftSchema>;

export const TaskDraftRequestSchema = z.object({
  text: z.string().max(1000),
});
export type TaskDraftRequest = z.infer<typeof TaskDraftRequestSchema>;

/**
 * Audio variant of POST /api/v1/tasks/draft is multipart/form-data, NOT this JSON body:
 *   - field `audio`: audio/webm, audio/ogg or audio/mp4, max 2_000_000 bytes, max 60s duration
 *   - field `lang` (optional): 'en' | 'te'
 *   Responses use the same TaskDraftResponseSchema (transcript carries the recognised text).
 *   Failure modes: MALFORMED 400 (unsupported container), PAYLOAD_TOO_LARGE 413 (>2MB or >60s).
 */
export const TaskDraftResponseSchema = z.object({
  drafts: z.array(TaskDraftSchema),
  transcript: z.string().nullable(),
  unparsedText: z.string().nullable(),
  /** True when AI was unavailable/disabled and drafts came from a deterministic fallback. */
  fallback: z.boolean(),
});
export type TaskDraftResponse = z.infer<typeof TaskDraftResponseSchema>;

export const ApproveTaskSchema = z.object({
  title: z.string().min(3).max(120),
  location: z.string().max(60).nullable(),
  ownerWorkerId: IdSchema,
});
export type ApproveTask = z.infer<typeof ApproveTaskSchema>;

export const ApproveTasksRequestSchema = z.object({
  workDate: DateOnlySchema,
  tasks: z.array(ApproveTaskSchema).min(1).max(50),
});
export type ApproveTasksRequest = z.infer<typeof ApproveTasksRequestSchema>;
