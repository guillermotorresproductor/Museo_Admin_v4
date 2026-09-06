-- Only the two PR31 compatibility adjustments; no account or RLS changes.
begin;
do $$
begin
 if exists(select 1 from pg_trigger where tgrelid='public.profiles'::regclass and tgname='profiles_protect_security') then
  if not exists(select 1 from pg_trigger where tgrelid='public.profiles'::regclass and tgname='profiles_protect_security'
    and tgfoid='public.protect_profile_security_fields()'::regprocedure and tgtype=19 and tgenabled in ('O','A')
    and tgqual is null and tgattr::text='') then raise exception 'INCOMPATIBLE_PROFILES_SECURITY_TRIGGER'; end if;
 else
  create trigger profiles_protect_security before update on public.profiles
   for each row execute function public.protect_profile_security_fields();
 end if;
 if num_nonnulls(to_regclass('public.roles'),to_regclass('public.role_permissions'),to_regclass('public.user_roles')) not in (0,3)
 then raise exception 'PARTIAL_RBAC_SCHEMA'; end if;
end $$;
insert into public.permissions(code,description,sensitivity) values
 ('schedules.read.self','Leer horario propio','sensitive'),
 ('time.clock','Registrar ponche propio','sensitive'),
 ('time.read.self','Leer asistencia propia','sensitive')
on conflict(code) do nothing;
do $$ begin
 if to_regclass('public.roles') is not null then
  insert into public.role_permissions(role_id,permission_id)
   select r.id,p.id from public.roles r cross join public.permissions p
   where r.code in ('empleado','ejecutivo','administrador')
    and p.code in ('schedules.read.self','time.clock','time.read.self')
   on conflict do nothing;
 end if;
end $$;
-- Preserve each deployed resolver. Only legacy Production needs a new fallback;
-- normalized Staging continues using its existing role_permissions and deny logic.
do $patch$
declare existing text;
begin
 if to_regclass('public.roles') is null then
  existing := pg_get_functiondef('public.has_permission(text)'::regprocedure);
  if position('v_role_allowed' in existing)=0 then raise exception 'UNSUPPORTED_LEGACY_PERMISSION_RESOLVER'; end if;
  execute $definition$
create or replace function public.has_permission(requested_permission text)
returns boolean language plpgsql stable security definer set search_path='' as $$
declare v_role text; v_role_allowed boolean:=false;
begin
 if auth.uid() is null or not exists(select 1 from public.profiles pr where pr.id=auth.uid()
   and pr.museum_id=public.current_user_museum_id() and pr.status in ('active','activo')) then return false; end if;
 if exists(select 1 from public.user_permissions up join public.permissions p on p.id=up.permission_id
   where up.user_id=auth.uid() and up.museum_id=public.current_user_museum_id() and p.code=requested_permission
   and up.effect='deny' and (up.valid_until is null or up.valid_until>now())) then return false; end if;
 if exists(select 1 from public.user_permissions up join public.permissions p on p.id=up.permission_id
   where up.user_id=auth.uid() and up.museum_id=public.current_user_museum_id() and p.code=requested_permission
   and up.effect='allow' and (up.valid_until is null or up.valid_until>now())) then return true; end if;
 if to_regclass('public.roles') is not null and to_regclass('public.role_permissions') is not null
    and to_regclass('public.user_roles') is not null then
  execute 'select exists(select 1 from public.user_roles ur join public.role_permissions rp on rp.role_id=ur.role_id join public.permissions p on p.id=rp.permission_id where ur.user_id=auth.uid() and ur.museum_id=public.current_user_museum_id() and p.code=$1 and (ur.valid_until is null or ur.valid_until>now()))'
    into v_role_allowed using requested_permission;
  if v_role_allowed then return true; end if;
 end if;
 select lower(pr.role) into v_role from public.profiles pr where pr.id=auth.uid();
 if to_regclass('public.roles') is null and to_regclass('public.role_permissions') is null
    and to_regclass('public.user_roles') is null and v_role in ('empleado','ejecutivo','administrador')
    and requested_permission in ('schedules.read.self','time.clock','time.read.self') then return true; end if;
 return case
  when v_role='administrador' then requested_permission in
   ('profile.read.self','profile.update.self','employees.read.self','employees.read.all','employees.create',
    'employees.update.basic','employees.update.employment','employees.deactivate','notifications.read.self',
    'notifications.manage','finance.read','finance.write','finance.export','users.invite','users.deactivate',
    'roles.assign','audit.read','system.configure','calendar.manage','rentals.manage','memberships.manage',
    'inventory.manage','reports.read','executive.case.read','usher.schedule.read.own','usher.schedule.read.all',
    'usher.schedule.manage','announcements.read','announcements.publish')
  when v_role='ejecutivo' then requested_permission in
   ('profile.read.self','profile.update.self','employees.read.self','employees.read.all','notifications.read.self',
    'notifications.manage','audit.read','calendar.manage','rentals.manage','memberships.manage','inventory.manage',
    'usher.schedule.read.own','usher.schedule.read.all','usher.schedule.manage','announcements.read','announcements.publish')
  when v_role='finanzas' then requested_permission in
   ('profile.read.self','profile.update.self','employees.read.self','notifications.read.self','finance.read',
    'finance.write','finance.export','announcements.read')
  when v_role in ('empleado','supervisor','recursos_humanos') then requested_permission in
   ('profile.read.self','profile.update.self','employees.read.self','notifications.read.self','announcements.read')
  else false end;
end $$;


$definition$;
 end if;
end $patch$;
commit;
