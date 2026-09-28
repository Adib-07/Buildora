# API Contracts (Buildora)

Single source of truth for the staff API. Dev 1 builds `lib/api-client` and mocks against this;
Dev 2 implements the routes against this. **Both approve changes here.**

Import everything via `contracts/index.ts` (`@/contracts`).

## Conventions

| Concern | Rule |
|---|---|
| JSON keys | `camelCase` |
| ids | uuid strings |
| Timestamps | ISO-8601 UTC (`z.iso.datetime()` → `TimestampSchema`) |
| Dates | `YYYY-MM-DD`, site-local (`Asia/Kolkata`) → `DateOnlySchema` |
| Clock times | `HH:mm` 24h → `ClockSchema` |
| Phones | E.164 `+91XXXXXXXXXX`; masked to `+91XXXXXX3210` for engineer/owner |
| Hours | 0–16, step 0.5 → `HoursSchema` |
| Paginated lists | `{ items: T[], nextCursor: string \| null }` → `PageSchema` |
| Errors | `{ error: { code, message, fields? }, requestId }` → `ErrorResponseSchema` |
| `site_id` | Always from the session, never from the client |

`nextCursor` is present only on the paginated endpoints (`GET /workers`, `GET /hazards`).
The other list endpoints are day-scoped and unbounded for now; they return `{ items: T[] }`.
**If Dev 1 needs cursor pagination on those, say so — it is a contract change.**

## Error codes

| Code | HTTP |
|---|---|
| `MALFORMED` | 400 |
| `UNAUTHORIZED` | 401 |
| `FORBIDDEN` | 403 |
| `NOT_FOUND` | 404 |
| `PAYLOAD_TOO_LARGE` | 413 |
| `VALIDATION` | 422 |
| `PHOTO_INVALID` | 422 |
| `PHOTO_REUSED` | 422 |
| `VERSION_CONFLICT` | 409 |
| `BAD_TRANSITION` | 409 |
| `DAY_LOCKED` | 423 |
| `RATE_LIMITED` | 429 |
| `INTERNAL` | 500 |
| `DEPENDENCY_DOWN` | 503 |

Exported as `errorStatus` from `contracts/common.ts`. `fields` is a `Record<string, string>`
keyed by request field path, present on `VALIDATION` / `MALFORMED`.

## Endpoints

### Auth

| Endpoint | Method | Path | Request | Response | Errors |
|---|---|---|---|---|---|
| login | POST | `/api/v1/auth/login` | `LoginRequest` | `{ token } & Me` | VALIDATION, UNAUTHORIZED, INTERNAL |
| logout | POST | `/api/v1/auth/logout` | — | `{}` | UNAUTHORIZED, INTERNAL |
| me | GET | `/api/v1/me` | — | `Me` | UNAUTHORIZED, INTERNAL |

`POST /auth/login` has no role guard (it is how you get a role). Everything else requires a session.

### Workers

| Endpoint | Method | Path | Request | Response | Errors |
|---|---|---|---|---|---|
| teams | GET | `/api/v1/teams` | — | `{ items: Team[] }` | UNAUTHORIZED, INTERNAL |
| workers | GET | `/api/v1/workers` | `?teamId? &active?` | `Page<Worker>` | UNAUTHORIZED, INTERNAL |
| create worker | POST | `/api/v1/workers` | `CreateWorkerRequest` | `Worker` | VALIDATION, UNAUTHORIZED, FORBIDDEN, INTERNAL |
| update worker | PATCH | `/api/v1/workers/:id` | `UpdateWorkerRequest` | `Worker` | VALIDATION, UNAUTHORIZED, FORBIDDEN, NOT_FOUND, INTERNAL |

`Worker.workerCode` is populated for `supervisor` and `null` for other roles.
`Worker.phone` is masked for `engineer` / `owner`.

### Attendance

