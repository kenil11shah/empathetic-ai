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
