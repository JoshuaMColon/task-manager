-- Alloy is Forge in daylight, so it has to be in the same allow-list.
-- The check constraint is what rejects a skin name the client invented.
-- Drop and re-add because Postgres won't widen a CHECK in place.
alter table xplan.profiles drop constraint if exists profiles_skin_check;
alter table xplan.profiles
  add constraint profiles_skin_check check (skin in ('forge', 'alloy', 'bloom', 'slate'));
