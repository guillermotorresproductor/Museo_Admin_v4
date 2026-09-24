-- Staging exercise. The runner wraps this in a transaction and rolls it back.

do $test$
declare
  profile_user uuid := 'ca3d0682-662b-4fb5-b859-8e150beb07e6';
  employee_user uuid := 'cc2a33ee-6267-4cb0-8b63-1c5ede309d9e';
  museum uuid;
  other_user uuid;
  item public.inventory_items;
  updated public.inventory_items;
  archived public.inventory_items;
  profile_modules text[];
begin
  alter table public.employees disable trigger protect_employee_module_profile;
  perform set_config('request.jwt.claim.sub', profile_user::text, true);
  museum := public.current_user_museum_id();
  update public.employees set access_profile = 'gerente_museografica' where profile_id = profile_user and museum_id = museum;
  if public.current_employee_module_profile() <> 'gerente_museografica' then raise exception 'PROFILE_CHANGED'; end if;
  if public.has_permission('modules.inventory.read') or public.has_permission('inventory.manage') then raise exception 'PROFILE_ALREADY_HAS_INVENTORY'; end if;

  insert into public.user_permissions(museum_id, user_id, permission_id, effect)
  select museum, profile_user, p.id, 'allow'
  from public.permissions p
  where p.code in ('modules.inventory.read','inventory.manage')
  on conflict (museum_id, user_id, permission_id) do update set effect = 'allow', valid_until = null;
  if not public.has_permission('modules.inventory.read') then raise exception 'READ_DENIED'; end if;
  if not public.has_permission('inventory.manage') then raise exception 'MANAGE_DENIED'; end if;
  if public.has_permission('finance.read') then raise exception 'FINANCE_GRANTED'; end if;
  if public.has_permission('system.configure') then raise exception 'SYSTEM_GRANTED'; end if;
  if public.has_permission('roles.assign') then raise exception 'ROLES_GRANTED'; end if;

  insert into public.user_permissions(museum_id, user_id, permission_id, effect)
  select museum, profile_user, p.id, 'allow' from public.permissions p where p.code = 'finance.read'
  on conflict (museum_id, user_id, permission_id) do update set effect = 'allow', valid_until = null;
  if public.has_permission('finance.read') then raise exception 'ALLOW_BYPASS'; end if;

  update public.user_permissions u set effect = 'deny'
  from public.permissions p
  where u.permission_id = p.id and u.user_id = profile_user and u.museum_id = museum and p.code = 'inventory.manage';
  if public.has_permission('inventory.manage') then raise exception 'DENY_LOST'; end if;
  if not public.has_permission('modules.inventory.read') then raise exception 'DENY_BLOCKED_READ'; end if;
  update public.user_permissions u set effect = 'allow'
  from public.permissions p
  where u.permission_id = p.id and u.user_id = profile_user and u.museum_id = museum and p.code = 'inventory.manage';
  if not public.has_permission('inventory.manage') then raise exception 'MANAGE_NOT_RESTORED'; end if;

  other_user := employee_user;
  update public.employees set access_profile = 'gerente_museografica' where profile_id = other_user;
  if not found then raise exception 'NO_SECOND_PROFILE'; end if;
  perform set_config('request.jwt.claim.sub', other_user::text, true);
  if public.current_employee_module_profile() <> 'gerente_museografica' then raise exception 'OTHER_PROFILE'; end if;
  if public.has_permission('modules.inventory.read') or public.has_permission('inventory.manage') then raise exception 'OTHER_MANAGER_GOT_INVENTORY'; end if;
  begin
    perform public.inventory_create('{"asset_tag":"OTRO","name":"Otro","category":"Equipo","condition":"buena","location":"Bodega","status":"activo"}'::jsonb);
    raise exception 'OTHER_CREATED';
  exception when insufficient_privilege or sqlstate '42501' then null;
  end;

  perform set_config('request.jwt.claim.sub', profile_user::text, true);
  item := public.inventory_create('{"asset_tag":"ANA-TEST","name":"Equipo de prueba","category":"Equipo","condition":"buena","location":"Bodega","status":"activo"}'::jsonb);
  if item.museum_id <> museum or item.name <> 'Equipo de prueba' then raise exception 'CREATE_FAILED'; end if;
  updated := public.inventory_update(item.id, item.version, '{"asset_tag":"ANA-TEST","name":"Equipo editado","category":"Equipo","condition":"buena","location":"Sala","status":"activo"}'::jsonb);
  if updated.name <> 'Equipo editado' or updated.location <> 'Sala' then raise exception 'UPDATE_FAILED'; end if;
  perform public.inventory_set_photo(updated.id, updated.version);
  archived := public.inventory_archive(updated.id, updated.version + 1);
  if archived.archived_at is null then raise exception 'ARCHIVE_FAILED'; end if;
  begin
    delete from public.inventory_items where id = item.id;
    raise exception 'DELETE_ALLOWED';
  exception when check_violation or sqlstate '23514' then null;
  end;

  select m.modules into profile_modules from public.employee_module_profiles m where m.code = 'gerente_museografica';
  if 'inventory' = any(profile_modules) then raise exception 'GLOBAL_PROFILE_CHANGED'; end if;
  perform set_config('request.jwt.claim.sub', employee_user::text, true);
  if public.current_employee_module_profile() = 'tecnico_produccion' then
    if public.has_permission('inventory.manage') then raise exception 'TECH_MANAGE'; end if;
    if not public.has_permission('modules.inventory.read') then raise exception 'TECH_READ_LOST'; end if;
  else
    update public.employees set access_profile = 'tecnico_produccion' where profile_id = employee_user;
    perform set_config('request.jwt.claim.sub', employee_user::text, true);
    if public.has_permission('inventory.manage') then raise exception 'TECH_MANAGE'; end if;
    if not public.has_permission('modules.inventory.read') then raise exception 'TECH_READ_LOST'; end if;
  end if;
  raise notice 'ANA_INVENTORY_ACCESS_OK';
end
$test$;
