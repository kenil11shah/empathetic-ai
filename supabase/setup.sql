-- Empathetic AI — full database setup (migrations 0001–0005 combined).
-- Paste into Supabase → SQL Editor → New query → Run. Run once.

-- Empathetic AI — initial schema
-- Every user-owned table references auth.users(id) ON DELETE CASCADE so account deletion
-- purges all active records. Row Level Security (RLS) scopes every row to its owner.

-- gen_random_uuid() is built into Postgres 13+ (Supabase runs 15+).

-- ---------------------------------------------------------------- profiles & consent
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (char_length(display_name) <= 80),
  timezone text not null default 'UTC',
  locale text not null default 'en',
  country text not null default 'IN',
  default_mode text not null default 'just_listen',
  adult_confirmed boolean not null default false,
  disclosure_version text,
  voice_output boolean not null default false,
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.consents (
  user_id uuid not null references auth.users(id) on delete cascade,
  consent_type text not null check (consent_type in
    ('memory','emotion_history','insights','voice_processing','research')),
  granted boolean not null default false,
  version text not null default '2026-11',
  updated_at timestamptz not null default now(),
  primary key (user_id, consent_type)
);

-- ---------------------------------------------------------------- conversation
create table public.chat_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'New conversation' check (char_length(title) <= 120),
  mode text not null default 'just_listen' check (mode in
    ('just_listen','help_me_think','problem_solver','motivate_me','self_reflection','casual','calm_me_down')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index chat_sessions_user_idx on public.chat_sessions(user_id, updated_at desc);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.chat_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null check (char_length(content) <= 8000),
  request_id text not null,
  safety_route text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (session_id, role, request_id)
);
create index messages_session_idx on public.messages(session_id, created_at);
create index messages_user_idx on public.messages(user_id, created_at);

create table public.emotion_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  message_id uuid references public.messages(id) on delete cascade,
  source text not null check (source in ('inferred','self_report')),
  modality text not null default 'text',
  labels jsonb not null default '{}'::jsonb,
  top_label text not null,
  uncertainty numeric,
  quality jsonb not null default '{}'::jsonb,
  inferred_intent text,
  model_version text,
  corrected_label text,
  dismissed boolean not null default false,
  created_at timestamptz not null default now()
);
create index emotion_events_user_idx on public.emotion_events(user_id, created_at desc);

create table public.session_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid references public.chat_sessions(id) on delete set null,
  helpful boolean not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- memory
create table public.memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  summary text not null check (char_length(summary) between 1 and 400),
  category text not null default 'other' check (category in
    ('preference','goal','helpful_activity','event','theme','other')),
  source_type text not null default 'manual' check (source_type in ('manual','chat_proposal')),
  source_id uuid,
  consent_status text not null default 'approved',
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index memories_user_idx on public.memories(user_id, updated_at desc);

-- ---------------------------------------------------------------- self-report
create table public.checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mood smallint not null check (mood between 1 and 5),
  stress smallint not null check (stress between 1 and 10),
  energy smallint not null check (energy between 1 and 10),
  sleep_hours numeric(4,1) check (sleep_hours between 0 and 24),
  emotions text[] not null default '{}',
  tags text[] not null default '{}',
  notes text check (char_length(notes) <= 2000),
  local_date date not null,
  timezone text not null default 'UTC',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index checkins_user_idx on public.checkins(user_id, local_date desc);

create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default '' check (char_length(title) <= 200),
  body text not null default '' check (char_length(body) <= 20000),
  tags text[] not null default '{}',
  source_session_id uuid references public.chat_sessions(id) on delete set null,
  source_kind text not null default 'manual' check (source_kind in ('manual','voice','chat','ai_proposal')),
  ai_summary text check (char_length(ai_summary) <= 2000),
  ai_summary_source text,
  entry_date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index journal_user_idx on public.journal_entries(user_id, entry_date desc);

