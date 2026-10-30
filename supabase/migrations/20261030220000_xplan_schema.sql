-- XPlan: a gamified task manager. Everything lives in its own `xplan` schema in the
-- shared Supabase project (same approach as the `weather` schema), separate from the blog.
--
-- Trust model: the client may create and edit quests, and flip status between open/done.
-- XP, completion time, on-time flags, recurrence spawning and achievements are decided
-- by triggers in the database, so a player cannot award themselves XP.
create schema if not exists xplan;
comment on schema xplan is 'XPlan (JoshuaMColon/task-manager). Separate from the blog and weather app.';
revoke all on schema xplan from public, anon;
grant usage on schema xplan to authenticated, service_role;

-- ---------------------------------------------------------------- tables
create table xplan.profiles (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  display_name text not null default 'Player' check (char_length(btrim(display_name)) between 1 and 32),
  avatar text not null default 'sword' check (avatar ~ '^[a-z0-9-]{1,24}$'),
  skin text not null default 'forge' check (skin in ('forge', 'bloom', 'slate')),
  accent text check (accent ~ '^#[0-9a-fA-F]{6}$'),
  time_zone text not null default 'UTC' check (char_length(time_zone) between 1 and 64),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table xplan.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  color text not null default '#f97316' check (color ~ '^#[0-9a-fA-F]{6}$'),
  created_at timestamptz not null default now()
);
create unique index projects_user_name_key on xplan.projects (user_id, lower(name));

create table xplan.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  notes text not null default '' check (char_length(notes) <= 2000),
  priority smallint not null default 2 check (priority between 1 and 4),
  due_date date,
  due_time time,
  recurrence text check (recurrence in ('daily', 'weekdays', 'weekly', 'monthly', 'yearly')),
  recur_interval smallint not null default 1 check (recur_interval between 1 and 365),
  project_id uuid references xplan.projects (id) on delete set null,
  tags text[] not null default '{}' check (cardinality(tags) <= 8),
  status text not null default 'open' check (status in ('open', 'done')),
  completed_at timestamptz,
  xp_awarded integer not null default 0,
  on_time boolean,
  spawned_from uuid references xplan.tasks (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tasks_time_needs_date check (due_time is null or due_date is not null),
  constraint tasks_done_has_time check ((status = 'done') = (completed_at is not null))
);
create index tasks_user_open_due_idx on xplan.tasks (user_id, due_date) where status = 'open';
create index tasks_user_done_idx on xplan.tasks (user_id, completed_at desc) where status = 'done';
create index tasks_tags_idx on xplan.tasks using gin (tags);
create index tasks_project_idx on xplan.tasks (project_id);
create index tasks_spawned_from_idx on xplan.tasks (spawned_from);

-- Append-only XP ledger, written only by triggers / definer functions.
create table xplan.xp_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  task_id uuid references xplan.tasks (id) on delete set null,
  kind text not null check (kind in ('complete', 'undo', 'seed')),
  xp integer not null,
  created_at timestamptz not null default now()
);
create index xp_events_user_idx on xplan.xp_events (user_id, created_at desc);
create index xp_events_task_idx on xplan.xp_events (task_id);

create table xplan.achievements (
  user_id uuid not null references auth.users (id) on delete cascade,
  code text not null check (code ~ '^[a-z0-9_]{1,32}$'),
  unlocked_at timestamptz not null default now(),
  primary key (user_id, code)
);

-- ---------------------------------------------------------------- game rules
-- Total XP needed to reach level L is 25n^2 + 75n with n = L - 1
-- (100 XP for level 2, then each level costs 50 XP more than the last).
create or replace function xplan.level_threshold(lvl integer)
returns integer language sql immutable set search_path = '' as $$
  select (25 * (greatest(lvl, 1) - 1) * (greatest(lvl, 1) - 1) + 75 * (greatest(lvl, 1) - 1))::integer
$$;

