-- XPlan API surface. The `xplan` schema isn't in the Data API's exposed schemas (a
-- dashboard-only setting), so, like the weather app, it is exposed through thin
-- security_invoker views: the caller's RLS policies on xplan.* apply and the views add
-- no privileges. Writes through the views still fire the xplan.tasks triggers.
create view public.xplan_tasks with (security_invoker = true) as
  select id, user_id, title, notes, priority, due_date, due_time, recurrence, recur_interval,
         project_id, tags, status, completed_at, xp_awarded, on_time, spawned_from, created_at, updated_at
  from xplan.tasks;
create view public.xplan_projects with (security_invoker = true) as
  select id, user_id, name, color, created_at from xplan.projects;
create view public.xplan_profiles with (security_invoker = true) as
  select user_id, display_name, avatar, skin, accent, time_zone, created_at, updated_at from xplan.profiles;
create view public.xplan_achievements with (security_invoker = true) as
  select user_id, code, unlocked_at from xplan.achievements;

comment on view public.xplan_tasks is 'XPlan API surface for xplan.tasks (RLS enforced via security_invoker).';
comment on view public.xplan_projects is 'XPlan API surface for xplan.projects (RLS enforced via security_invoker).';
comment on view public.xplan_profiles is 'XPlan API surface for xplan.profiles (RLS enforced via security_invoker).';
comment on view public.xplan_achievements is 'XPlan API surface for xplan.achievements (read-only, RLS enforced).';

revoke all on public.xplan_tasks, public.xplan_projects, public.xplan_profiles, public.xplan_achievements from public, anon;
grant select, insert, update, delete on public.xplan_tasks, public.xplan_projects, public.xplan_profiles to authenticated;
grant select on public.xplan_achievements to authenticated;
grant all on public.xplan_tasks, public.xplan_projects, public.xplan_profiles, public.xplan_achievements to service_role;

-- Create (or refresh the time zone of) the caller's player profile.
create or replace function public.xplan_bootstrap(tz text, name text default 'Player')
returns setof public.xplan_profiles
language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Not signed in' using errcode = '42501'; end if;
  insert into xplan.profiles (user_id, display_name, time_zone)
  values (auth.uid(), left(coalesce(nullif(btrim(name), ''), 'Player'), 32), coalesce(nullif(tz, ''), 'UTC'))
  on conflict (user_id) do update set time_zone = excluded.time_zone;
  return query select * from public.xplan_profiles where user_id = auth.uid();
end $$;

-- Player stats, computed in the database from the XP ledger and completed quests.
create or replace function public.xplan_stats(days integer default 182)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  tz text;
  today date;
  total integer;
  lvl integer;
  s record;
  r jsonb;
begin
  if uid is null then raise exception 'Not signed in' using errcode = '42501'; end if;
  days := least(greatest(coalesce(days, 182), 7), 371);
  tz := xplan.user_tz(uid);
  today := (now() at time zone tz)::date;
  select coalesce(sum(xp), 0)::integer into total from xplan.xp_events where user_id = uid;
  lvl := xplan.level_for(total);
  select * into s from xplan.streaks(uid);
  select jsonb_build_object(
    'total_xp', total,
    'level', lvl,
    'level_floor', xplan.level_threshold(lvl),
    'level_next', xplan.level_threshold(lvl + 1),
    'current_streak', s.current_streak,
    'best_streak', s.best_streak,
    'done', count(*) filter (where status = 'done'),
    'open', count(*) filter (where status = 'open'),
    'overdue', count(*) filter (where status = 'open' and due_date < today),
    'done_today', count(*) filter (where status = 'done' and (completed_at at time zone tz)::date = today),
    'clear_rate', round(100.0 * count(*) filter (where status = 'done' and created_at > now() - interval '30 days')
                        / nullif(count(*) filter (where created_at > now() - interval '30 days'), 0)),
    'on_time_pct', round(100.0 * count(*) filter (where on_time)
                         / nullif(count(*) filter (where on_time is not null), 0)),
    'today', today
  ) into r
  from xplan.tasks where user_id = uid;

  return r || jsonb_build_object(
    'xp_today', (select coalesce(sum(xp), 0) from xplan.xp_events
                  where user_id = uid and created_at >= (today::timestamp at time zone tz)),
    'heatmap', (select coalesce(jsonb_agg(jsonb_build_object('d', d, 'n', n) order by d), '[]'::jsonb)
                  from (select (completed_at at time zone tz)::date as d, count(*) as n
                          from xplan.tasks
                         where user_id = uid and status = 'done'
                           and completed_at >= ((today - days)::timestamp at time zone tz)
                         group by 1) h));
end $$;

