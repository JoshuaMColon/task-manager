-- Add the Alloy skin (Forge's light-mode twin) to the allowed profile skins.
alter table xplan.profiles drop constraint if exists profiles_skin_check;
alter table xplan.profiles
  add constraint profiles_skin_check check (skin in ('forge', 'alloy', 'bloom', 'slate'));
