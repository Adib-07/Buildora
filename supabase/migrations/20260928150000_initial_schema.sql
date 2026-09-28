-- Buildora initial schema.
--
-- Derived from contracts/*.ts. Every enum, nullability and check below maps to
-- a zod schema in contracts/, so a write that satisfies the database also
-- satisfies the contract response, and vice versa.
--
-- Tenant isolation: every row that belongs to a site carries a site_id that
-- traces back to public.sites. RLS is enabled on all tables and scoped to the
-- caller's staff row, so the publishable key can never read across sites.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enums (mirroring contracts/common.ts)
-- ---------------------------------------------------------------------------

create type staff_role as enum ('supervisor', 'engineer', 'owner');
create type worker_lang as enum ('en', 'te', 'hi');
create type worker_consent as enum ('pending', 'given', 'withdrawn');
create type att_status as enum ('present', 'absent', 'half_day');
create type worker_state as enum ('no_reply', 'confirmed', 'disputed');
create type dispute_status as enum ('open', 'corrected', 'upheld', 'escalated');
create type hazard_status as enum (
  'reported', 'assigned', 'fixed_awaiting_reporter', 'closed', 'closed_unverified', 'reopened'
);
create type hazard_category as enum (
  'fall_edge', 'electrical', 'excavation', 'scaffold', 'machinery', 'fire', 'housekeeping', 'other'
);
create type hazard_owner_type as enum ('worker', 'staff');
create type ai_status as enum ('ok', 'fallback');
create type task_source as enum ('voice', 'text');
create type message_direction as enum ('in', 'out');
create type message_status as enum ('queued', 'sending', 'sent', 'failed');
create type inbound_kind as enum ('sms', 'missed_call', 'voice');
create type actor_type as enum ('staff', 'worker', 'system');
create type run_status as enum ('ok', 'error', 'timeout', 'skipped');

-- ---------------------------------------------------------------------------
-- sites
-- ---------------------------------------------------------------------------

create table public.sites (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) > 0),
  -- Me.timezone; contracts/README.md pins site-local dates to Asia/Kolkata.
  timezone text not null default 'Asia/Kolkata',
  -- Me.shiftEnd / Me.summaryCutoff, ClockSchema 'HH:mm'.
  shift_end time not null default '17:30',
  summary_cutoff time not null default '20:00',
  -- Demo clock override. Read by lib/domain/clock.ts only when DEMO_MODE=true.
  demo_now timestamptz,
  created_at timestamptz not null default now()
);

comment on column public.sites.demo_now is
  'Simulated wall clock for demo mode; NULL in production. Never used unless DEMO_MODE=true.';

-- ---------------------------------------------------------------------------
-- staff -- identity is Supabase Auth; authorization is this table + RLS.
-- ---------------------------------------------------------------------------

create table public.staff (
  -- Equals auth.users.id. Identity/session handling stays in Supabase Auth;
  -- role and site live here so they can never be asserted by the client.
  id uuid primary key references auth.users (id) on delete cascade,
  site_id uuid not null references public.sites (id) on delete restrict,
  email text not null,
  full_name text not null check (length(btrim(full_name)) > 0),
  role staff_role not null,
  created_at timestamptz not null default now(),
  constraint staff_email_format check (position('@' in email) > 1)
);

create unique index staff_email_key on public.staff (lower(email));
create index staff_site_idx on public.staff (site_id);

-- ---------------------------------------------------------------------------
-- teams / workers
-- ---------------------------------------------------------------------------

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites (id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  created_at timestamptz not null default now(),
  constraint teams_site_name_key unique (site_id, name)
);

create index teams_site_idx on public.teams (site_id);

create table public.workers (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites (id) on delete cascade,
  team_id uuid references public.teams (id) on delete set null,
  full_name text not null check (length(full_name) between 2 and 60),
  -- PhoneSchema: E.164 India. NOT unique -- a shared phone is a first-class
  -- case (Worker.workerCode exists to disambiguate several workers on one
  -- number, and SIM/confirm flows require the 4-digit code for exactly that).
  phone_e164 text not null check (phone_e164 ~ '^\+91[0-9]{10}$'),
  -- Unique 4-digit code. Supervisor-only in responses; null until issued.
  worker_code text check (worker_code is null or worker_code ~ '^[0-9]{4}$'),
  lang worker_lang not null default 'en',
  consent worker_consent not null default 'pending',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index workers_site_code_key
  on public.workers (site_id, worker_code)
  where worker_code is not null;
create index workers_site_phone_idx on public.workers (site_id, phone_e164);
create index workers_site_team_idx on public.workers (site_id, team_id);
create index workers_roster_idx on public.workers (site_id, active, full_name);

-- ---------------------------------------------------------------------------
-- work_days / attendance_records / attendance_versions
-- ---------------------------------------------------------------------------

create table public.work_days (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites (id) on delete cascade,
  work_date date not null,
  -- Set by lib/domain/summary.ts lockDay(); DAY_LOCKED reads this.
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint work_days_site_date_key unique (site_id, work_date)
);

create index work_days_site_date_idx on public.work_days (site_id, work_date desc);

create table public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites (id) on delete cascade,
  work_day_id uuid not null references public.work_days (id) on delete cascade,
  worker_id uuid not null references public.workers (id) on delete cascade,
  status att_status not null default 'present',
  late boolean not null default false,
  -- HoursSchema: 0..16 in 0.5 steps. mod(hours*2, 1) is exact for numeric.
  hours numeric(3, 1) not null default 8
    check (hours >= 0 and hours <= 16 and mod(hours * 2, 1) = 0),
  -- Bumped on every supervisor edit; drives optimistic concurrency
  -- (PatchAttendanceRequest.expectedVersion -> VERSION_CONFLICT).
  version integer not null default 1 check (version > 0),
  worker_state worker_state not null default 'no_reply',
  -- The record version a confirmation/dispute is bound to. NULL whenever the
  -- record has been edited since, which is what resets the worker to no_reply.
  state_version integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint attendance_records_day_worker_key unique (work_day_id, worker_id),
  -- state_version may only be NULL or a version this record actually reached.
  constraint attendance_records_state_version_range
    check (state_version is null or (state_version >= 1 and state_version <= version))
);

create index attendance_records_site_idx on public.attendance_records (site_id, work_day_id);
create index attendance_records_worker_idx on public.attendance_records (worker_id, work_day_id);

-- Append-only history. Drives DisputeDetail.history and the audit trail.
create table public.attendance_versions (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null references public.attendance_records (id) on delete cascade,
  version integer not null check (version > 0),
  status att_status not null,
  hours numeric(3, 1) not null check (hours >= 0 and hours <= 16),
  late boolean not null,
  changed_at timestamptz not null default now(),
  -- DisputeHistoryEntry.reason
  reason text,
  constraint attendance_versions_record_version_key unique (record_id, version)
);

create index attendance_versions_record_idx
  on public.attendance_versions (record_id, version desc);

-- One confirmation per record version. Re-binding after an edit is prevented
-- by the unique key, so an edited record cannot collect a stale confirmation.
create table public.confirmations (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null references public.attendance_records (id) on delete cascade,
  worker_id uuid not null references public.workers (id) on delete cascade,
  version integer not null check (version > 0),
  created_at timestamptz not null default now(),
  constraint confirmations_record_version_key unique (record_id, version)
);

create index confirmations_worker_idx on public.confirmations (worker_id, created_at desc);

-- ---------------------------------------------------------------------------
-- tasks
-- ---------------------------------------------------------------------------

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites (id) on delete cascade,
  work_day_id uuid not null references public.work_days (id) on delete cascade,
  title text not null check (length(title) between 3 and 120),
  location text check (location is null or length(location) <= 60),
  -- ApproveTaskSchema requires an owner: exactly one, never null.
  owner_worker_id uuid not null references public.workers (id) on delete restrict,
  source task_source not null,
  created_at timestamptz not null default now()
);

create index tasks_site_day_idx on public.tasks (site_id, work_day_id, created_at);

-- ---------------------------------------------------------------------------
-- disputes
-- ---------------------------------------------------------------------------

create table public.disputes (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null references public.attendance_records (id) on delete cascade,
  worker_id uuid not null references public.workers (id) on delete cascade,
  -- Record version this dispute is bound to.
  record_version integer not null check (record_version > 0),
  status dispute_status not null default 'open',
  reason_text text,
  -- Storage object path; the signed URL is minted on read (5 min).
  reason_audio_path text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolution_note text,
  constraint disputes_note_when_upheld
    check (status <> 'upheld' or length(btrim(coalesce(resolution_note, ''))) >= 3)
);

-- At most one open dispute per record; a second resolve hits BAD_TRANSITION.
create unique index disputes_one_open_per_record
  on public.disputes (record_id)
  where status = 'open';
create index disputes_site_status_idx on public.disputes (status, created_at desc);
create index disputes_record_idx on public.disputes (record_id, created_at desc);

-- ---------------------------------------------------------------------------
-- hazards
-- ---------------------------------------------------------------------------

create table public.hazards (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites (id) on delete cascade,
  -- Human code, e.g. 'HZ-014'.
  code text not null check (code ~ '^HZ-[0-9]{3}$'),
  category hazard_category not null default 'other',
  location_text text check (location_text is null or length(location_text) <= 200),
  -- null until triaged by staff (Hazard.severity).
  severity smallint check (severity is null or severity between 1 and 3),
  summary text not null check (length(summary) between 1 and 500),
  status hazard_status not null default 'reported',
  -- HazardOwner is a union of worker|staff. Modelled as two nullable FKs with a
  -- CHECK rather than a single untyped owner_id, so referential integrity is
  -- enforced by the database. At most one owner.
  owner_worker_id uuid references public.workers (id) on delete set null,
  owner_staff_id uuid references public.staff (id) on delete set null,
  due_at timestamptz,
  -- 'ok' when AI produced the card, 'fallback' when it did not.
  ai_status ai_status,
  -- Set when the hazard card matches an existing open hazard.
  possible_duplicate_id uuid references public.hazards (id) on delete set null,
  -- mergeIntoId: source hazard archived by moving its reports to the target.
  merged_into_id uuid references public.hazards (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint hazards_site_code_key unique (site_id, code),
  constraint hazards_at_most_one_owner check (
    (owner_worker_id is null)::int + (owner_staff_id is not null)::int <= 1
  ),
  constraint hazards_assigned_has_owner check (
    status <> 'assigned' or owner_worker_id is not null or owner_staff_id is not null
  ),
  constraint hazards_own_merge check (merged_into_id is null or merged_into_id <> id)
);

create index hazards_site_status_idx on public.hazards (site_id, status, created_at desc);
create index hazards_site_category_idx on public.hazards (site_id, category);
create index hazards_due_idx on public.hazards (status, due_at)
  where status = 'fixed_awaiting_reporter';
create index hazards_duplicate_idx on public.hazards (possible_duplicate_id)
  where possible_duplicate_id is not null;

-- HazardReport.reporterName is nullable and unverified_reporter exists for
-- reporters who are not on the roster, so reporter_worker_id is nullable.
create table public.hazard_reports (
  id uuid primary key default gen_random_uuid(),
  hazard_id uuid not null references public.hazards (id) on delete cascade,
  reporter_worker_id uuid references public.workers (id) on delete set null,
  reporter_name text,
  unverified_reporter boolean not null default false,
  -- Raw text or STT transcript of the report.
  transcript text,
  audio_path text,
  -- Retained for per-number inbound rate limiting and dedupe.
  from_phone text check (from_phone is null or from_phone ~ '^\+91[0-9]{10}$'),
  received_at timestamptz not null default now(),
  constraint hazard_reports_has_reporter check (
    reporter_worker_id is not null or reporter_name is not null or unverified_reporter
  )
);

create index hazard_reports_hazard_idx on public.hazard_reports (hazard_id, received_at);
create index hazard_reports_phone_idx on public.hazard_reports (from_phone, received_at desc)
  where from_phone is not null;

create table public.hazard_photos (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites (id) on delete cascade,
  hazard_id uuid not null references public.hazards (id) on delete cascade,
  -- Random object key; the client never chooses it.
  storage_key text not null,
  mime text not null check (mime in ('image/jpeg', 'image/png', 'image/webp')),
  bytes integer not null check (bytes > 0 and bytes <= 8000000),
  -- sha256 of the ORIGINAL uploaded bytes, so exact re-uploads are rejected
  -- even though the stored object is re-encoded (EXIF/GPS stripped).
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  -- 64-bit dHash, unsigned; Hamming distance is computed in the app layer.
  dhash numeric(20, 0) not null check (dhash >= 0 and dhash < 18446744073709551616),
  uploaded_at timestamptz not null default now(),
  constraint hazard_photos_key_key unique (storage_key)
);

-- PHOTO_REUSED: the same bytes may not be stored twice in a site.
create unique index hazard_photos_site_sha_key on public.hazard_photos (site_id, sha256);
create index hazard_photos_hazard_idx on public.hazard_photos (hazard_id, uploaded_at);
create index hazard_photos_dhash_idx on public.hazard_photos (site_id, dhash);

-- ---------------------------------------------------------------------------
-- messaging
-- ---------------------------------------------------------------------------

-- Outbox. lib/domain/outbox.ts enqueue() writes status 'queued'; sendQueued()
-- drains it through the configured ChannelAdapter.
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites (id) on delete cascade,
  worker_id uuid references public.workers (id) on delete set null,
  to_phone text not null check (to_phone ~ '^\+91[0-9]{10}$'),
  direction message_direction not null default 'out',
  body text not null check (length(body) > 0),
  -- SIM messages always carry a key; raw inbound/AI text does not.
  template_key text,
  lang worker_lang not null default 'en',
  status message_status not null default 'queued',
  attempts integer not null default 0 check (attempts >= 0),
  -- Backoff schedule: 30s, 2min, 10min, then 'failed'.
  next_attempt_at timestamptz not null default now(),
  provider_msg_id text,
  last_error text,
  -- Job idempotency, e.g. 'record:{date}:{worker}:{version}'. A second run of a
  -- job cannot enqueue a duplicate.
  idempotency_key text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create unique index messages_idempotency_key
  on public.messages (site_id, idempotency_key)
  where idempotency_key is not null;
create index messages_outbox_idx
  on public.messages (status, next_attempt_at)
  where status in ('queued', 'sending');
create index messages_worker_day_idx on public.messages (worker_id, created_at desc);
create index messages_inbox_idx on public.messages (to_phone, created_at desc)
  where direction = 'in';

-- Raw inbound webhooks, stored before processing. Deduplicated on the
-- provider id so a redelivered webhook is processed exactly once.
create table public.inbound_messages (
  id uuid primary key default gen_random_uuid(),
  site_id uuid references public.sites (id) on delete cascade,
  from_phone text not null check (from_phone ~ '^\+91[0-9]{10}$'),
  kind inbound_kind not null,
  text text check (text is null or length(text) <= 1000),
  line text check (line is null or line in ('confirm', 'hazard')),
  provider_msg_id text,
  provider_call_id text,
  audio_path text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  outcome text
);

create unique index inbound_msg_provider_key
  on public.inbound_messages (provider_msg_id)
  where provider_msg_id is not null;
create unique index inbound_call_provider_key
  on public.inbound_messages (provider_call_id)
  where provider_call_id is not null;
-- Supports the 10-per-number-per-10-minutes limiter without a separate table.
create index inbound_rate_limit_idx
  on public.inbound_messages (from_phone, received_at desc);

-- ---------------------------------------------------------------------------
-- events -- append-only audit trail
-- ---------------------------------------------------------------------------

create table public.events (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites (id) on delete cascade,
  entity_type text not null,
  entity_id uuid,
  kind text not null,
  actor_type actor_type not null default 'system',
  actor_id uuid,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index events_site_created_idx on public.events (site_id, created_at desc);
create index events_entity_idx on public.events (entity_type, entity_id, created_at desc);

create or replace function public.reject_event_mutation() returns trigger
language plpgsql as $$
begin
  raise exception 'events is append-only (attempted %)', tg_op
    using errcode = '42501';
end;
$$;

create trigger events_append_only
  before update or delete on public.events
  for each row execute function public.reject_event_mutation();

-- ---------------------------------------------------------------------------
-- ai_runs -- metadata only, never raw text
-- ---------------------------------------------------------------------------

create table public.ai_runs (
  id uuid primary key default gen_random_uuid(),
  site_id uuid references public.sites (id) on delete set null,
  purpose text not null,
  model text not null,
  status run_status not null,
  latency_ms integer check (latency_ms is null or latency_ms >= 0),
  created_at timestamptz not null default now()
);

comment on table public.ai_runs is
  'One row per AI call. Deliberately holds no prompt or completion text: worker '
  'messages and hazard transcripts must never be persisted outside their own tables.';

create index ai_runs_site_created_idx on public.ai_runs (site_id, created_at desc);

-- ---------------------------------------------------------------------------
-- daily_summaries
-- ---------------------------------------------------------------------------

create table public.daily_summaries (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites (id) on delete cascade,
  work_date date not null,
  -- Incremented when a locked day is amended by a dispute resolution.
  revision integer not null default 1 check (revision > 0),
  -- True once the day has been re-generated after it was already sent out.
  amended boolean not null default false,
  counts jsonb not null default '{}'::jsonb,
  by_team jsonb not null default '[]'::jsonb,
  disputes jsonb not null default '[]'::jsonb,
  tasks jsonb not null default '[]'::jsonb,
  hazards jsonb not null default '{}'::jsonb,
  trend jsonb not null default '[]'::jsonb,
  -- AI-drafted prose. Always rendered as escaped plain text by the client.
  narrative text,
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint daily_summaries_site_date_key unique (site_id, work_date)
);

create index daily_summaries_site_date_idx
  on public.daily_summaries (site_id, work_date desc);

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
--
-- The staff API runs with the service-role key and enforces site scoping in
-- query construction. RLS is the second, database-level barrier: if the
-- publishable key is ever exposed, a caller's JWT still only reaches rows for
-- the site their staff row belongs to. Never grant a policy that widens this.
--
-- These helpers are SECURITY DEFINER owned by the migration role so they can
-- read public.staff without recursing through its own policy.

create or replace function public.current_staff_site_id() returns uuid
language sql stable security definer set search_path = public
as $$
  select site_id from public.staff where id = auth.uid();
$$;

create or replace function public.current_staff_role() returns public.staff_role
language sql stable security definer set search_path = public
as $$
  select role from public.staff where id = auth.uid();
$$;

alter table public.sites enable row level security;
alter table public.staff enable row level security;
alter table public.teams enable row level security;
alter table public.workers enable row level security;
alter table public.work_days enable row level security;
alter table public.attendance_records enable row level security;
alter table public.attendance_versions enable row level security;
alter table public.confirmations enable row level security;
alter table public.tasks enable row level security;
alter table public.disputes enable row level security;
alter table public.hazards enable row level security;
alter table public.hazard_reports enable row level security;
alter table public.hazard_photos enable row level security;
alter table public.messages enable row level security;
alter table public.inbound_messages enable row level security;
alter table public.events enable row level security;
alter table public.ai_runs enable row level security;
alter table public.daily_summaries enable row level security;

-- Direct-site tables.
create policy sites_read_own on public.sites
  for select using (id = public.current_staff_site_id());

create policy staff_read_own_site on public.staff
  for select using (site_id = public.current_staff_site_id());
create policy staff_read_self on public.staff
  for select using (id = auth.uid());

create policy teams_own_site on public.teams
  for all using (site_id = public.current_staff_site_id())
  with check (site_id = public.current_staff_site_id());

create policy workers_own_site on public.workers
  for all using (site_id = public.current_staff_site_id())
  with check (site_id = public.current_staff_site_id());

create policy work_days_own_site on public.work_days
  for all using (site_id = public.current_staff_site_id())
  with check (site_id = public.current_staff_site_id());

create policy hazards_own_site on public.hazards
  for all using (site_id = public.current_staff_site_id())
  with check (site_id = public.current_staff_site_id());

create policy hazard_photos_own_site on public.hazard_photos
  for all using (site_id = public.current_staff_site_id())
  with check (site_id = public.current_staff_site_id());

create policy messages_own_site on public.messages
  for all using (site_id = public.current_staff_site_id())
  with check (site_id = public.current_staff_site_id());

create policy events_read_own_site on public.events
  for select using (site_id = public.current_staff_site_id());
-- events has no INSERT policy on purpose: only the service role (which bypasses
-- RLS) writes it, and the append-only trigger blocks UPDATE/DELETE regardless.

create policy ai_runs_own_site on public.ai_runs
  for select using (site_id = public.current_staff_site_id());

create policy summaries_own_site on public.daily_summaries
  for all using (site_id = public.current_staff_site_id())
  with check (site_id = public.current_staff_site_id());

-- Child tables that inherit their site from a parent row.
create policy attendance_records_own_site on public.attendance_records
  for all using (site_id = public.current_staff_site_id())
  with check (site_id = public.current_staff_site_id());

create policy attendance_versions_own_site on public.attendance_versions
  for select using (
    exists (
      select 1 from public.attendance_records r
      where r.id = record_id
        and r.site_id = public.current_staff_site_id()
    )
  );

create policy confirmations_own_site on public.confirmations
  for select using (
    exists (
      select 1 from public.attendance_records r
      where r.id = record_id
        and r.site_id = public.current_staff_site_id()
    )
  );

create policy tasks_own_site on public.tasks
  for all using (site_id = public.current_staff_site_id())
  with check (site_id = public.current_staff_site_id());

create policy disputes_own_site on public.disputes
  for select using (
    exists (
      select 1 from public.attendance_records r
      where r.id = record_id
        and r.site_id = public.current_staff_site_id()
    )
  );

create policy hazard_reports_own_site on public.hazard_reports
  for select using (
    exists (
      select 1 from public.hazards h
      where h.id = hazard_id
        and h.site_id = public.current_staff_site_id()
    )
  );

create policy inbound_own_site on public.inbound_messages
  for all using (site_id = public.current_staff_site_id())
  with check (site_id = public.current_staff_site_id());

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
--
-- Privilege split, deliberate:
--
--   anon          -- nothing. Denied before RLS is consulted, so a leaked
--                   publishable key is not a data path.
--   authenticated -- SELECT only, filtered by the policies above. This is what
--                   staff API routes use for reads, so tenant isolation is
--                   enforced by Postgres rather than by query construction.
--   service_role  -- full access, and the role has BYPASSRLS. Used only by the
--                   write path and by HMAC/Bearer-authenticated endpoints.
--
-- Writes deliberately do NOT go through the user's JWT: the rules that guard
-- them (expectedVersion, day lock, one-owner, photo reuse) are enforced in the
-- API layer, so a caller holding a valid token must not be able to reach
-- PostgREST directly and skip them.

revoke all on all tables in schema public from anon;

grant select on public.sites, public.staff, public.teams, public.workers,
  public.work_days, public.attendance_records, public.attendance_versions,
  public.confirmations, public.tasks, public.disputes, public.hazards,
  public.hazard_reports, public.hazard_photos, public.daily_summaries
  to authenticated;

-- This Supabase version's default privileges give service_role only
-- Dxtm (truncate/references/trigger/maintain) on public tables, which is not
-- enough for the API write path. Grant it explicitly.
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;

grant execute on function public.current_staff_site_id() to authenticated;
grant execute on function public.current_staff_role() to authenticated;