-- /demo: give an anonymous guest a lived-in save file (history, streak, quests for today),
-- parked a few XP short of the next level so their first completion levels them up.
create or replace function public.xplan_start_demo(tz text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  today date;
  p_work uuid; p_health uuid; p_home uuid; p_learn uuid;
  titles text[] := array['Inbox zero', 'Code review', '30 min walk', 'Write standup notes', 'Refactor auth hook',
    'Meal prep', 'Read 20 pages', 'Fix flaky test', 'Call mom', 'Stretch', 'Update portfolio', 'Laundry',
    'Practice Spanish', 'Pay electric bill', 'Plan the week', 'Ship a small PR'];
  d integer; k integer; n integer; pr smallint; ts timestamptz; ot boolean; gained integer; tid uuid;
  total integer; lvl integer; target integer;
begin
  if uid is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) is false then
    raise exception 'The demo save file is for guest sessions only' using errcode = '42501';
  end if;
  insert into xplan.profiles (user_id, display_name, avatar, skin, time_zone)
  values (uid, 'Guest Player', 'sword', 'forge', coalesce(nullif(tz, ''), 'UTC'))
  on conflict (user_id) do update set time_zone = excluded.time_zone;
  if exists (select 1 from xplan.tasks where user_id = uid) then return; end if;
  today := (now() at time zone xplan.user_tz(uid))::date;
  tz := xplan.user_tz(uid);

  insert into xplan.projects (user_id, name, color) values (uid, 'Work', '#f97316') returning id into p_work;
  insert into xplan.projects (user_id, name, color) values (uid, 'Health', '#22c55e') returning id into p_health;
  insert into xplan.projects (user_id, name, color) values (uid, 'Home', '#a855f7') returning id into p_home;
  insert into xplan.projects (user_id, name, color) values (uid, 'Learning', '#0ea5e9') returning id into p_learn;

  -- ~5 weeks of history with a few rest days; the last 6 days form the current combo.
  for d in 1..34 loop
    continue when d in (7, 12, 13, 20, 26, 31);
    n := 1 + (d * 7) % 3;
    for k in 0..n - 1 loop
      pr := (1 + (d + k) % 4)::smallint;
      ot := (d + k) % 5 <> 0;
      ts := ((today - d) + time '07:40' + make_interval(hours => k * 4 + (d % 3), mins => (d * 13) % 50)) at time zone tz;
      gained := xplan.xp_for(pr, ot);
      insert into xplan.tasks (user_id, title, priority, due_date, project_id, status, completed_at,
                               xp_awarded, on_time, created_at)
      values (uid, titles[1 + (d * 3 + k) % array_length(titles, 1)], pr,
              case when ot then today - d else today - d - 2 end,
              (array[p_work, p_health, p_home, p_learn])[1 + (d + k) % 4],
              'done', ts, gained, ot, ts - interval '2 days')
      returning id into tid;
      insert into xplan.xp_events (user_id, task_id, kind, xp, created_at) values (uid, tid, 'seed', gained, ts);
    end loop;
  end loop;

  insert into xplan.tasks (user_id, title, notes, priority, due_date, due_time, recurrence, project_id, tags) values
    (uid, 'Ship the XPlan case study', 'Screens, write-up, and a link from the portfolio.', 4, today, time '17:00', null, p_work, '{portfolio}'),
    (uid, 'Morning stretch', '', 1, today, null, 'daily', p_health, '{habit}'),
    (uid, 'Read 20 pages', '', 1, today, null, 'daily', p_learn, '{habit}'),
    (uid, 'Water the plants', '', 2, today, null, 'weekly', p_home, '{}'),
    (uid, 'Review pull requests', '', 3, today - 1, null, null, p_work, '{code}'),
    (uid, 'Back up photos', '', 2, today - 3, null, null, p_home, '{}'),
    (uid, 'Plan next sprint', '', 3, today + 1, time '10:00', null, p_work, '{}'),
    (uid, 'Gym: leg day', '', 2, today + 1, null, 'weekly', p_health, '{}'),
    (uid, 'Book dentist appointment', '', 2, today + 3, null, null, p_home, '{errand}'),
    (uid, 'Pay rent', '', 4, today + 5, null, 'monthly', p_home, '{bills}'),
    (uid, 'Learn a new keyboard shortcut', '', 1, null, null, null, p_learn, '{}'),
    (uid, 'Clean up desktop files', '', 1, null, null, null, null, '{}');

  -- Park the guest 15 XP short of the next level.
  select coalesce(sum(xp), 0)::integer into total from xplan.xp_events where user_id = uid;
  lvl := xplan.level_for(total);
  target := xplan.level_threshold(lvl + 1) - 15;
  if target < total then target := xplan.level_threshold(lvl + 2) - 15; end if;
  if target > total then
    insert into xplan.xp_events (user_id, kind, xp, created_at) values (uid, 'seed', target - total, now() - interval '1 day');
  end if;
  perform xplan.check_achievements(uid);
end $$;

revoke all on function public.xplan_bootstrap(text, text), public.xplan_stats(integer), public.xplan_start_demo(text) from public, anon;
grant execute on function public.xplan_bootstrap(text, text), public.xplan_stats(integer), public.xplan_start_demo(text) to authenticated;
