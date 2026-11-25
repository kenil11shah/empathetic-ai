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
