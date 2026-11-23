-- External accountant identities are NOT museum employees.
-- No financial records, employee records, or permissions of existing users are updated.
create table if not exists public.external_accountant_access (
  id uuid primary key default gen_random_uuid(),
  museum_id uuid not null references public.museums(id),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null,
  status text not null default 'active' check (status in ('active','revoked')),
  invited_by uuid not null references auth.users(id),
  invited_at timestamptz not null default now(),
  revoked_by uuid references auth.users(id),
  revoked_at timestamptz,
  constraint external_accountant_email_valid check (length(trim(email)) between 5 and 254),
  constraint external_accountant_museum_user unique (museum_id,user_id)
);
create unique index if not exists external_accountant_museum_email_unique
  on public.external_accountant_access(museum_id,lower(email));
create index if not exists external_accountant_user_status_idx
  on public.external_accountant_access(user_id,status);
alter table public.external_accountant_access enable row level security;
revoke all on table public.external_accountant_access from anon,authenticated;
-- No policies: only server-side service-role can manage invitations, revocations and lists.

-- Existing profile-less module fallback must never give an external
-- accountant implicit administration-module access (some legacy RLS has OR policies).
create or replace function public.module_profile_allows(module_code text)
returns boolean language sql stable security definer set search_path to ''
as $function$
 select not exists(
   select 1 from public.external_accountant_access ea
   where ea.user_id = auth.uid()
 ) and (
   public.current_employee_module_profile() is null
   or public.has_permission('modules.'||module_code||'.read')
 )
$function$;

-- Keep original permission engine intact for employees and other users.
-- A narrow early guard hard-denies ALL permissions except read/export
-- for identities explicitly listed as external accountants. Revoked users
-- also fail, including if a future administrator grants additional permissions.
do $guard$
declare original_definition text; amended_definition text;
begin
 select pg_get_functiondef('public.has_permission(text)'::regprocedure)
 into original_definition;
 if position('external_accountant_access ea' in original_definition) > 0 then
   raise exception 'External accountant guard already installed: abort duplicate migration';
 end if;
 if position(E'\\nbegin' in original_definition) = 0 then
   raise exception 'Unexpected has_permission structure: abort';
 end if;
 amended_definition := replace(
   original_definition,
   E'\\nbegin',
   E'\\nbegin\\n'
   || E' if exists (select 1 from public.external_accountant_access ea where ea.user_id = auth.uid()) then\\n'
   || E'   return requested_permission in (''finance.read'',''finance.export'',''profile.read.self'')\\n'
   || E'     and exists (select 1 from public.external_accountant_access ea\\n'
   || E'       join public.profiles pr on pr.id = ea.user_id and pr.museum_id = ea.museum_id\\n'
   || E'       where ea.user_id = auth.uid() and ea.status = ''active''\\n'
   || E'         and pr.status = ''activo'' and pr.role = ''empleado''\\n'
   || E'         and ea.museum_id = public.current_user_museum_id());\\n'
   || E' end if;\\n'
 );
 if amended_definition = original_definition then
   raise exception 'Could not insert external accountant authorization guard';
 end if;
 execute amended_definition;
end $guard$;