-- ---------------------------------------------------------------- agent actions
create table public.proposals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid references public.chat_sessions(id) on delete cascade,
  type text not null check (type in ('task_plan','journal_entry','memory')),
  preview text not null,
  reason text not null default '',
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected','expired','cancelled')),
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  idempotency_key text not null unique,
  result jsonb,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create index proposals_user_idx on public.proposals(user_id, status, created_at desc);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  notes text check (char_length(notes) <= 2000),
  due_date date,
  status text not null default 'todo' check (status in ('todo','done')),
  source_session_id uuid references public.chat_sessions(id) on delete set null,
  source_proposal_id uuid references public.proposals(id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tasks_user_idx on public.tasks(user_id, status, created_at desc);

-- ---------------------------------------------------------------- wellness & safety
create table public.wellness_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_id text not null,
  duration_seconds integer not null check (duration_seconds between 0 and 7200),
  completed boolean not null default false,
  helpful text check (helpful in ('yes','somewhat','no')),
  created_at timestamptz not null default now()
);
create index wellness_user_idx on public.wellness_sessions(user_id, created_at desc);

create table public.safety_plans (
  user_id uuid primary key references auth.users(id) on delete cascade,
  warning_signs text not null default '' check (char_length(warning_signs) <= 2000),
  coping_steps text not null default '' check (char_length(coping_steps) <= 2000),
  reasons text not null default '' check (char_length(reasons) <= 2000),
  safe_places text not null default '' check (char_length(safe_places) <= 2000),
  professional_contacts text not null default '' check (char_length(professional_contacts) <= 2000),
  updated_at timestamptz not null default now()
);

create table public.trusted_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  phone text check (char_length(phone) <= 30),
  relationship text check (char_length(relationship) <= 60),
  note text check (char_length(note) <= 300),
  created_at timestamptz not null default now()
);

-- Minimal, content-free safety telemetry: route + policy version only.
create table public.safety_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  stage text not null check (stage in ('input','output')),
  route text not null,
  categories text[] not null default '{}',
  policy_version text not null,
  outcome text not null,
  created_at timestamptz not null default now()
);

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null,
  entity text not null,
  entity_id text,
  created_at timestamptz not null default now()
);

-- Content-free usage counter for per-user rate limits.
create table public.usage_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  created_at timestamptz not null default now()
);
create index usage_user_idx on public.usage_events(user_id, kind, created_at desc);

-- ---------------------------------------------------------------- row level security
do $$
declare t text;
begin
  foreach t in array array['consents','chat_sessions','messages','emotion_events','session_feedback',
    'memories','checkins','journal_entries','proposals','tasks','wellness_sessions','safety_plans',
    'trusted_contacts','safety_events','audit_log','usage_events']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t || '_owner', t);
  end loop;
end $$;

alter table public.profiles enable row level security;
create policy profiles_owner on public.profiles for all to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Messages must belong to a session the user owns.
create policy messages_session_owner on public.messages as restrictive for insert to authenticated
  with check (exists (select 1 from public.chat_sessions s where s.id = session_id and s.user_id = auth.uid()));

-- Safety and audit telemetry are append-only for users.
create policy safety_events_no_update on public.safety_events as restrictive for update to authenticated using (false);
create policy audit_log_no_update on public.audit_log as restrictive for update to authenticated using (false);

-- ---------------------------------------------------------------- triggers
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

do $$
declare t text;
begin
  foreach t in array array['profiles','chat_sessions','memories','checkins','journal_entries','tasks']
  loop
    execute format('create trigger %I before update on public.%I for each row execute function public.touch_updated_at()', t || '_touch', t);
  end loop;
end $$;

-- Create a profile row automatically for every new auth user (including anonymous guests).
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------- approval RPC
-- Atomic, idempotent execution of an approved proposal. Runs as the calling user
-- (SECURITY INVOKER) so RLS still applies to every row it reads or writes.
create or replace function public.approve_proposal(p_id uuid, p_payload jsonb)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  p public.proposals;
  item jsonb;
  new_id uuid;
  ids uuid[] := '{}';
  res jsonb;
  memory_ok boolean;
