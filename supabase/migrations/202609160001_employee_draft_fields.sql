-- An HR record can precede its institutional identity. Production already
-- permits these NULLs. No profile, Auth, permission or RLS changes.
begin;
alter table public.employees alter column email drop not null;
alter table public.employees alter column access_level drop not null;
commit;
