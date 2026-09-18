-- Module profiles are independent of technical roles and privileged actions.
-- NULL preserves legacy access; there is intentionally no employee backfill.
begin;
create table public.employee_module_profiles (
 code text primary key, label text not null unique, modules text[] not null
);
insert into public.employee_module_profiles values
 ('mantenimiento','Mantenimiento',array['personal','calendar','maintenance','announcements']),
 ('gerente_museografica','Gerente Museográfica',array['personal','collections','calendar','ushers','documents','announcements']),
 ('contenido_marketing','Creadora de Contenido y Marketing',array['personal','calendar','ushers','documents','announcements']),
 ('coordinadora_experiencia','Coordinadora de Experiencia Museográfica',array['personal','calendar','ushers','documents','announcements']),
 ('tecnico_produccion','Técnico de Producción',array['personal','calendar','ushers','documents','announcements','inventory']);
insert into public.employee_module_profiles
 select code,label,array['personal','collections','calendar','rentals','memberships','ushers','maintenance','documents','administration','announcements','inventory']
 from (values ('asistente_administrativa','Asistente Administrativa'),('director_ejecutivo','Director Ejecutivo'),
 ('administrador_general','Administrador General'),('gerente_administrativo','Gerente Administrativo'),('it_programador','IT Programador')) v(code,label);
alter table public.employee_module_profiles enable row level security;
revoke all on public.employee_module_profiles from anon,authenticated;
grant select on public.employee_module_profiles to authenticated;
create policy module_profile_catalog_read on public.employee_module_profiles for select to authenticated using (true);
alter table public.employees add column access_profile text references public.employee_module_profiles(code);

create function public.current_employee_module_profile() returns text
language sql stable security definer set search_path='' as $$
 select case when count(*)=1 then max(e.access_profile) when bool_or(e.access_profile is not null) then '__invalid_link__' end
 from public.employees e join public.profiles p on p.id=e.profile_id and p.museum_id=e.museum_id
 where p.id=auth.uid() and p.museum_id=public.current_user_museum_id()
$$;

-- Save the environment's exact previous resolver, retaining the public function OID
-- so every existing policy and RPC continues to call the new boundary.
do $$ begin
 execute replace(pg_get_functiondef('public.has_permission(text)'::regprocedure),
  'FUNCTION public.has_permission(', 'FUNCTION public.module_profile_base_permission(');
end $$;
revoke all on function public.module_profile_base_permission(text) from public,anon,authenticated,service_role;

create function public.permission_module(permission text) returns text
language sql immutable set search_path='' as $$
 select case
 when permission like 'modules.%.read' then split_part(permission,'.',2)
 when permission like 'collections.%' then 'collections'
 when permission like 'calendar.%' then 'calendar'
 when permission like 'usher.%' then 'ushers'
 when permission like 'maintenance.%' then 'maintenance'
 when permission like 'rentals.%' then 'rentals'
 when permission like 'memberships.%' then 'memberships'
 when permission like 'inventory.%' then 'inventory'
 when permission like 'documents.%' then 'documents'
 when permission like 'announcements.%' then 'announcements'
 when permission in ('profile.read.self','profile.update.self','employees.read.self','notifications.read.self',
   'schedules.read.self','time.clock','time.read.self','attendance.corrections.request') then 'personal'
 else 'administration' end
$$;

create or replace function public.has_permission(requested_permission text) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare chosen text:=public.current_employee_module_profile(); target_module text;
begin
 if chosen is null then return public.module_profile_base_permission(requested_permission); end if;
 if not exists(select 1 from public.profiles where id=auth.uid() and status in ('active','activo')
   and museum_id=public.current_user_museum_id()) then return false; end if;
 if requested_permission='module_profiles.active' then return true; end if;
 if exists(select 1 from public.user_permissions u join public.permissions p on p.id=u.permission_id
   where u.user_id=auth.uid() and u.museum_id=public.current_user_museum_id() and p.code=requested_permission
   and u.effect='deny' and (u.valid_until is null or u.valid_until>now())) then return false; end if;
 target_module:=public.permission_module(requested_permission);
 if not exists(select 1 from public.employee_module_profiles where code=chosen and target_module=any(modules)) then return false; end if;
 -- Only entry/read capabilities are added. Existing write/delete/role grants are preserved.
 if requested_permission='modules.'||target_module||'.read'
   or requested_permission in ('collections.read','announcements.read') then return true; end if;
 return public.module_profile_base_permission(requested_permission);
end $$;