create or replace function xplan.level_for(total_xp integer)
returns integer language plpgsql immutable set search_path = '' as $$
declare n integer;
begin
  if coalesce(total_xp, 0) <= 0 then return 1; end if;
  n := floor((-75 + sqrt(5625 + 100 * total_xp::numeric)) / 50)::integer;
  while xplan.level_threshold(n + 2) <= total_xp loop n := n + 1; end loop;
  while n > 0 and xplan.level_threshold(n + 1) > total_xp loop n := n - 1; end loop;
  return n + 1;
end $$;

-- Low 10, Normal 20, High 35, Urgent 50; +50% for finishing on or before the due date.
create or replace function xplan.xp_for(priority smallint, on_time boolean)
returns integer language sql immutable set search_path = '' as $$
  select base + case when on_time then base / 2 else 0 end
  from (select case priority when 1 then 10 when 2 then 20 when 3 then 35 else 50 end as base) b
$$;

create or replace function xplan.next_due(rule text, step integer, from_date date)
returns date language plpgsql immutable set search_path = '' as $$
declare d date := from_date;
begin
  step := greatest(coalesce(step, 1), 1);
  case rule
    when 'daily' then return from_date + step;
    when 'weekly' then return from_date + 7 * step;
    when 'monthly' then return (from_date + make_interval(months => step))::date;
    when 'yearly' then return (from_date + make_interval(years => step))::date;
    when 'weekdays' then
      loop
        d := d + 1;
        exit when extract(isodow from d) < 6;
      end loop;
      return d;
    else return null;
  end case;
end $$;

create or replace function xplan.user_tz(uid uuid)
returns text language sql stable security invoker set search_path = '' as $$
  select coalesce((select time_zone from xplan.profiles where user_id = uid), 'UTC')
$$;

-- Current and best streak ("combo"): consecutive local days with at least one completion.
create or replace function xplan.streaks(uid uuid)
returns table (current_streak integer, best_streak integer)
language sql stable security definer set search_path = '' as $$
  with tz as (select xplan.user_tz(uid) as z),
  days as (
    select distinct (t.completed_at at time zone (select z from tz))::date as d
    from xplan.tasks t where t.user_id = uid and t.status = 'done'
  ),
  grouped as (select d, d - (row_number() over (order by d))::integer as grp from days),
  islands as (select max(d) as last_day, count(*)::integer as len from grouped group by grp)
  select
    coalesce((select len from islands
              where last_day >= (now() at time zone (select z from tz))::date - 1
              order by last_day desc limit 1), 0),
    coalesce((select max(len) from islands), 0)
$$;

-- ---------------------------------------------------------------- triggers
create or replace function xplan.touch_profile()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  perform now() at time zone new.time_zone; -- rejects unknown time zones
  new.display_name := btrim(new.display_name);
  new.updated_at := now();
  if tg_op = 'UPDATE' then new.user_id := old.user_id; new.created_at := old.created_at; end if;
  return new;
end $$;
create trigger profiles_touch before insert or update on xplan.profiles
  for each row execute function xplan.touch_profile();

create or replace function xplan.guard_project()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  new.name := btrim(new.name);
  if tg_op = 'INSERT' then
    if (select count(*) from xplan.projects where user_id = new.user_id) >= 30 then
      raise exception 'You can have up to 30 projects' using errcode = 'check_violation';
    end if;
  else
    new.user_id := old.user_id; new.created_at := old.created_at;
  end if;
  return new;
end $$;
create trigger projects_guard before insert or update on xplan.projects
  for each row execute function xplan.guard_project();

-- Runs as the caller, so `current_user` tells client writes ('authenticated')
-- apart from trusted writes made inside security definer functions.
create or replace function xplan.guard_task()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  trusted boolean := current_user not in ('authenticated', 'anon');
  tz text;
  local_today date;
  rewarded integer;
