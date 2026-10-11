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
create temporary table inventory_photo_fixture(item_id uuid, museum_id uuid);
insert into inventory_photo_fixture(item_id, museum_id)
 select id, museum_id from public.inventory_items where asset_tag='TEST-MODULE-ROLLBACK';
grant all on inventory_photo_fixture to authenticated;
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
   -- Marketing can read and register equipment. A higher technical role must not
   -- add edit or archive. Other profiles never receive inventory.create.
   if public.has_permission('inventory.create') is distinct from (chosen.code='contenido_marketing') then
     raise exception 'Equipment create grant mismatch for % / %', chosen.code, base;
   end if;
   if chosen.code='contenido_marketing' then
     if public.has_permission('collections.read') or public.has_permission('collections.write') then
       raise exception 'Marketing gained museographic collections access';
     end if;
     if public.has_permission('modules.inventory.read') is not true then
       raise exception 'Marketing equipment read missing for technical role %', base;
     end if;
     if public.has_permission('inventory.manage') then
       raise exception 'Marketing inherited equipment management from technical role %', base;
     end if;
     -- The real security-definer RPCs must accept create and reject edit/archive.
     -- This fixture and all its audit events are rolled back.
     declare
       new_item public.inventory_items;
       update_denied boolean := false;
       archive_denied boolean := false;
     begin
       new_item := public.inventory_create(jsonb_build_object(
         'asset_tag','TEST-MARKETING-ROLLBACK-' || base || '-' || substring(target::text,1,8),
         'name','Marketing test equipment',
         'category','Equipo',
         'condition','buena',
         'location','Prueba',
         'status','activo',
         'record_type','individual',
         'quantity',1
       ));
       if new_item.created_by <> target or new_item.museum_id <> public.current_user_museum_id() then
         raise exception 'Marketing inventory create wrong owner/museum';
       end if;
       begin
         perform public.inventory_update(new_item.id,new_item.version,
           jsonb_build_object('asset_tag',new_item.asset_tag,
                              'name','INVALID UPDATE','category','Equipo',
                              'condition','buena','location','Prueba',
                              'status','activo'));
       exception when insufficient_privilege then
         update_denied := true;
       end;
       if not update_denied then raise exception 'Marketing could edit equipment'; end if;
       begin
         perform public.inventory_archive(new_item.id,new_item.version);
       exception when insufficient_privilege then
         archive_denied := true;
       end;
       if not archive_denied then raise exception 'Marketing could archive equipment'; end if;
     end;
   end if;
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
   -- A user who may view Inventario can add its first photograph, including
   -- users whose profile is read-only. This does not confer editing privileges.
   if 'inventory'=any(chosen.modules) then
     declare photo_item uuid; museum_photo uuid; valid_path text;
     begin
       select id, museum_id into photo_item, museum_photo
       from public.inventory_items where asset_tag='TEST-MODULE-ROLLBACK';
       valid_path := museum_photo::text || '/' || photo_item::text || '/main.webp';
       if not public.can_create_inventory_photo(valid_path) then
         raise exception 'Inventory viewer cannot attach missing photo for %',chosen.code;
       end if;
       if public.can_create_inventory_photo('00000000-0000-4000-8000-000000000000/' || photo_item::text || '/main.webp') then
         raise exception 'Inventory photo cross-museum path accepted';
       end if;
       if public.can_create_inventory_photo(museum_photo::text || '/' || photo_item::text || '/other.webp') then
         raise exception 'Inventory photo invalid filename accepted';
       end if;
       if public.can_create_inventory_photo(museum_photo::text || '/' || photo_item::text || '/extra/main.webp') then
         raise exception 'Inventory photo nested path accepted';
       end if;
     end;
   elsif public.can_create_inventory_photo((select museum_id::text || '/' || item_id::text || '/main.webp' from inventory_photo_fixture)) then
     raise exception 'Profile without inventory read can attach photos: %', chosen.code;
   end if;
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

-- Marketing photo rights: explicit deny, file ownership, and no silent replacement.
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','a5180000-0000-4000-8000-000000000001',true);
set local role authenticated;
select public.assign_employee_module_profile(
 'a5180000-0000-4000-8000-000000000002','contenido_marketing',
 (select access_profile from public.employees where id='a5180000-0000-4000-8000-000000000002'));
reset role;
insert into public.user_permissions(museum_id,user_id,permission_id,effect,assigned_by)
 select p.museum_id,p.id,perm.id,'deny','a5180000-0000-4000-8000-000000000001'::uuid
 from public.profiles p cross join public.permissions perm
 where p.id='a5180000-0000-4000-8000-000000000002' and perm.code='inventory.photo.attach';
select set_config('request.jwt.claim.sub','a5180000-0000-4000-8000-000000000002',true);
set local role authenticated;
do $$ declare valid_path text;
begin
 select museum_id::text || '/' || item_id::text || '/main.webp' into valid_path from inventory_photo_fixture;
 if public.has_permission('inventory.photo.attach') then raise exception 'Explicit inventory photo denial ignored'; end if;
 if public.has_permission('modules.inventory.read') is not true then raise exception 'Inventory read lost after photo denial'; end if;
 if public.has_permission('inventory.create') is not true then raise exception 'Inventory create lost after photo denial'; end if;
 if public.can_create_inventory_photo(valid_path) then raise exception 'Denied user can still attach an equipment photo'; end if;
 insert into module_profile_test_results values('contenido_marketing','empleado','explicit_photo_denial_preserved',true);