insert into public.permissions(code,description,sensitivity)
 select 'modules.'||m||'.read','Consultar módulo: '||m,'normal'
 from unnest(array['personal','collections','calendar','rentals','memberships','ushers','maintenance','documents','administration','announcements','inventory']) m
 on conflict(code) do nothing;
insert into public.permissions(code,description,sensitivity) values
 ('module_profiles.active','Perfil de módulos seleccionado explícitamente','normal') on conflict(code) do nothing;

create function public.protect_employee_module_profile() returns trigger
language plpgsql set search_path='' as $$
begin
 if (tg_op='INSERT' and new.access_profile is not null)
    or (tg_op='UPDATE' and new.access_profile is distinct from old.access_profile) then
   if coalesce(auth.role(),'')<>'service_role' and not
     (current_user='postgres' and auth.uid() is not null and public.has_permission('roles.assign')
      and new.museum_id=public.current_user_museum_id() and new.profile_id is distinct from auth.uid()) then
     raise exception 'MODULE_PROFILE_ASSIGNMENT_REQUIRED' using errcode='42501';
   end if;
 end if;
 return new;
end $$;
create trigger protect_employee_module_profile before insert or update on public.employees
 for each row execute function public.protect_employee_module_profile();

create function public.assign_employee_module_profile(p_employee_id uuid,p_profile_code text,p_expected_role text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare e public.employees; previous text; museum uuid:=public.current_user_museum_id(); actor_column text;
begin
 if auth.uid() is null or not public.has_permission('roles.assign') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if not exists(select 1 from public.employee_module_profiles where code=p_profile_code) then raise exception 'INVALID_MODULE_PROFILE' using errcode='22023'; end if;
 select * into e from public.employees where id=p_employee_id and museum_id=museum for update;
 if not found then raise exception 'EMPLOYEE_NOT_FOUND' using errcode='42501'; end if;
 if e.profile_id=auth.uid() then raise exception 'SELF_LEVEL_CHANGE_FORBIDDEN' using errcode='42501'; end if;
 perform id from public.profiles where id=auth.uid() or id=e.profile_id order by id for update;
 if not public.has_permission('roles.assign') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 previous:=e.access_profile;
 if e.profile_id is not null then
   if (select count(*) from public.employees where profile_id=e.profile_id)<>1
      or not exists(select 1 from public.profiles p where p.id=e.profile_id and p.museum_id=museum
        and lower(trim(p.email))=lower(trim(e.email))) then raise exception 'IDENTITY_LINK_INVALID' using errcode='42501'; end if;
 end if;
 if previous is null then
   if e.profile_id is null then previous:=e.access_level;
   else
     select lower(role) into previous from public.profiles where id=e.profile_id;
     if to_regclass('public.user_roles') is not null then
       execute $q$select code from (select $3::text code union select r.code from public.user_roles u join public.roles r on r.id=u.role_id
        where u.user_id=$1 and u.museum_id=$2 and (u.valid_until is null or u.valid_until>now())
        and r.code in ('empleado','ejecutivo','administrador')) t
        order by case code when 'administrador' then 3 when 'ejecutivo' then 2 else 1 end desc limit 1$q$
       into previous using e.profile_id,museum,previous;
     end if;
   end if;
 end if;
 if previous is distinct from p_expected_role then raise exception 'ACCESS_LEVEL_CHANGED_RELOAD' using errcode='PT409'; end if;
 -- Existing roles and grants never change. An unset unlinked invitation needs a least-privilege base role.
 update public.employees set access_profile=p_profile_code,
   access_level=case when profile_id is null then coalesce(access_level,'empleado') else access_level end
   where id=e.id;
 select attname into actor_column from pg_attribute where attrelid='public.audit_logs'::regclass
   and attname in ('actor_user_id','user_id') and not attisdropped order by case attname when 'actor_user_id' then 0 else 1 end limit 1;
 execute format('insert into public.audit_logs(museum_id,%I,action,table_name,record_id,old_value,new_value) values($1,$2,$3,$4,$5,$6,$7)',actor_column)
 using museum,auth.uid(),'EMPLOYEE_MODULE_PROFILE_CHANGED','employees',e.id,
   jsonb_build_object('access_profile',e.access_profile),jsonb_build_object('access_profile',p_profile_code,'profile_id',e.profile_id);
 return jsonb_build_object('assigned',true,'role',p_profile_code,'access_profile',p_profile_code);
end $$;
revoke all on function public.assign_employee_module_profile(uuid,text,text) from public,anon,service_role;
grant execute on function public.assign_employee_module_profile(uuid,text,text) to authenticated;

-- Layer restrictive policies over legacy permissive policies. No change for NULL profiles.
create function public.module_profile_allows(module_code text) returns boolean
language sql stable security definer set search_path='' as $$
 select public.current_employee_module_profile() is null or public.has_permission('modules.'||module_code||'.read')
$$;
do $$ declare t text; m text; item record; begin
 for item in select * from (values
  ('calendar_events','calendar'),('maintenance_tasks','maintenance'),('inventory_items','inventory'),
  ('documents','documents'),('collection_items','collections'),('collection_photos','collections'),('collection_history','collections'),
  ('museum_members','memberships'),('membership_plans','memberships'),('membership_attendance','memberships'),
  ('membership_communications','memberships'),('membership_renewals','memberships'),('membership_audit_logs','memberships'),
  ('rental_approval_controls','rentals'),('rental_approval_audit_logs','rentals'),('finance_records','administration'),('audit_logs','administration')
 ) v(tab,module) loop
   t:=item.tab; m:=item.module;
   if to_regclass('public.'||t) is not null then
    execute format('create policy module_profile_boundary on public.%I as restrictive for all to authenticated using (public.module_profile_allows(%L)) with check (public.module_profile_allows(%L))',t,m,m);
   end if;
 end loop;
 -- New read-only entry permission; original mutation policies remain in force.
 for item in select * from (values ('calendar_events','calendar'),('maintenance_tasks','maintenance'),('inventory_items','inventory'),
  ('museum_members','memberships'),('membership_plans','memberships'),('membership_attendance','memberships'),
  ('membership_communications','memberships'),('membership_renewals','memberships'),
  ('rental_approval_controls','rentals'),('rental_approval_audit_logs','rentals')) v(tab,module) loop
   if to_regclass('public.'||item.tab) is not null then
    execute format('create policy module_profile_read on public.%I for select to authenticated using (museum_id=public.current_user_museum_id() and public.has_permission(%L))',item.tab,'modules.'||item.module||'.read');
   end if;
 end loop;
end $$;

-- The normalized calendar table can also hold usher/maintenance calendars.
-- Calendar entry alone must not expose those other record types through REST.
alter policy module_profile_boundary on public.calendar_events using (
 public.module_profile_allows(case calendar_type when 'general' then 'calendar' when 'ujieres' then 'ushers' when 'mantenimiento' then 'maintenance' else '__unknown__' end))
 with check (public.module_profile_allows(case calendar_type when 'general' then 'calendar' when 'ujieres' then 'ushers' when 'mantenimiento' then 'maintenance' else '__unknown__' end));
alter policy module_profile_read on public.calendar_events using (museum_id=public.current_user_museum_id()
 and public.has_permission('modules.'||(case calendar_type when 'general' then 'calendar' when 'ujieres' then 'ushers' when 'mantenimiento' then 'maintenance' else '__unknown__' end)||'.read'));

create function public.app_record_module(module_name text) returns text
language sql immutable set search_path='' as $$
 select case module_name when 'calendario_general' then 'calendar' when 'calendario_ujieres' then 'ushers'
 when 'calendario_obras' then 'maintenance' when 'renta_espacios' then 'rentals'
 when 'recibos_prestamo' then 'collections' when 'notificaciones' then 'administration'
 else '__unknown__' end
$$;
create policy module_profile_boundary on public.app_records as restrictive for all to authenticated
 using(public.module_profile_allows(public.app_record_module(module)))
 with check(public.module_profile_allows(public.app_record_module(module)));
create policy module_profile_read on public.app_records for select to authenticated using (
 museum_id=public.current_user_museum_id() and public.has_permission('modules.'||public.app_record_module(module)||'.read'));
create function public.module_profile_record_write(module_name text) returns boolean
language sql stable security definer set search_path='' as $$
 select public.current_employee_module_profile() is null or public.has_permission(case module_name
 when 'calendario_general' then 'calendar.manage' when 'calendario_ujieres' then 'usher.schedule.manage'
 when 'calendario_obras' then 'maintenance.manage' when 'renta_espacios' then 'rentals.manage'
 when 'recibos_prestamo' then 'collections.write' when 'notificaciones' then 'notifications.manage' else '__unknown__' end)
$$;
create policy module_profile_write on public.app_records as restrictive for insert to authenticated with check(public.module_profile_record_write(module));
create policy module_profile_update on public.app_records as restrictive for update to authenticated using(public.module_profile_record_write(module)) with check(public.module_profile_record_write(module));
create policy module_profile_delete on public.app_records as restrictive for delete to authenticated using(public.module_profile_record_write(module));

-- Personal identity stays readable; administrative identity operations keep their original grants.
create policy module_profile_boundary on public.employees as restrictive for select to authenticated
 using(profile_id=auth.uid() or public.module_profile_allows('administration'));
create policy module_profile_boundary on public.profiles as restrictive for select to authenticated
 using(id=auth.uid() or public.module_profile_allows('administration'));
do $$ declare t text; p text; self_access text; begin
 foreach t in array array['employees','profiles','finance_records','documents'] loop
  if to_regclass('public.'||t) is null then continue; end if;
  p:=case t when 'employees' then 'employees.create' when 'profiles' then 'roles.assign' when 'finance_records' then 'finance.write' else 'system.configure' end;
  execute format('create policy module_profile_insert on public.%I as restrictive for insert to authenticated with check (public.current_employee_module_profile() is null or public.has_permission(%L))',t,p);
  p:=case t when 'employees' then 'employees.update.basic' else p end;
  self_access:=case t when 'employees' then ' or profile_id=auth.uid()' when 'profiles' then ' or (id=auth.uid() and public.has_permission(''profile.update.self''))' else '' end;
  execute format('create policy module_profile_update on public.%I as restrictive for update to authenticated using (public.current_employee_module_profile() is null or public.has_permission(%L)%s) with check (public.current_employee_module_profile() is null or public.has_permission(%L)%s)',t,p,self_access,p,self_access);
  p:=case t when 'employees' then 'employees.deactivate' when 'profiles' then 'users.deactivate' else p end;
  execute format('create policy module_profile_delete on public.%I as restrictive for delete to authenticated using (public.current_employee_module_profile() is null or public.has_permission(%L))',t,p);
 end loop;
end $$;

-- RPCs with legacy role checks also need the module boundary; clone each exact base.
do $$ begin
 if to_regprocedure('public.current_rental_admin_museum()') is not null then
  execute replace(pg_get_functiondef('public.current_rental_admin_museum()'::regprocedure),'FUNCTION public.current_rental_admin_museum(', 'FUNCTION public.module_profile_base_rental_museum(');
 else
  execute 'create function public.module_profile_base_rental_museum() returns uuid language sql stable security definer set search_path='''' as ''select public.current_user_museum_id() where public.has_permission(''''rentals.manage'''')''';
 end if;
 if to_regprocedure('public.can_manage_memberships(uuid)') is not null then
  execute replace(pg_get_functiondef('public.can_manage_memberships(uuid)'::regprocedure),'FUNCTION public.can_manage_memberships(', 'FUNCTION public.module_profile_base_memberships(');
 else
  execute 'create function public.module_profile_base_memberships(target_museum_id uuid) returns boolean language sql stable security definer set search_path='''' as ''select target_museum_id=public.current_user_museum_id() and public.has_permission(''''memberships.manage'''')''';
 end if;
end $$;
revoke all on function public.module_profile_base_rental_museum() from public,anon,authenticated,service_role;
revoke all on function public.module_profile_base_memberships(uuid) from public,anon,authenticated,service_role;
create or replace function public.current_rental_admin_museum() returns uuid language sql stable security definer set search_path='' as $$
 select public.module_profile_base_rental_museum() where public.module_profile_allows('rentals')
$$;
create or replace function public.can_manage_memberships(target_museum_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select public.module_profile_base_memberships(target_museum_id) and public.module_profile_allows('memberships')
$$;
create policy module_profile_storage_read on storage.objects as restrictive for select to authenticated using (
 case bucket_id when 'inventory-photos' then public.module_profile_allows('inventory')
 when 'rental-documents' then public.module_profile_allows('rentals') else true end);
create policy module_profile_storage_consult on storage.objects for select to authenticated using (
 (storage.foldername(name))[1]=public.current_user_museum_id()::text and
 ((bucket_id='inventory-photos' and public.has_permission('modules.inventory.read'))
 or (bucket_id='rental-documents' and public.has_permission('modules.rentals.read'))));
do $$ declare action text; expr text; begin
 expr:='bucket_id<>''rental-documents'' or public.current_employee_module_profile() is null or public.has_permission(''rentals.manage'')';
 execute 'create policy module_profile_storage_insert on storage.objects as restrictive for insert to authenticated with check ('||expr||')';
 execute 'create policy module_profile_storage_update on storage.objects as restrictive for update to authenticated using ('||expr||') with check ('||expr||')';
 execute 'create policy module_profile_storage_delete on storage.objects as restrictive for delete to authenticated using ('||expr||')';
end $$;
revoke all on function public.current_employee_module_profile(),public.module_profile_allows(text),public.module_profile_record_write(text) from public,anon;
grant execute on function public.current_employee_module_profile(),public.module_profile_allows(text),public.module_profile_record_write(text) to authenticated;
notify pgrst,'reload schema';
commit;
