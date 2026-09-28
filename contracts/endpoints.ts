import { z } from 'zod';

import { LoginRequestSchema, MeSchema } from './auth';
import { TeamSchema, WorkerSchema, CreateWorkerRequestSchema, UpdateWorkerRequestSchema } from './workers';
import { DayAttendanceSchema, AttendanceRecordSchema, PatchAttendanceRequestSchema } from './attendance';
import { TaskSchema, TaskDraftResponseSchema, TaskDraftRequestSchema, ApproveTasksRequestSchema } from './tasks';
import { DisputeSchema, DisputeDetailSchema, ResolveDisputeRequestSchema } from './disputes';
import {
  HazardSchema,
  HazardDetailSchema,
  PatchHazardRequestSchema,
  PhotoUrlRequestSchema,
  PhotoUrlResponseSchema,
  FixHazardRequestSchema,
} from './hazards';
import { DaySummarySchema } from './summaries';
import { SimPhoneSchema, SimMessageSchema, SimInboundRequestSchema } from './demo';
import { PageSchema, DateOnlySchema, PhoneSchema, ErrorResponseSchema } from './common';

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export type Endpoint = {
  method: HttpMethod;
  path: string;
  params?: Record<string, z.ZodType>;
  query?: Record<string, z.ZodType>;
  body?: z.ZodType;
  response: z.ZodType;
  errors: readonly string[];
};

const idParam = { id: z.string().uuid() };
const dateParam = { date: DateOnlySchema };
const emptyResponse = z.object({});