begin
  select * into p from public.proposals where id = p_id and user_id = auth.uid() for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if p.status = 'approved' then
    return p.result || jsonb_build_object('replayed', true);
  end if;
  if p.status <> 'pending' then
    return jsonb_build_object('ok', false, 'code', 'not_pending', 'status', p.status);
  end if;
  if p.expires_at < now() then
    update public.proposals set status = 'expired', decided_at = now() where id = p.id;
    return jsonb_build_object('ok', false, 'code', 'expired');
  end if;

  if p.type = 'task_plan' then
    if jsonb_typeof(p_payload->'tasks') <> 'array' or jsonb_array_length(p_payload->'tasks') not between 1 and 8 then
      return jsonb_build_object('ok', false, 'code', 'invalid_payload');
    end if;
    for item in select * from jsonb_array_elements(p_payload->'tasks') loop
      insert into public.tasks (user_id, title, due_date, source_session_id, source_proposal_id)
      values (auth.uid(), left(trim(item->>'title'), 200), nullif(item->>'due_date','')::date, p.session_id, p.id)
      returning id into new_id;
      ids := ids || new_id;
    end loop;
    res := jsonb_build_object('ok', true, 'type', 'task_plan', 'task_ids', to_jsonb(ids));
  elsif p.type = 'journal_entry' then
    insert into public.journal_entries (user_id, title, body, tags, source_session_id, source_kind)
    values (auth.uid(), left(coalesce(p_payload->>'title',''), 200), left(coalesce(p_payload->>'body',''), 20000),
            coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(p_payload->'tags','[]'::jsonb)) x), '{}'),
            p.session_id, 'ai_proposal')
    returning id into new_id;
    res := jsonb_build_object('ok', true, 'type', 'journal_entry', 'journal_id', new_id);
  elsif p.type = 'memory' then
    select coalesce((select granted from public.consents where user_id = auth.uid() and consent_type = 'memory'), false)
      into memory_ok;
    if not memory_ok then
      return jsonb_build_object('ok', false, 'code', 'consent_required');
    end if;
    insert into public.memories (user_id, summary, category, source_type, source_id)
    values (auth.uid(), left(p_payload->>'summary', 400), coalesce(p_payload->>'category','other'), 'chat_proposal', p.id)
    returning id into new_id;
    res := jsonb_build_object('ok', true, 'type', 'memory', 'memory_id', new_id);
  else
    return jsonb_build_object('ok', false, 'code', 'unknown_type');
  end if;

  update public.proposals
     set status = 'approved', payload = p_payload, result = res, decided_at = now()
   where id = p.id;
  insert into public.audit_log (user_id, action, entity, entity_id)
  values (auth.uid(), 'approve', 'proposal', p.id::text);
  return res;
end $$;

grant execute on function public.approve_proposal(uuid, jsonb) to authenticated;

-- Synthetic sample data so visitors can explore Insights without weeks of check-ins.
-- Runs as the calling user (RLS applies). Every row is tagged "sample" and can be removed.

create or replace function public.seed_sample_data()
returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  uid uuid := auth.uid();
  d int;
  tz text;
  today date;