| Endpoint | Method | Path | Request | Response | Errors |
|---|---|---|---|---|---|
| day attendance | GET | `/api/v1/days/:date/attendance` | — | `DayAttendance` | UNAUTHORIZED, NOT_FOUND, INTERNAL |
| patch record | PATCH | `/api/v1/attendance/:id` | `PatchAttendanceRequest` | `AttendanceRecord` | VALIDATION, UNAUTHORIZED, FORBIDDEN, NOT_FOUND, VERSION_CONFLICT, DAY_LOCKED, INTERNAL |

`PatchAttendanceRequest.expectedVersion` is required. Mismatch → `VERSION_CONFLICT` (409).
A successful patch bumps `version` and resets `workerState` to `no_reply` (the record SMS is
re-sent). `DAY_LOCKED` (423) when the site-local day is already locked.

### Tasks

| Endpoint | Method | Path | Request | Response | Errors |
|---|---|---|---|---|---|
| day tasks | GET | `/api/v1/days/:date/tasks` | — | `{ items: Task[] }` | UNAUTHORIZED, NOT_FOUND, INTERNAL |
| draft | POST | `/api/v1/tasks/draft` | `TaskDraftRequest` (JSON) or multipart (see below) | `TaskDraftResponse` | VALIDATION, UNAUTHORIZED, FORBIDDEN, MALFORMED, PAYLOAD_TOO_LARGE, DEPENDENCY_DOWN, INTERNAL |
| approve | POST | `/api/v1/tasks/approve` | `ApproveTasksRequest` | `{ items: Task[] }` | VALIDATION, UNAUTHORIZED, FORBIDDEN, DAY_LOCKED, INTERNAL |

**Audio draft variant** — `POST /api/v1/tasks/draft` also accepts `multipart/form-data`:

| Field | Type | Constraint |
|---|---|---|
| `audio` | file | `audio/webm`, `audio/ogg` or `audio/mp4`; max `2_000_000` bytes; max `60s` |
| `lang` | string | optional, `en` \| `te` |

Returns the same `TaskDraftResponse` (with `transcript` set). Unsupported container →
`MALFORMED` (400). Over 2 MB or over 60 s → `PAYLOAD_TOO_LARGE` (413).
`AI_DISABLED=true` or an AI outage returns `fallback: true` with heuristic drafts, never an error
from the drafts themselves; only a total AI outage with no fallback is `DEPENDENCY_DOWN` (503).

Drafts with `ownerWorkerId: null` **must** be resolved by the supervisor before approve —
`ApproveTasksRequest.tasks[].ownerWorkerId` is required (`owner_worker_id NOT NULL`).

### Disputes

| Endpoint | Method | Path | Request | Response | Errors |
|---|---|---|---|---|---|
| list | GET | `/api/v1/disputes?status=open\|all` | — | `{ items: Dispute[] }` | UNAUTHORIZED, INTERNAL |
| detail | GET | `/api/v1/disputes/:id` | — | `DisputeDetail` | UNAUTHORIZED, NOT_FOUND, INTERNAL |
| resolve | POST | `/api/v1/disputes/:id/resolve` | `ResolveDisputeRequest` | `Dispute` | VALIDATION, UNAUTHORIZED, FORBIDDEN, NOT_FOUND, BAD_TRANSITION, INTERNAL |

`ResolveDisputeRequest` is a discriminated union on `outcome`:
`{ outcome: 'corrected', status, hours, late, note? }` or `{ outcome: 'upheld', note }` (3–200 chars).
Wrong current state → `BAD_TRANSITION` (409). `DisputeDetail.reasonAudioUrl` and
`HazardDetail` audio/photo URLs are **signed and short-lived** — fetch on demand, do not cache.

### Hazards

