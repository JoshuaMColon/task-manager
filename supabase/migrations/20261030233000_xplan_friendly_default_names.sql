-- Friendlier default player names: the email local part without any +tag, split on . _ - and
-- capitalized ("jane.doe+xplan@x.com" -> "Jane Doe"). Mirrors nameFromEmail in src/lib/names.ts.
-- Only affects newly created profiles; existing display names are never overwritten.

create or replace function xplan.name_from_email(email text)
returns text
language sql immutable set search_path = '' as $$
  select coalesce(nullif(btrim(left(array_to_string(array(
    select upper(left(w, 1)) || substr(w, 2)
    from unnest(regexp_split_to_array(split_part(split_part(coalesce(email, ''), '@', 1), '+', 1), '[._-]+')) with ordinality as t(w, i)
    where w <> ''
    order by i
  ), ' '), 32)), ''), 'Player')
$$;

create or replace function public.xplan_bootstrap(tz text, name text default 'Player')
returns setof public.xplan_profiles
language plpgsql security invoker set search_path = '' as $$
declare
  email text := nullif(auth.jwt() ->> 'email', '');
begin
  if auth.uid() is null then raise exception 'Not signed in' using errcode = '42501'; end if;
  insert into xplan.profiles (user_id, display_name, time_zone)
  values (
    auth.uid(),
    case when email is not null then xplan.name_from_email(email) else left(coalesce(nullif(btrim(name), ''), 'Player'), 32) end,
    coalesce(nullif(tz, ''), 'UTC')
  )
  on conflict (user_id) do update set time_zone = excluded.time_zone; -- never touches display_name
  return query select * from public.xplan_profiles where user_id = auth.uid();
end $$;