begin
  if uid is null then return jsonb_build_object('ok', false, 'code', 'unauthenticated'); end if;
  if exists (select 1 from public.checkins where user_id = uid and 'sample' = any(tags)) then
    return jsonb_build_object('ok', true, 'already', true);
  end if;
  select coalesce(timezone, 'UTC') into tz from public.profiles where id = uid;
  today := (now() at time zone coalesce(tz, 'UTC'))::date;

  for d in 1..20 loop
    continue when d % 4 = 0; -- leave honest gaps
    insert into public.checkins (user_id, mood, stress, energy, sleep_hours, emotions, tags, notes, local_date, timezone)
    values (
      uid,
      greatest(1, least(5, 3 + ((d * 7) % 5) - 2 + case when d % 3 = 0 then 1 else 0 end)),
      greatest(1, least(10, 4 + ((d * 5) % 7) - 2)),
      greatest(1, least(10, 5 + ((d * 3) % 5) - 2)),
      6 + (d % 3),
      case d % 5 when 0 then array['joy'] when 1 then array['fear_anxiety'] when 2 then array['frustration'] when 3 then array['calm'] else array['sadness'] end,
      array['sample', case d % 3 when 0 then 'exams' when 1 then 'work' else 'family' end],
      null,
      today - d,
      coalesce(tz, 'UTC')
    );
  end loop;

  insert into public.journal_entries (user_id, title, body, tags, entry_date) values
    (uid, 'Sample: after the mock interview', 'This is sample text. It went better than I expected. I stumbled on the second question but recovered, and I noticed I talk faster when I am nervous.', array['sample','interviews'], today - 2),
    (uid, 'Sample: a slow Sunday', 'This is sample text. Took a long walk, cooked, and did not open my laptop. Felt more rested than I have in a while.', array['sample'], today - 6);

  insert into public.tasks (user_id, title, status, completed_at) values
    (uid, '(sample) List all deadlines with dates', 'done', now() - interval '2 days'),
    (uid, '(sample) Write one rough paragraph of the report', 'todo', null),
    (uid, '(sample) Take a 10-minute walk after lunch', 'todo', null);

  return jsonb_build_object('ok', true);
end $$;

create or replace function public.remove_sample_data()
returns jsonb language plpgsql security invoker set search_path = public as $$
begin
  delete from public.checkins where user_id = auth.uid() and 'sample' = any(tags);
  delete from public.journal_entries where user_id = auth.uid() and 'sample' = any(tags);
  delete from public.tasks where user_id = auth.uid() and title like '(sample)%';
  return jsonb_build_object('ok', true);
end $$;

grant execute on function public.seed_sample_data() to authenticated;
grant execute on function public.remove_sample_data() to authenticated;

-- Keep-alive: a tiny, content-free query the daily Vercel cron calls so the free
-- Supabase project always shows activity and is never paused for inactivity.
create table if not exists public.heartbeat (
  id smallint primary key default 1 check (id = 1),
  beat_at timestamptz not null default now()
);
alter table public.heartbeat enable row level security;
insert into public.heartbeat (id) values (1) on conflict do nothing;

create or replace function public.keepalive()
returns timestamptz language sql security definer set search_path = public as $$
  update public.heartbeat set beat_at = now() where id = 1 returning beat_at;
$$;

grant execute on function public.keepalive() to anon, authenticated;

-- Trusted contacts can have an email address, so the user can reach them in one tap.
-- The app never sends anything itself: links open the user's own email, SMS or phone app.
alter table public.trusted_contacts add column if not exists email text;
do $$ begin
  alter table public.trusted_contacts add constraint trusted_contacts_email_len check (email is null or char_length(email) <= 254);
exception when duplicate_object then null;
end $$;

-- Table access for the Data API.
-- Supabase projects created after 30 May 2026 (and all projects from 30 Oct 2026)
-- no longer grant table access to the API roles automatically. Without these
-- grants every read or write from the app fails with "permission denied".
-- Row level security (0001) still decides which rows each user can touch.
-- Safe to run more than once.

grant usage on schema public to anon, authenticated, service_role;

do $$
declare t text;
begin
  foreach t in array array['profiles','consents','chat_sessions','messages','emotion_events',
    'session_feedback','memories','checkins','journal_entries','proposals','tasks',
    'wellness_sessions','safety_plans','trusted_contacts','safety_events','audit_log','usage_events']
  loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end $$;

-- Signed-out visitors (anon) get no table access. They can only call keepalive().
grant execute on function public.keepalive() to anon, authenticated;
grant execute on function public.approve_proposal(uuid, jsonb) to authenticated;
grant execute on function public.seed_sample_data() to authenticated;
grant execute on function public.remove_sample_data() to authenticated;
