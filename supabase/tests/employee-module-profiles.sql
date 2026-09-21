-- Run only against staging with Supabase db query. All fixtures roll back.
begin;
select set_config('request.jwt.claim.role','service_role',true);
create temporary table module_profile_test_results(profile text,base_role text,check_name text,passed boolean);
grant all on module_profile_test_results to authenticated;
do $$ begin
 if exists(select 1 from auth.users where id in ('a5180000-0000-4000-8000-000000000001','a5180000-0000-4000-8000-000000000002','a5180000-0000-4000-8000-000000000003')) then raise exception 'Test IDs already exist'; end if;
end $$;
insert into auth.users(id,email,raw_user_meta_data) values
 ('a5180000-0000-4000-8000-000000000001','module-actor@example.invalid','{}'),
 ('a5180000-0000-4000-8000-000000000002','module-employee@example.invalid','{}'),
 ('a5180000-0000-4000-8000-000000000003','module-admin@example.invalid','{}');
update public.profiles set role='administrador' where id in ('a5180000-0000-4000-8000-000000000001','a5180000-0000-4000-8000-000000000003');
insert into public.user_roles(museum_id,user_id,role_id)
 select p.museum_id,p.id,r.id from public.profiles p cross join public.roles r
 where p.id in ('a5180000-0000-4000-8000-000000000001','a5180000-0000-4000-8000-000000000003') and r.code='administrador';
insert into public.employees(id,museum_id,profile_id,email,first_name,last_name,access_level,status)
 select id,museum_id,id,email,'TEST MODULE','ROLLBACK',role,'activo' from public.profiles
 where id in ('a5180000-0000-4000-8000-000000000001','a5180000-0000-4000-8000-000000000002','a5180000-0000-4000-8000-000000000003');
select set_config('request.jwt.claim.sub','a5180000-0000-4000-8000-000000000001',true);
insert into public.calendar_events(museum_id,calendar_type,title,event_date,created_by,updated_by)
 select museum_id,t,'TEST MODULE ROLLBACK',current_date,id,id from public.profiles,
 unnest(array['general','ujieres','mantenimiento']) t where id='a5180000-0000-4000-8000-000000000001';
insert into public.maintenance_tasks(museum_id,task,created_by,updated_by)
 select museum_id,'TEST MODULE ROLLBACK',id,id from public.profiles where id='a5180000-0000-4000-8000-000000000001';
insert into public.inventory_items(museum_id,asset_tag,name,category,condition,location,created_by,updated_by)
 select museum_id,'TEST-MODULE-ROLLBACK','TEST MODULE ROLLBACK','test','buena','test',id,id
 from public.profiles where id='a5180000-0000-4000-8000-000000000001';
insert into public.app_records(museum_id,module,record_key,payload)
 select museum_id,m,'module-profile-rollback','[]'::jsonb from public.profiles,
 unnest(array['calendario_general','calendario_ujieres','calendario_obras','renta_espacios','recibos_prestamo','notificaciones']) m
 where id='a5180000-0000-4000-8000-000000000001';
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','a5180000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $$ declare chosen record; target uuid; prior text; base text; mod text; actual text[]; expected text[]; forbidden text;
 mutation_denied boolean; visible integer; expected_visible integer; before_role text;
