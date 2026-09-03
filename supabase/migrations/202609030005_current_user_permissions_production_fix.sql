-- Align legacy Production with the canonical Staging RBAC catalog.
-- Idempotent; does not modify users, profiles, Auth, inventory data or media.

insert into public.permissions(code,description,sensitivity) values
 ('profile.read.self','Leer perfil propio','normal'),
 ('profile.update.self','Actualizar perfil propio no sensible','normal'),
 ('employees.read.self','Leer expediente propio permitido','sensitive'),
 ('employees.read.all','Leer directorio laboral del museo','sensitive'),
 ('employees.create','Crear expediente laboral','sensitive'),
 ('employees.update.basic','Actualizar datos básicos','sensitive'),
 ('employees.update.employment','Actualizar datos laborales','sensitive'),
 ('employees.deactivate','Desactivar expediente laboral','critical'),
 ('notifications.read.self','Leer notificaciones propias','normal'),
 ('notifications.manage','Administrar notificaciones','sensitive'),
 ('finance.read','Leer Finanzas','critical'),('finance.write','Editar Finanzas','critical'),
 ('finance.export','Exportar Finanzas','critical'),('users.invite','Invitar usuarios','critical'),
 ('users.deactivate','Suspender acceso','critical'),('roles.assign','Asignar roles y permisos','critical'),
 ('audit.read','Leer auditoría','critical'),('system.configure','Configurar el sistema','critical'),
 ('calendar.manage','Administrar calendarios y asignaciones','sensitive'),
 ('rentals.manage','Administrar configuración y solicitudes de renta','sensitive'),
 ('memberships.manage','Administrar membresías y socios','sensitive'),
 ('inventory.manage','Administrar inventario','sensitive'),
 ('reports.read','Leer el módulo de Reportes','critical'),
 ('executive.case.read','Leer y actuar en la bandeja de Dirección Ejecutiva','critical'),
 ('usher.schedule.read.own','Leer turnos propios del calendario de ujieres','sensitive'),
 ('usher.schedule.read.all','Leer todos los turnos del calendario de ujieres','sensitive'),
 ('usher.schedule.manage','Crear, editar y eliminar turnos del calendario de ujieres','sensitive'),
 ('announcements.publish','Publicar y archivar avisos institucionales','sensitive'),
 ('announcements.read','Leer avisos institucionales del museo','normal')
on conflict(code) do update set description=excluded.description,sensitivity=excluded.sensitivity;

do $$ begin
 if to_regclass('public.roles') is not null and to_regclass('public.role_permissions') is not null then
  insert into public.role_permissions(role_id,permission_id)
  select r.id,p.id from public.roles r join public.permissions p on
   (r.code='administrador' and p.code in
    ('profile.read.self','profile.update.self','employees.read.self','employees.read.all','employees.create',
     'employees.update.basic','employees.update.employment','employees.deactivate','notifications.read.self',
     'notifications.manage','finance.read','finance.write','finance.export','users.invite','users.deactivate',
     'roles.assign','audit.read','system.configure','calendar.manage','rentals.manage','memberships.manage',
     'inventory.manage','reports.read','executive.case.read','usher.schedule.read.own','usher.schedule.read.all',
     'usher.schedule.manage','announcements.read','announcements.publish')) or
   (r.code='ejecutivo' and p.code in
    ('profile.read.self','profile.update.self','employees.read.self','employees.read.all','notifications.read.self',
     'notifications.manage','audit.read','calendar.manage','rentals.manage','memberships.manage','inventory.manage',
     'usher.schedule.read.own','usher.schedule.read.all','usher.schedule.manage','announcements.read','announcements.publish')) or
   (r.code='finanzas' and p.code in
    ('profile.read.self','profile.update.self','employees.read.self','notifications.read.self','finance.read',
     'finance.write','finance.export','announcements.read')) or
   (r.code in ('empleado','supervisor','recursos_humanos') and p.code='announcements.read')
  on conflict do nothing;
 end if;
end $$;

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

create or replace function public.current_user_permissions()
returns table(code text) language sql stable security definer set search_path='' as $$
 select distinct p.code from public.permissions p where public.has_permission(p.code) order by p.code
$$;
revoke all on function public.has_permission(text) from public,anon;
revoke all on function public.current_user_permissions() from public,anon;
grant execute on function public.has_permission(text) to authenticated;
grant execute on function public.current_user_permissions() to authenticated;