end $$;
reset role;
delete from public.user_permissions
 where user_id='a5180000-0000-4000-8000-000000000002'
   and permission_id=(select id from public.permissions where code='inventory.photo.attach');
insert into public.user_permissions(museum_id,user_id,permission_id,effect,assigned_by)
 select p.museum_id,p.id,perm.id,'deny','a5180000-0000-4000-8000-000000000001'::uuid
 from public.profiles p cross join public.permissions perm
 where p.id='a5180000-0000-4000-8000-000000000002' and perm.code='inventory.create';
select set_config('request.jwt.claim.sub','a5180000-0000-4000-8000-000000000002',true);
set local role authenticated;
do $$ begin
 if public.has_permission('inventory.create') then raise exception 'Explicit inventory create denial ignored'; end if;
 if public.has_permission('modules.inventory.read') is not true then raise exception 'Inventory read lost after create denial'; end if;
 if public.has_permission('inventory.manage') then raise exception 'Marketing gained manage during create denial'; end if;
 insert into module_profile_test_results values('contenido_marketing','empleado','explicit_create_denial_preserved',true);
end $$;
reset role;
delete from public.user_permissions
 where user_id='a5180000-0000-4000-8000-000000000002'
   and permission_id=(select id from public.permissions where code='inventory.create');
insert into storage.objects(bucket_id, name, owner_id, metadata)
 select 'inventory-photos', museum_id::text || '/' || item_id::text || '/main.webp',
        'a5180000-0000-4000-8000-000000000001',
        jsonb_build_object('mimetype','image/webp','size',1024)
 from inventory_photo_fixture;
select set_config('request.jwt.claim.sub','a5180000-0000-4000-8000-000000000002',true);
set local role authenticated;
do $$ declare photo_item uuid; photo_version bigint; denied boolean := false; attached public.inventory_items;
begin
 select item_id into photo_item from inventory_photo_fixture;
 select version into photo_version from public.inventory_items where id=photo_item;
 begin
   perform public.inventory_set_photo(photo_item, photo_version);
 exception when insufficient_privilege then
   denied := true;
 end;
 if not denied then raise exception 'Foreign equipment photo owner accepted'; end if;
 denied := false;
 begin
   perform public.inventory_set_photo('00000000-0000-4000-8000-000000000099', photo_version);
 exception when insufficient_privilege then
   denied := true;
 end;
 if not denied then raise exception 'Cross-museum equipment photo association accepted'; end if;
end $$;
reset role;
update storage.objects set owner_id='a5180000-0000-4000-8000-000000000002'
 where bucket_id='inventory-photos'
   and name=(select museum_id::text || '/' || item_id::text || '/main.webp' from inventory_photo_fixture);
select set_config('request.jwt.claim.sub','a5180000-0000-4000-8000-000000000002',true);
set local role authenticated;
do $$ declare photo_item uuid; photo_version bigint; denied boolean := false; attached public.inventory_items;
begin
 select item_id into photo_item from inventory_photo_fixture;
 select version into photo_version from public.inventory_items where id=photo_item;
 attached := public.inventory_set_photo(photo_item, photo_version);
 if attached.photo_path is distinct from (select museum_id::text || '/' || item_id::text || '/main.webp' from inventory_photo_fixture)
    or attached.updated_by <> 'a5180000-0000-4000-8000-000000000002'::uuid then
   raise exception 'Owned equipment photo was not attached';
 end if;
 begin
   perform public.inventory_set_photo(attached.id, attached.version);
 exception when insufficient_privilege then
   denied := true;
 end;
 if not denied then raise exception 'Replacement without manage accepted'; end if;
 if public.can_create_inventory_photo(attached.photo_path) then
   raise exception 'Attached photo can be created again without manage';
 end if;
 insert into module_profile_test_results values('contenido_marketing','empleado','photo_owner_and_replacement_enforced',true);
end $$;
reset role;
insert into public.user_permissions(museum_id,user_id,permission_id,effect,assigned_by)
 select p.museum_id,p.id,perm.id,'allow','a5180000-0000-4000-8000-000000000001'::uuid
 from public.profiles p cross join public.permissions perm
 where p.id='a5180000-0000-4000-8000-000000000002' and perm.code='inventory.manage';
select set_config('request.jwt.claim.sub','a5180000-0000-4000-8000-000000000002',true);
set local role authenticated;
do $$ begin
 if public.has_permission('inventory.manage') is not true then raise exception 'Explicit inventory manage allow ignored'; end if;
 insert into module_profile_test_results values('contenido_marketing','empleado','explicit_manage_allow_preserved',true);
end $$;
reset role;
delete from public.user_permissions
 where user_id='a5180000-0000-4000-8000-000000000002'
   and permission_id=(select id from public.permissions where code='inventory.manage')
   and effect='allow';
select set_config('request.jwt.claim.sub','a5180000-0000-4000-8000-000000000002',true);
set local role authenticated;
do $$ begin
 if public.has_permission('inventory.manage') then raise exception 'Marketing kept manage after explicit allow was removed'; end if;
 insert into module_profile_test_results values('contenido_marketing','empleado','manage_removed_with_explicit_allow',true);
end $$;
reset role;
-- Exact output is safe to save; no identities, credentials or existing data.
select * from module_profile_test_results order by base_role,profile;
rollback;