export const endpoints = {
  // ---- Auth ----
  'POST /auth/login': {
    method: 'POST',
    path: '/api/v1/auth/login',
    body: LoginRequestSchema,
    response: z.object({ token: z.string() }).extend(MeSchema.shape),
    errors: ['VALIDATION', 'UNAUTHORIZED', 'INTERNAL'],
  },
  'POST /auth/logout': {
    method: 'POST',
    path: '/api/v1/auth/logout',
    response: emptyResponse,
    errors: ['UNAUTHORIZED', 'INTERNAL'],
  },
  'GET /me': {
    method: 'GET',
    path: '/api/v1/me',
    response: MeSchema,
    errors: ['UNAUTHORIZED', 'INTERNAL'],
  },

  // ---- Teams & workers ----
  'GET /teams': {
    method: 'GET',
    path: '/api/v1/teams',
    response: z.object({ items: z.array(TeamSchema) }),
    errors: ['UNAUTHORIZED', 'INTERNAL'],
  },
  'GET /workers': {
    method: 'GET',
    path: '/api/v1/workers',
    query: { teamId: z.string().uuid().optional(), active: z.enum(['true', 'false']).optional() },
    response: PageSchema(WorkerSchema),
    errors: ['UNAUTHORIZED', 'INTERNAL'],
  },
  'POST /workers': {
    method: 'POST',
    path: '/api/v1/workers',
    body: CreateWorkerRequestSchema,
    response: WorkerSchema,
    errors: ['VALIDATION', 'UNAUTHORIZED', 'FORBIDDEN', 'INTERNAL'],
  },
  'PATCH /workers/:id': {
    method: 'PATCH',
    path: '/api/v1/workers/:id',
    params: idParam,
    body: UpdateWorkerRequestSchema,
    response: WorkerSchema,
    errors: ['VALIDATION', 'UNAUTHORIZED', 'FORBIDDEN', 'NOT_FOUND', 'INTERNAL'],
  },

  // ---- Attendance ----
  'GET /days/:date/attendance': {
    method: 'GET',
    path: '/api/v1/days/:date/attendance',
    params: dateParam,
    response: DayAttendanceSchema,
    errors: ['UNAUTHORIZED', 'NOT_FOUND', 'INTERNAL'],
  },
  'PATCH /attendance/:id': {
    method: 'PATCH',
    path: '/api/v1/attendance/:id',
    params: idParam,
    body: PatchAttendanceRequestSchema,
    response: AttendanceRecordSchema,
    errors: ['VALIDATION', 'UNAUTHORIZED', 'FORBIDDEN', 'NOT_FOUND', 'VERSION_CONFLICT', 'DAY_LOCKED', 'INTERNAL'],
  },

  // ---- Tasks ----
  'GET /days/:date/tasks': {
    method: 'GET',
    path: '/api/v1/days/:date/tasks',
    params: dateParam,
    response: z.object({ items: z.array(TaskSchema) }),
    errors: ['UNAUTHORIZED', 'NOT_FOUND', 'INTERNAL'],
  },
  'POST /tasks/draft': {
    method: 'POST',
    path: '/api/v1/tasks/draft',
    body: TaskDraftRequestSchema,
    response: TaskDraftResponseSchema,
    errors: ['VALIDATION', 'UNAUTHORIZED', 'FORBIDDEN', 'PAYLOAD_TOO_LARGE', 'DEPENDENCY_DOWN', 'INTERNAL'],
  },
  'POST /tasks/approve': {
    method: 'POST',
    path: '/api/v1/tasks/approve',
    body: ApproveTasksRequestSchema,
    response: z.object({ items: z.array(TaskSchema) }),
    errors: ['VALIDATION', 'UNAUTHORIZED', 'FORBIDDEN', 'DAY_LOCKED', 'INTERNAL'],
  },

  // ---- Disputes ----
  'GET /disputes': {
    method: 'GET',
    path: '/api/v1/disputes',
    query: { status: z.enum(['open', 'all']).optional() },
    response: z.object({ items: z.array(DisputeSchema) }),
    errors: ['UNAUTHORIZED', 'INTERNAL'],
  },
  'GET /disputes/:id': {
    method: 'GET',
    path: '/api/v1/disputes/:id',
    params: idParam,
    response: DisputeDetailSchema,
    errors: ['UNAUTHORIZED', 'NOT_FOUND', 'INTERNAL'],
  },
  'POST /disputes/:id/resolve': {
    method: 'POST',
    path: '/api/v1/disputes/:id/resolve',
    params: idParam,
    body: ResolveDisputeRequestSchema,
    response: DisputeSchema,
    errors: ['VALIDATION', 'UNAUTHORIZED', 'FORBIDDEN', 'NOT_FOUND', 'BAD_TRANSITION', 'INTERNAL'],
  },

  // ---- Hazards ----
  'GET /hazards': {
    method: 'GET',
    path: '/api/v1/hazards',
    query: {
      status: z.string().optional(),
      category: z.string().optional(),
      from: DateOnlySchema.optional(),
      to: DateOnlySchema.optional(),
    },
    response: PageSchema(HazardSchema),
    errors: ['UNAUTHORIZED', 'INTERNAL'],
  },
  'GET /hazards/:id': {
    method: 'GET',
    path: '/api/v1/hazards/:id',
    params: idParam,
    response: HazardDetailSchema,
    errors: ['UNAUTHORIZED', 'NOT_FOUND', 'INTERNAL'],
  },
  'PATCH /hazards/:id': {
    method: 'PATCH',
    path: '/api/v1/hazards/:id',
    params: idParam,
    body: PatchHazardRequestSchema,
    response: HazardSchema,
    errors: ['VALIDATION', 'UNAUTHORIZED', 'FORBIDDEN', 'NOT_FOUND', 'INTERNAL'],
  },
  'POST /hazards/:id/photo-url': {
    method: 'POST',
    path: '/api/v1/hazards/:id/photo-url',
    params: idParam,
    body: PhotoUrlRequestSchema,
    response: PhotoUrlResponseSchema,
    errors: ['VALIDATION', 'UNAUTHORIZED', 'FORBIDDEN', 'NOT_FOUND', 'PHOTO_INVALID', 'INTERNAL'],
  },
  'POST /hazards/:id/fix': {
    method: 'POST',
    path: '/api/v1/hazards/:id/fix',
    params: idParam,
    body: FixHazardRequestSchema,
    response: HazardSchema,
    errors: ['VALIDATION', 'UNAUTHORIZED', 'FORBIDDEN', 'NOT_FOUND', 'PHOTO_REUSED', 'PHOTO_INVALID', 'BAD_TRANSITION', 'INTERNAL'],
  },

  // ---- Summaries ----
  'GET /summaries/:date': {
    method: 'GET',
    path: '/api/v1/summaries/:date',
    params: dateParam,
    response: DaySummarySchema,
    errors: ['UNAUTHORIZED', 'FORBIDDEN', 'NOT_FOUND', 'INTERNAL'],
  },

  // ---- Demo (only when DEMO_MODE=true) ----
  'GET /sim/phones': {
    method: 'GET',
    path: '/api/demo/sim/phones',
    response: z.object({ items: z.array(SimPhoneSchema) }),
    errors: ['UNAUTHORIZED', 'FORBIDDEN', 'INTERNAL'],
  },
  'GET /sim/inbox': {
    method: 'GET',
    path: '/api/demo/sim/inbox',
    query: { phone: PhoneSchema },
    response: z.object({ items: z.array(SimMessageSchema) }),
    errors: ['VALIDATION', 'UNAUTHORIZED', 'FORBIDDEN', 'INTERNAL'],
  },
  'POST /sim/inbound': {
    method: 'POST',
    path: '/api/demo/sim/inbound',
    body: SimInboundRequestSchema,
    response: emptyResponse,
    errors: ['VALIDATION', 'INTERNAL'],
  },
  'POST /jump-to-shift-end': {
    method: 'POST',
    path: '/api/demo/jump-to-shift-end',
    response: emptyResponse,
    errors: ['UNAUTHORIZED', 'FORBIDDEN', 'INTERNAL'],
  },
  'POST /lock': {
    method: 'POST',
    path: '/api/demo/lock',
    body: z.object({ date: DateOnlySchema }),
    response: emptyResponse,
    errors: ['VALIDATION', 'UNAUTHORIZED', 'FORBIDDEN', 'INTERNAL'],
  },
  'POST /reset': {
    method: 'POST',
    path: '/api/demo/reset',
    response: emptyResponse,
    errors: ['UNAUTHORIZED', 'FORBIDDEN', 'INTERNAL'],
  },
} as const satisfies Record<string, Endpoint>;

export type Endpoints = typeof endpoints;
export type EndpointName = keyof Endpoints;
export { ErrorResponseSchema };
