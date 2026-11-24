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