| Endpoint | Method | Path | Request | Response | Errors |
|---|---|---|---|---|---|
| list | GET | `/api/v1/hazards?status?&category?&from?&to?` | — | `Page<Hazard>` | UNAUTHORIZED, INTERNAL |
| detail | GET | `/api/v1/hazards/:id` | — | `HazardDetail` | UNAUTHORIZED, NOT_FOUND, INTERNAL |
| patch | PATCH | `/api/v1/hazards/:id` | `PatchHazardRequest` | `Hazard` | VALIDATION, UNAUTHORIZED, FORBIDDEN, NOT_FOUND, INTERNAL |
| photo upload url | POST | `/api/v1/hazards/:id/photo-url` | `PhotoUrlRequest` | `PhotoUrlResponse` | VALIDATION, UNAUTHORIZED, FORBIDDEN, NOT_FOUND, PHOTO_INVALID, INTERNAL |
| mark fixed | POST | `/api/v1/hazards/:id/fix` | `FixHazardRequest` | `Hazard` | VALIDATION, UNAUTHORIZED, FORBIDDEN, NOT_FOUND, PHOTO_REUSED, PHOTO_INVALID, BAD_TRANSITION, INTERNAL |

Photo flow is two-step: request a presigned `uploadUrl` + single-use `photoToken`
(`bytes` ≤ 8 000 000, mime `jpeg|png|webp`), upload the bytes straight to storage, then
`POST /fix` with the token. Reusing a token → `PHOTO_REUSED` (422). Re-uploading the same image
bytes under a new token → `PHOTO_REUSED`. Wrong mime/size → `PHOTO_INVALID` (422).
A fix moves the hazard to `fixed_awaiting_reporter`; it closes only after the reporter replies 1,
or `closed_unverified` after 24 h of silence. `PATCH` with `mergeIntoId` merges this hazard into
another and archives the source.

### Summaries

| Endpoint | Method | Path | Request | Response | Errors |
|---|---|---|---|---|---|
| day summary | GET | `/api/v1/summaries/:date` | — | `DaySummary` | UNAUTHORIZED, FORBIDDEN, NOT_FOUND, INTERNAL |

Engineer/owner only. `narrative` is AI-drafted — **render as escaped plain text only.**

### Demo (only when `DEMO_MODE=true`)

| Endpoint | Method | Path | Request | Response | Errors |
|---|---|---|---|---|---|
| sim phones | GET | `/api/demo/sim/phones` | — | `{ items: SimPhone[] }` | UNAUTHORIZED, FORBIDDEN, INTERNAL |
| sim inbox | GET | `/api/demo/sim/inbox?phone=` | — | `{ items: SimMessage[] }` | VALIDATION, UNAUTHORIZED, FORBIDDEN, INTERNAL |
| sim inbound | POST | `/api/demo/sim/inbound` | `SimInboundRequest` | `{}` | VALIDATION, INTERNAL |
| jump to shift end | POST | `/api/demo/jump-to-shift-end` | — | `{}` | UNAUTHORIZED, FORBIDDEN, INTERNAL |
| lock day | POST | `/api/demo/lock` | `{ date }` | `{}` | VALIDATION, UNAUTHORIZED, FORBIDDEN, INTERNAL |
| reset | POST | `/api/demo/reset` | — | `{}` | UNAUTHORIZED, FORBIDDEN, INTERNAL |

These simulate the SMS gateway. They return `FORBIDDEN` when `DEMO_MODE !== 'true'`.
`POST /sim/inbound` has no session guard — it stands in for the gateway, not a staff user.

## Not in contracts (backend-internal)

- `/api/inbound/*` — inbound SMS / voice webhooks from the gateway (HMAC-verified)
- `/api/jobs/*` — scheduled jobs (day lock, summary, hazard escalation)

Do not call these from the staff app.

## Typed registry

`endpoints` in `contracts/endpoints.ts` maps `"METHOD /path"` → `{ method, path, params?, query?, body?, response, errors }`,
holding real zod schemas so `lib/api-client`, mocks and tests share one definition.
Keys are `EndpointName`; paths and error codes in the tables above are generated from it —
if you change one, change the other.
