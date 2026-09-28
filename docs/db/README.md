# Database

PostgreSQL schema for the staff API. `contracts/` is the source of truth for the
wire format; this schema is the source of truth for storage. Every enum,
nullability and CHECK below exists because a zod schema in `contracts/` demands
it, so a row that satisfies the database also satisfies the contract.

## Local

```bash
supabase start          # Docker; ports 54421/54422 (see supabase/config.toml)
pnpm db:reset           # apply migrations + seed.sql
```

Ports were moved off the Supabase defaults (54321/54322) because another local
project already holds them.

Seeded accounts all use the password `buildora-dev-password`:
`supervisor@`, `engineer@`, `owner@quarryridge.test` (site A) and
`supervisor@harbourworks.test` (site B). Site B exists so cross-site isolation
can be tested with a real second tenant.

## Tables

| Area | Tables |
|---|---|
| Tenancy | `sites` (holds `demo_now`, the demo clock override) |
| Identity | `staff` — PK is `auth.users.id`; holds `role` and `site_id` |
| People | `teams`, `workers` |
| Attendance | `work_days`, `attendance_records`, `attendance_versions`, `confirmations` |
| Work | `tasks`, `disputes` |
| Safety | `hazards`, `hazard_reports`, `hazard_photos` |
| Messaging | `messages` (outbox), `inbound_messages` (raw webhooks) |
| Platform | `events` (append-only), `ai_runs` (metadata only), `daily_summaries` |

## Design notes worth knowing

**`workers.phone_e164` is deliberately not unique.** Several workers can share
one phone; that is what `worker.worker_code` (a unique 4-digit code per site)
disambiguates, and it is why an inbound reply from a shared number must carry the
code. Uniqueness is on `(site_id, worker_code)`, not the phone.

**Hazard ownership is two nullable FKs, not a polymorphic id.** `Hazard.owner` is
a `worker | staff` union, which cannot carry a foreign key. `owner_worker_id` and
`owner_staff_id` are nullable columns with a CHECK allowing at most one, so
referential integrity stays in the database. The API derives
`{ type, id, name }` from whichever is set.

**Business rules are not database constraints.** `expectedVersion`,
`DAY_LOCKED`, one-owner-per-task and photo reuse are enforced in the API layer
because they need the request context and a transaction. That is also why the
user JWT is not granted write access — see below.

**`events` is append-only.** A `BEFORE UPDATE OR DELETE` trigger raises
`42501` regardless of grants or RLS, and there is no INSERT policy for
`authenticated`, so a staff session cannot forge an audit entry either.

**`ai_runs` has no text column.** Only purpose, model, status and latency.
Worker messages and hazard transcripts stay in their own tables.

## Privileges

| Role | Access | Used by |
|---|---|---|
| `anon` | none | nothing; the publishable key is not a data path |
| `authenticated` | `SELECT`, filtered by RLS | staff API reads |
| `service_role` | full, `BYPASSRLS` | API write path; HMAC/Bearer endpoints |

RLS is enabled on all 18 tables. `current_staff_site_id()` resolves the caller's
site from `public.staff`, and every policy compares against it, so a signed-in
staff member cannot read or write another site's rows even with a valid token.

Writes use the service role on purpose. Granting the caller's JWT INSERT/UPDATE
would let anyone holding a token bypass the API and write rows that skip
`expectedVersion`, the day lock and the one-owner rule. Reads stay on the
user's session so tenant isolation is enforced by Postgres, not by query
construction.

## Verification

`tests/db/rls.test.ts` and `tests/db/constraints.test.ts` run against the live
local database as real signed-in users, not as a service-role shortcut, so they
test the policies rather than the policy text.
