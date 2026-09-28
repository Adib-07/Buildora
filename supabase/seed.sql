-- Development/demo seed.
--
-- Two sites on purpose: every IDOR and cross-site test needs a staff member and
-- a set of ids belonging to the *other* site. Ids are fixed literals so tests
-- can reference them without a lookup.
--
-- Dev password for every seeded user: buildora-dev-password
-- (local only -- never reuse outside `supabase start`.)

-- ---------------------------------------------------------------------------
-- Auth identities. Supabase Auth owns sessions; the staff table owns the role.
-- ---------------------------------------------------------------------------

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
values
  ('a1111111-1111-4111-8111-111111111111', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'supervisor@quarryridge.test',
   crypt('buildora-dev-password', gen_salt('bf')), now(), now(), now(),
   '{"provider":"email","providers":["email"]}', '{"name":"Sita Supervisor"}'),
  ('a2222222-2222-4222-8222-222222222222', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'engineer@quarryridge.test',
   crypt('buildora-dev-password', gen_salt('bf')), now(), now(), now(),
   '{"provider":"email","providers":["email"]}', '{"name":"Ravi Engineer"}'),
  ('a3333333-3333-4333-8333-333333333333', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'owner@quarryridge.test',
   crypt('buildora-dev-password', gen_salt('bf')), now(), now(), now(),
   '{"provider":"email","providers":["email"]}', '{"name":"Anita Owner"}'),
  ('b1111111-1111-4111-8111-111111111111', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'supervisor@harbourworks.test',
   crypt('buildora-dev-password', gen_salt('bf')), now(), now(), now(),
   '{"provider":"email","providers":["email"]}', '{"name":"Other Site Supervisor"}');

-- GoTrue scans these nullable text columns into plain Go strings during the
-- password grant, so a NULL makes login fail with a 500 instead of a 401.
-- Without this every seeded account 500s on /token. The phone columns are left
-- NULL on purpose: they are genuinely optional, and auth.users has a unique
-- index on phone that empty strings would collide on.
update auth.users
   set confirmation_token = coalesce(confirmation_token, ''),
       email_change = coalesce(email_change, ''),
       email_change_token_current = coalesce(email_change_token_current, ''),
       email_change_token_new = coalesce(email_change_token_new, ''),
       reauthentication_token = coalesce(reauthentication_token, ''),
       recovery_token = coalesce(recovery_token, '')
 where id in (
   'a1111111-1111-4111-8111-111111111111',
   'a2222222-2222-4222-8222-222222222222',
   'a3333333-3333-4333-8333-333333333333',
   'b1111111-1111-4111-8111-111111111111'
 );

insert into auth.identities (provider_id, user_id, identity_data, provider,
                             last_sign_in_at, created_at, updated_at)
select u.id, u.id, jsonb_build_object('sub', u.id::text, 'email', u.email,
                                      'email_verified', true),
       'email', now(), now(), now()
from auth.users u
where u.id::text like '________-____-____-____-____________';

-- ---------------------------------------------------------------------------
-- Sites and staff
-- ---------------------------------------------------------------------------

insert into public.sites (id, name, timezone, shift_end, summary_cutoff, demo_now)
values
  ('11111111-1111-4111-8111-111111111111', 'Quarry Ridge', 'Asia/Kolkata', '17:30', '20:00', null),
  ('22222222-2222-4222-8222-222222222222', 'Harbour Works', 'Asia/Kolkata', '17:30', '20:00', null);

insert into public.staff (id, site_id, email, full_name, role)
values
  ('a1111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111',
   'supervisor@quarryridge.test', 'Sita Supervisor', 'supervisor'),
  ('a2222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111',
   'engineer@quarryridge.test', 'Ravi Engineer', 'engineer'),
  ('a3333333-3333-4333-8333-333333333333', '11111111-1111-4111-8111-111111111111',
   'owner@quarryridge.test', 'Anita Owner', 'owner'),
  ('b1111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222',
   'supervisor@harbourworks.test', 'Other Site Supervisor', 'supervisor');

-- ---------------------------------------------------------------------------
-- Teams and workers (site A)
-- ---------------------------------------------------------------------------