begin
 if not public.has_permission('roles.assign') then raise exception 'Legacy admin access lost'; end if;
 foreach target in array array['a5180000-0000-4000-8000-000000000002'::uuid,'a5180000-0000-4000-8000-000000000003'::uuid] loop
  base:=case when target='a5180000-0000-4000-8000-000000000002'::uuid then 'empleado' else 'administrador' end;
  prior:=base;
  for chosen in select * from public.employee_module_profiles order by code loop
   perform set_config('request.jwt.claim.sub','a5180000-0000-4000-8000-000000000001',true);
   perform public.assign_employee_module_profile(target,chosen.code,prior);
   if (select access_profile from public.employees where id=target)<>chosen.code then raise exception 'Persistence failed'; end if;
   if (select role from public.profiles where id=target)<>base then raise exception 'Technical role changed'; end if;
   prior:=chosen.code;
   perform set_config('request.jwt.claim.sub',target::text,true);
   select array_agg(code order by code) into actual from public.current_user_permissions() code where code like 'modules.%.read';
   select array_agg('modules.'||m||'.read' order by 'modules.'||m||'.read') into expected from unnest(chosen.modules) m;
   if actual is distinct from expected then raise exception 'Module mismatch % %: % versus %',chosen.code,base,actual,expected; end if;
   if public.has_permission('module_profiles.active') is not true then raise exception 'Profile marker missing'; end if;
   if base='empleado' then
    foreach forbidden in array array['roles.assign','users.invite','employees.deactivate','inventory.manage','calendar.manage','usher.schedule.manage','collections.write','memberships.manage','rentals.manage','finance.write','system.configure'] loop
      if chosen.code='gerente_museografica' and forbidden='collections.write' then
       if public.has_permission(forbidden) is not true then raise exception 'Museographic write missing'; end if;
      elsif public.has_permission(forbidden) then raise exception 'Privilege escalated % %',chosen.code,forbidden; end if;
    end loop;
   end if;
   select count(*) into visible from public.app_records where record_key='module-profile-rollback';
   select count(*) into expected_visible from unnest(array['calendar','ushers','maintenance','rentals','collections','administration']) m where m=any(chosen.modules);
   if visible<>expected_visible then raise exception 'RLS read bypass % %: % versus %',chosen.code,base,visible,expected_visible; end if;
   select count(*) into visible from public.calendar_events where title='TEST MODULE ROLLBACK';
   select count(*) into expected_visible from unnest(array['calendar','ushers','maintenance']) m where m=any(chosen.modules);
   if visible<>expected_visible then raise exception 'Calendar type boundary mismatch % %',chosen.code,base; end if;
   if (select count(*) from public.inventory_items where asset_tag='TEST-MODULE-ROLLBACK')<>
      (case when 'inventory'=any(chosen.modules) then 1 else 0 end) then raise exception 'Inventory RLS mismatch'; end if;
   if (select count(*) from public.maintenance_tasks where task='TEST MODULE ROLLBACK')<>
      (case when 'maintenance'=any(chosen.modules) then 1 else 0 end) then raise exception 'Maintenance RLS mismatch'; end if;
   if base='empleado' then
    mutation_denied:=false;
    begin
      insert into public.app_records(museum_id,module,record_key,payload) values(public.current_user_museum_id(),'calendario_ujieres','forbidden-write','[]');
    exception when insufficient_privilege then mutation_denied:=true; end;
    if not mutation_denied then raise exception 'Calendar reader can manage ushers'; end if;
   end if;
   mutation_denied:=false;
   begin
    update public.employees set access_profile='it_programador' where id=target;
    -- RLS may silently filter UPDATE; either way the value must not change.
   exception when insufficient_privilege then mutation_denied:=true; end;
   if (select access_profile from public.employees where id=target)<>chosen.code then raise exception 'Direct PATCH bypass'; end if;
   mutation_denied:=false;
   begin perform public.module_profile_base_permission('roles.assign');
   exception when insufficient_privilege then mutation_denied:=true; end;
   if not mutation_denied then raise exception 'Private base resolver exposed'; end if;
   insert into module_profile_test_results values(chosen.code,base,'exact_modules+RLS+no_escalation+saved',true);
  end loop;
 end loop;
 perform set_config('request.jwt.claim.sub','a5180000-0000-4000-8000-000000000001',true);
 mutation_denied:=false;
 begin perform public.assign_employee_module_profile('a5180000-0000-4000-8000-000000000001','mantenimiento','administrador');
 exception when insufficient_privilege then mutation_denied:=true; end;
 if not mutation_denied then raise exception 'Self admin reassignment accepted'; end if;
 mutation_denied:=false;
 begin perform public.assign_employee_module_profile('a5180000-0000-4000-8000-000000000002','mantenimiento','empleado');
 exception when sqlstate 'PT409' then mutation_denied:=true; end;
 if not mutation_denied then raise exception 'Stale selection accepted'; end if;
 if not public.has_permission('roles.assign') then raise exception 'Legacy administrator changed'; end if;
 insert into module_profile_test_results values('legacy','administrador','preserved+self_change_denied+stale_denied',true);
end $$;
reset role;
-- The new profile capability must still respect an explicit per-user denial.
select set_config('request.jwt.claim.sub','a5180000-0000-4000-8000-000000000001',true);
set local role authenticated;
select public.assign_employee_module_profile(
 'a5180000-0000-4000-8000-000000000002','gerente_museografica',
 (select access_profile from public.employees where id='a5180000-0000-4000-8000-000000000002'));
reset role;
insert into public.user_permissions(museum_id,user_id,permission_id,effect,assigned_by)
 select p.museum_id,p.id,perm.id,'deny','a5180000-0000-4000-8000-000000000001'::uuid
 from public.profiles p cross join public.permissions perm
 where p.id='a5180000-0000-4000-8000-000000000002' and perm.code='collections.write';
select set_config('request.jwt.claim.sub','a5180000-0000-4000-8000-000000000002',true);
set local role authenticated;
do $$ begin
 if public.has_permission('collections.write') then raise exception 'Explicit Collections denial ignored'; end if;
 if public.has_permission('collections.read') is not true then raise exception 'Collections read lost'; end if;
 insert into module_profile_test_results values('gerente_museografica','empleado','explicit_write_denial_preserved',true);
end $$;
reset role;
-- Exact output is safe to save; no identities, credentials or existing data.
select * from module_profile_test_results order by base_role,profile;
rollback;