begin
  new.title := btrim(new.title);
  new.updated_at := now();
  new.tags := coalesce(
    (select array_agg(distinct t order by t)
       from (select lower(btrim(x)) as t from unnest(new.tags) as x) s where t <> ''),
    '{}');
  if exists (select 1 from unnest(new.tags) as t where t !~ '^[a-z0-9][a-z0-9_-]{0,23}$') then
    raise exception 'Tags use letters, numbers, - and _ (max 24)' using errcode = 'check_violation';
  end if;
  if new.recurrence is not null and new.due_date is null then
    raise exception 'Repeating quests need a due date' using errcode = 'check_violation';
  end if;
  if new.project_id is not null and not exists (
    select 1 from xplan.projects p where p.id = new.project_id and p.user_id = new.user_id) then
    raise exception 'Unknown project' using errcode = 'foreign_key_violation';
  end if;

  if tg_op = 'INSERT' then
    if not trusted then
      new.status := 'open'; new.completed_at := null; new.xp_awarded := 0;
      new.on_time := null; new.spawned_from := null; new.created_at := now();
      if (select count(*) from xplan.tasks where user_id = new.user_id) >= 2000 then
        raise exception 'Quest limit reached (2000)' using errcode = 'check_violation';
      end if;
    end if;
    return new;
  end if;

  new.user_id := old.user_id; new.created_at := old.created_at; new.spawned_from := old.spawned_from;
  if trusted then return new; end if;
  new.xp_awarded := old.xp_awarded; new.completed_at := old.completed_at; new.on_time := old.on_time;

  if old.status = 'open' and new.status = 'done' then
    tz := xplan.user_tz(new.user_id);
    local_today := (now() at time zone tz)::date;
    new.completed_at := now();
    -- Judge against the values from before this write, so a quest can't be re-dated while completing it.
    new.on_time := case when old.due_date is null then null else local_today <= old.due_date end;
    select count(*) into rewarded from xplan.tasks t
     where t.user_id = new.user_id and t.status = 'done' and t.xp_awarded > 0
       and t.completed_at >= (local_today::timestamp at time zone tz);
    -- Anti-farming: only the first 30 completions per day earn XP.
    new.xp_awarded := case when rewarded >= 30 then 0 else xplan.xp_for(old.priority, coalesce(new.on_time, false)) end;
  elsif old.status = 'done' and new.status = 'open' then
    new.completed_at := null; new.on_time := null; new.xp_awarded := 0;
  end if;
  return new;
end $$;
create trigger tasks_guard before insert or update on xplan.tasks
  for each row execute function xplan.guard_task();