insert into public.teams (id, site_id, name)
values
  ('0a000001-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'Masonry'),
  ('0a000001-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'Plumbing'),
  ('0b000001-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 'Harbour Crew');

insert into public.workers (id, site_id, team_id, full_name, phone_e164, worker_code, lang, consent, active)
values
  -- Unique phones.
  ('0c000001-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111',
   '0a000001-0000-4000-8000-000000000001', 'Ramesh Kumar', '+919876543210', '4821', 'en', 'given', true),
  ('0c000001-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111',
   '0a000001-0000-4000-8000-000000000001', 'Suresh Patel', '+919876543211', '7390', 'en', 'given', true),
  ('0c000001-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111',
   '0a000001-0000-4000-8000-000000000002', 'Lakshmi Devi', '+919876543212', '1057', 'te', 'given', true),
  -- Same phone as Ramesh: the shared-phone case. A reply without the 4-digit
  -- code must be rejected, which is what the inbound parser tests exercise.
  ('0c000001-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111',
   '0a000001-0000-4000-8000-000000000001', 'Ramesh Second', '+919876543210', '9142', 'en', 'given', true),
  ('0c000001-0000-4000-8000-000000000005', '11111111-1111-4111-8111-111111111111',
   null, 'Inactive Worker', '+919876543213', '6620', 'en', 'withdrawn', false),
  -- Site B, for cross-site isolation tests.
  ('0d000001-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222',
   '0b000001-0000-4000-8000-000000000001', 'Harbour Worker', '+919800000001', '3311', 'en', 'given', true);

-- ---------------------------------------------------------------------------
-- Three work days, the oldest locked, so the summary invariant and the
-- amendment path both have data.
-- ---------------------------------------------------------------------------

insert into public.work_days (id, site_id, work_date, locked_at)
values
  ('1a000001-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111',
   current_date - 2, now() - interval '1 day'),
  ('1a000001-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111',
   current_date - 1, null),
  ('1a000001-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111',
   current_date, null),
  ('1b000001-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222',
   current_date, null);

-- Worker 1 & 4 share a phone, so both get records; worker 5 is inactive and
-- must not appear. States span all three values for the invariant.
insert into public.attendance_records
  (id, site_id, work_day_id, worker_id, status, late, hours, version, worker_state, state_version)
values
  -- Locked day: all confirmed.
  ('2a000001-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111',
   '1a000001-0000-4000-8000-000000000001', '0c000001-0000-4000-8000-000000000001',
   'present', false, 8, 1, 'confirmed', 1),
  ('2a000001-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111',
   '1a000001-0000-4000-8000-000000000001', '0c000001-0000-4000-8000-000000000002',
   'half_day', false, 4, 1, 'confirmed', 1),
  ('2a000001-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111',
   '1a000001-0000-4000-8000-000000000001', '0c000001-0000-4000-8000-000000000003',
   'present', true, 8, 1, 'confirmed', 1),
  ('2a000001-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111',
   '1a000001-0000-4000-8000-000000000001', '0c000001-0000-4000-8000-000000000004',
   'present', false, 8, 1, 'confirmed', 1),
  -- Yesterday: mixed states.
  ('2a000001-0000-4000-8000-000000000005', '11111111-1111-4111-8111-111111111111',
   '1a000001-0000-4000-8000-000000000002', '0c000001-0000-4000-8000-000000000001',
   'present', false, 8, 1, 'disputed', 1),
  ('2a000001-0000-4000-8000-000000000006', '11111111-1111-4111-8111-111111111111',
   '1a000001-0000-4000-8000-000000000002', '0c000001-0000-4000-8000-000000000002',
   'present', false, 8, 1, 'no_reply', null),
  ('2a000001-0000-4000-8000-000000000007', '11111111-1111-4111-8111-111111111111',
   '1a000001-0000-4000-8000-000000000002', '0c000001-0000-4000-8000-000000000003',
   'absent', false, 0, 1, 'no_reply', null),
  ('2a000001-0000-4000-8000-000000000008', '11111111-1111-4111-8111-111111111111',
   '1a000001-0000-4000-8000-000000000002', '0c000001-0000-4000-8000-000000000004',
   'present', false, 8, 1, 'confirmed', 1),
  -- Today: pre-filled from the previous work day.
  ('2a000001-0000-4000-8000-000000000009', '11111111-1111-4111-8111-111111111111',
   '1a000001-0000-4000-8000-000000000003', '0c000001-0000-4000-8000-000000000001',
   'present', false, 8, 1, 'no_reply', null),
  ('2a000001-0000-4000-8000-000000000010', '11111111-1111-4111-8111-111111111111',
   '1a000001-0000-4000-8000-000000000003', '0c000001-0000-4000-8000-000000000002',
   'present', false, 8, 1, 'no_reply', null),
  ('2a000001-0000-4000-8000-000000000011', '11111111-1111-4111-8111-111111111111',
   '1a000001-0000-4000-8000-000000000003', '0c000001-0000-4000-8000-000000000003',
   'present', false, 8, 1, 'no_reply', null),
  ('2a000001-0000-4000-8000-000000000012', '11111111-1111-4111-8111-111111111111',
   '1a000001-0000-4000-8000-000000000003', '0c000001-0000-4000-8000-000000000004',
   'present', false, 8, 1, 'no_reply', null),
  -- Site B.
  ('2b000001-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222',
   '1b000001-0000-4000-8000-000000000001', '0d000001-0000-4000-8000-000000000001',
   'present', false, 8, 1, 'no_reply', null);

insert into public.attendance_versions
  (record_id, version, status, hours, late, changed_at, reason)
values
  ('2a000001-0000-4000-8000-000000000005', 1, 'present', 8, false, now() - interval '1 day', 'pre-fill from previous work day');

insert into public.confirmations (record_id, worker_id, version)
values
  ('2a000001-0000-4000-8000-000000000001', '0c000001-0000-4000-8000-000000000001', 1),
  ('2a000001-0000-4000-8000-000000000008', '0c000001-0000-4000-8000-000000000004', 1);

-- One open dispute, so the unique-per-record rule has a subject.
insert into public.disputes (id, record_id, worker_id, record_version, status, reason_text, created_at)
values
  ('3a000001-0000-4000-8000-000000000001', '2a000001-0000-4000-8000-000000000005',
   '0c000001-0000-4000-8000-000000000001', 1, 'open', 'I left at 2pm not 5pm', now() - interval '1 day');

-- ---------------------------------------------------------------------------
-- Tasks
-- ---------------------------------------------------------------------------

insert into public.tasks (id, site_id, work_day_id, title, location, owner_worker_id, source, created_at)
values
  ('4a000001-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111',
   '1a000001-0000-4000-8000-000000000003', 'Plastering B2', 'Block B floor 2',
   '0c000001-0000-4000-8000-000000000001', 'voice', now()),
  ('4a000001-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111',
   '1a000001-0000-4000-8000-000000000003', 'Fix leaking pipe', 'Block A',
   '0c000001-0000-4000-8000-000000000003', 'text', now());

-- ---------------------------------------------------------------------------
-- Hazards
-- ---------------------------------------------------------------------------

insert into public.hazards
  (id, site_id, code, category, location_text, severity, summary, status,
   owner_worker_id, ai_status, created_at)
values
  ('5a000001-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111',
   'HZ-012', 'fall_edge', 'Block B floor 3', 3, 'Open edge without guardrail',
   'assigned', '0c000001-0000-4000-8000-000000000001', 'ok', now() - interval '2 days'),
  ('5a000001-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111',
   'HZ-013', 'housekeeping', 'Site office', null, 'Debris blocking walkway',
   'reported', null, 'fallback', now() - interval '1 day'),
  ('5a000001-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111',
   'HZ-014', 'electrical', 'Block A meter room', 2, 'Exposed cable near water',
   'fixed_awaiting_reporter', '0c000001-0000-4000-8000-000000000002', 'ok', now() - interval '3 hours');

insert into public.hazard_reports
  (hazard_id, reporter_worker_id, unverified_reporter, transcript, from_phone, received_at)
values
  ('5a000001-0000-4000-8000-000000000001', '0c000001-0000-4000-8000-000000000001', false,
   'H open edge near lift on floor 3 no guard', '+919876543210', now() - interval '2 days'),
  ('5a000001-0000-4000-8000-000000000002', null, true,
   'H walkway blocked near office', '+919999999999', now() - interval '1 day'),
  ('5a000001-0000-4000-8000-000000000003', '0c000001-0000-4000-8000-000000000001', false,
   'H live wire in meter room near water', '+919876543210', now() - interval '3 hours');

-- ---------------------------------------------------------------------------
-- Locked-day summary snapshot
-- ---------------------------------------------------------------------------

insert into public.daily_summaries
  (site_id, work_date, revision, amended, counts, by_team, disputes, tasks,
   hazards, trend, narrative, locked_at)
values
  ('11111111-1111-4111-8111-111111111111', current_date - 2, 1, false,
   '{"total":4,"confirmed":4,"disputed":0,"noReply":0,"disputesOpen":0,"disputesResolved":0}',
   '[{"teamName":"Masonry","total":3,"confirmed":3,"disputed":0,"noReply":0},
     {"teamName":"Plumbing","total":1,"confirmed":1,"disputed":0,"noReply":0}]',
   '[]', '[]',
   '{"opened":1,"closed":0,"open":1,"untriaged":0,"items":[]}',
   '[]', 'All four workers confirmed their records for this shift.', now() - interval '1 day');

-- ---------------------------------------------------------------------------
-- A queued outbox message and an inbound message, so SIM/outbox behaviour is
-- observable without first having to generate traffic.
-- ---------------------------------------------------------------------------

insert into public.messages
  (site_id, worker_id, to_phone, direction, body, template_key, lang, status,
   idempotency_key)
values
  ('11111111-1111-4111-8111-111111111111', '0c000001-0000-4000-8000-000000000001',
   '+919876543210', 'out',
   'Buildora record for today. Reply 1 if correct, 2 if wrong.', 'record', 'en',
   'queued', 'record:seed:0c000001-0000-4000-8000-000000000001:1');

insert into public.inbound_messages (site_id, from_phone, kind, text, received_at)
values
  ('11111111-1111-4111-8111-111111111111', '+919876543210', 'sms', '1 4821', now() - interval '1 hour');
