# Buildora

Construction site operations in one place. Buildora sends every worker their
shift record by SMS or voice, and lets them confirm or dispute it in their own
language. What comes back is attendance you can defend at payroll, not a paper
register you have to trust.

Built as a hackathon prototype: a working supervisor application on a real
PostgreSQL/Supabase schema, with tenant isolation enforced in the database.

---

## What works today

| Area | State |
|---|---|
| Authentication | Supabase Auth, httpOnly cookie session, sign in / sign out, session revalidation per request |
| Attendance | Day view, supervisor edit with optimistic concurrency, locked-day protection |
| Disputes | Queue, full record history, correct-or-uphold resolution, one decision per dispute |
| Tasks | Free-text drafting with roster owner matching, review step, publish with a named owner |
| Safety | Hazard list with filters, detail with reports and history, severity and owner triage, duplicate merge |
| Crew | Roster, add worker, team/language/status changes, role-based phone masking |
| Day summary | Live figures, 7-day trend, per-team breakdown, engineer and owner only |
| Tenant isolation | RLS on all 18 tables, verified by tests as real signed-in users |

Deliberately not implemented, rather than stubbed: the SMS/voice gateway
pipeline, speech-to-text task drafting, hazard photo upload, and the `/api/demo`
phone simulator. See [Not implemented](#not-implemented).

---

## Running it locally

Requires Node 22+, pnpm 11+, Docker (for the local Supabase stack).

```bash
pnpm install
cp .env.example .env.local          # then paste in the keys `supabase start` prints
supabase start                      # Docker; this project uses ports 54421/54422
pnpm db:reset                       # apply migrations + seed
pnpm dev                            # http://localhost:3000
```

### Seeded accounts

Two sites exist so cross-tenant isolation can be tested against a real second
tenant. Every account uses the password `buildora-dev-password`.

| Site | Email | Role |
|---|---|---|
| Quarry Ridge | `supervisor@quarryridge.test` | supervisor |
| Quarry Ridge | `engineer@quarryridge.test` | engineer |
| Quarry Ridge | `owner@quarryridge.test` | owner |
| Harbour Works | `supervisor@harbourworks.test` | supervisor |

**Sign in as the supervisor to see the whole product.** An engineer sees the same
data with phone numbers masked and worker codes hidden, and no write actions.

### Useful commands

```bash
pnpm dev            # development server
pnpm build          # production build
pnpm start          # serve the production build
pnpm typecheck      # tsc --noEmit, with Next route types generated first
pnpm lint           # eslint
pnpm test           # vitest: contracts, RLS, constraints, secrets, auth, authorization
pnpm db:reset       # re-apply migrations and seed
pnpm check:secrets  # fail if a server-only secret reached the browser bundle
pnpm check          # typecheck + lint + test + build + check:secrets
```

`pnpm test` needs the local Supabase stack running and seeded. It starts its own
Next dev server on port 3123.

There is also an end-to-end API smoke script covering every route, every role and
cross-tenant access:

```bash
pnpm exec next dev --port 3199 &
bash scripts/smoke-api.sh 3199      # resets the database first
```

---

## Architecture

```
app/
  page.tsx            public landing page
  login/              sign in
  (app)/              authenticated shell - every page inherits its session guard
  actions.ts          server actions: the only write path from the browser
  api/v1/             the staff HTTP API, one route per contract endpoint
components/           brand, app shell, status vocabulary, state components
contracts/            zod schemas + a typed endpoint registry. Source of truth.
lib/
  auth/dal.ts         data access layer for pages and actions
  domain/             all database logic, per area
  security/           the withApi() route wrapper, redacting logger
  db/service-role.ts  the one place the service-role key is read
supabase/
  migrations/         the schema
  seed.sql            two sites, four staff, six workers, three days of work
tests/                contracts, RLS, constraints, secrets, auth, authorization
docs/                 database and API notes
proxy.ts              optimistic route guard (Next 16's replacement for middleware)
```

### The one rule

Reads run **as the signed-in user**. `lib/auth/dal.ts` resolves the session and
hands back a `@supabase/ssr` client, so every query is executed by Postgres as
that user and filtered by RLS. Cross-site leakage is a database failure, not
something the application has to remember to prevent.

Writes run with the **service role**, because the rules that guard them --
`expectedVersion`, the day lock, exactly one task owner, one open dispute per
record -- live in the application layer. Granting the caller's JWT write access
would let anyone holding a token skip them by talking to PostgREST directly. See
[docs/db/README.md](docs/db/README.md).

### Request path for a mutation

```
form -> server action -> requireSession() -> role check -> zod parse
     -> domain function -> site ownership check -> write -> audit event -> revalidate
```

`siteId`, `role` and `staffId` always come from the `staff` row, never from the
form. A forged `siteId` field is ignored because no action reads one.

### The endpoint registry

`contracts/endpoints.ts` maps `"METHOD /path"` to real zod schemas. Both the API
routes and the tests read from it, and `tests/api/contracts.consistency.test.ts`
fails if a registry key drifts from its method and path. `contracts/` is the
source of truth; `docs/api/README.md` explains what belongs where.

---

## Security

Enforced and tested, not asserted:

- **Tenant isolation** -- RLS on all 18 tables. `tests/db/rls.test.ts` signs in as
  real seeded users and queries as them, so it exercises the policies rather than
  the policy text. `anon` holds no grant on any tenant table, so the publishable
  key is not a data path.
- **Role enforcement** -- server-side on every route and action. The navigation
  hides what a role cannot use, but that is convenience; the check is never the
  UI.
- **No open redirect** -- the post-login `next` parameter is constrained to a
  same-site path.
- **No secret in the bundle** -- `tests/security/secrets.test.ts` and
  `pnpm check:secrets` after a build.
- **Redacted logs** -- pino redacts phone numbers, message bodies and transcripts
  by key name, including nested payloads.
- **Append-only audit trail** -- `events` has a trigger rejecting UPDATE/DELETE
  and no INSERT policy for `authenticated`, so a staff session cannot forge an
  entry.
- **Errors** -- a failure surfaces a fixed sentence and a request id. Raw
  PostgREST messages, which quote table and column names, never reach a client.

---

## Deployment

Vercel picks up `vercel.json` automatically. Framework is Next.js, build is
`pnpm build`.

Required environment variables -- see [.env.example](.env.example) for the full
list:

| Variable | Required | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | yes | Publishable/anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | Server-only. Every write needs it |
| `NEXT_PUBLIC_SITE_URL` | recommended | Canonical origin for OpenGraph |
| `AI_DISABLED` | recommended | `true` for this build |

Never prefix a server-only name with `NEXT_PUBLIC_`; a test enforces it.

**Before the first deploy**, apply the schema to the hosted project:

```bash
supabase link --project-ref <your-ref>
supabase db push          # migrations only -- safe on a real database
```

`supabase db reset` is destructive and local-only. Load the demo data with
`supabase db reset --linked` only if you want the Quarry Ridge demo site.

Set the Vercel production branch to `main`. The application lives there; the
historical `backend` and `frontend` branches are left in place for reference.

If your Supabase project is not in the same region as the Vercel function, set
`regions` in `vercel.json` to match -- every query crosses that boundary.

---

## Not implemented

Listed so nothing here reads as finished when it is not. Each is a real gap, not
a stub returning fake data.

| Feature | Why |
|---|---|
| SMS / voice gateway pipeline | Needs a live provider account. `inbound_messages`, `messages` and the rate-limit index exist and are unused. |
| Audio task drafting | The `multipart/form-data` variant of `POST /api/v1/tasks/draft`. The JSON variant works and is the deterministic fallback. |
| Hazard photo upload and proof-of-fix | Two-step presigned upload plus perceptual hashing. `hazard_photos` exists; the flow is not built. |
| `/api/demo/*` phone simulator | The inbound SMS parser. Would make the SMS story demonstrable but is demo scaffolding, not product. |
| Day locking | `work_days.locked_at` is read and honoured everywhere; no endpoint or job sets it. |
| Self-service sign-up | A real Supabase user with no `staff` row is refused at sign-in rather than being provisioned into a site. |

---

## Accessibility

48px minimum touch targets, visible focus rings, status shown by icon and word as
well as colour, `aria-live` on form results, a skip link, and text at 16px or
larger so iOS does not zoom on focus. Colours in `app/globals.css` are documented
with their measured contrast ratios.

---

## Licence

Prototype. Built for a hackathon.