create or replace function xplan.check_achievements(uid uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  tz text := xplan.user_tz(uid);
  done_n integer; on_time_n integer; hard_n integer; recur_n integer; early_n integer; late_n integer;
  total integer; lvl integer; cur integer; best integer;
begin
  select count(*),
         count(*) filter (where on_time),
         count(*) filter (where priority >= 3),
         count(*) filter (where recurrence is not null),
         count(*) filter (where extract(hour from completed_at at time zone tz) < 9),
         count(*) filter (where extract(hour from completed_at at time zone tz) >= 22)
    into done_n, on_time_n, hard_n, recur_n, early_n, late_n
    from xplan.tasks where user_id = uid and status = 'done';
  select coalesce(sum(xp), 0) into total from xplan.xp_events where user_id = uid;
  lvl := xplan.level_for(total);
  select s.current_streak, s.best_streak into cur, best from xplan.streaks(uid) s;

  insert into xplan.achievements (user_id, code)
  select uid, c from (values
    ('first_quest', done_n >= 1), ('quests_10', done_n >= 10), ('quests_50', done_n >= 50),
    ('quests_100', done_n >= 100), ('combo_3', best >= 3), ('combo_7', best >= 7),
    ('combo_30', best >= 30), ('level_5', lvl >= 5), ('level_10', lvl >= 10),
    ('on_time_10', on_time_n >= 10), ('boss_5', hard_n >= 5), ('routine_5', recur_n >= 5),
    ('early_bird', early_n >= 1), ('night_owl', late_n >= 1)
  ) as v(c, ok)
  where ok
  on conflict do nothing;
end $$;

create or replace function xplan.after_task_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  local_today date;
  nxt date;
  i integer := 0;
begin
  if old.status = 'open' and new.status = 'done' then
    if new.xp_awarded <> 0 then
      insert into xplan.xp_events (user_id, task_id, kind, xp) values (new.user_id, new.id, 'complete', new.xp_awarded);
    end if;
    if new.recurrence is not null and new.due_date is not null then
      local_today := (now() at time zone xplan.user_tz(new.user_id))::date;
      nxt := xplan.next_due(new.recurrence, new.recur_interval, new.due_date);
      while nxt <= local_today and i < 1000 loop
        nxt := xplan.next_due(new.recurrence, new.recur_interval, nxt);
        i := i + 1;
      end loop;
      insert into xplan.tasks (user_id, title, notes, priority, due_date, due_time, recurrence,
                               recur_interval, project_id, tags, spawned_from)
      values (new.user_id, new.title, new.notes, new.priority, nxt, new.due_time, new.recurrence,
              new.recur_interval, new.project_id, new.tags, new.id);
    end if;
    perform xplan.check_achievements(new.user_id);
  elsif old.status = 'done' and new.status = 'open' then
    if old.xp_awarded <> 0 then
      insert into xplan.xp_events (user_id, task_id, kind, xp) values (new.user_id, new.id, 'undo', -old.xp_awarded);
    end if;
    -- Undoing a repeating quest takes back the next occurrence it spawned (if untouched).
    delete from xplan.tasks where spawned_from = new.id and status = 'open' and user_id = new.user_id;
  end if;
  return null;
end $$;
create trigger tasks_after_update after update of status on xplan.tasks
  for each row execute function xplan.after_task_change();

-- ---------------------------------------------------------------- RLS
alter table xplan.profiles enable row level security;
alter table xplan.projects enable row level security;
alter table xplan.tasks enable row level security;
alter table xplan.xp_events enable row level security;
alter table xplan.achievements enable row level security;

-- Signed-in users, including anonymous guests from /demo, only ever see their own rows.
create policy "Players read own profile" on xplan.profiles for select to authenticated using ((select auth.uid()) = user_id);
create policy "Players add own profile" on xplan.profiles for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Players update own profile" on xplan.profiles for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Players delete own profile" on xplan.profiles for delete to authenticated using ((select auth.uid()) = user_id);

create policy "Players read own projects" on xplan.projects for select to authenticated using ((select auth.uid()) = user_id);
create policy "Players add own projects" on xplan.projects for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Players update own projects" on xplan.projects for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Players delete own projects" on xplan.projects for delete to authenticated using ((select auth.uid()) = user_id);

create policy "Players read own quests" on xplan.tasks for select to authenticated using ((select auth.uid()) = user_id);
create policy "Players add own quests" on xplan.tasks for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Players update own quests" on xplan.tasks for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Players delete own quests" on xplan.tasks for delete to authenticated using ((select auth.uid()) = user_id);

create policy "Players read own XP" on xplan.xp_events for select to authenticated using ((select auth.uid()) = user_id);
create policy "Players read own achievements" on xplan.achievements for select to authenticated using ((select auth.uid()) = user_id);

revoke all on all tables in schema xplan from public, anon;
grant select, insert, update, delete on xplan.profiles, xplan.projects, xplan.tasks to authenticated;
grant select on xplan.xp_events, xplan.achievements to authenticated;
grant all on all tables in schema xplan to service_role;
revoke all on all functions in schema xplan from public, anon;
grant execute on function xplan.level_threshold(integer), xplan.level_for(integer), xplan.xp_for(smallint, boolean),
  xplan.next_due(text, integer, date), xplan.guard_task(), xplan.guard_project(), xplan.touch_profile()
  to authenticated;
-- user_tz runs as the caller (RLS applies). streaks/check_achievements stay definer-only,
-- reachable through the triggers and the public.xplan_* functions that pin uid to auth.uid().
grant execute on function xplan.user_tz(uuid) to authenticated;

-- Realtime: quests, achievements and profile sync across tabs/devices (RLS still applies).
alter table xplan.tasks replica identity full;
alter publication supabase_realtime add table xplan.tasks, xplan.achievements, xplan.profiles;
