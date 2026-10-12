-- Staging only. Fixtures roll back. Requires 202610120002 to already be applied.
begin;

select set_config('request.jwt.claim.role', 'service_role', true);

do $$
begin
  if exists (
    select 1 from auth.users
    where id in ('a5120000-0000-4000-8000-000000000001', 'a5120000-0000-4000-8000-000000000002')
  ) then
    raise exception 'NAME_FIXTURES_EXIST';
  end if;
  if to_regprocedure('public.inventory_active_employee_names()') is null then
    raise exception 'NAME_FUNCTION_MISSING';
  end if;
end $$;

insert into public.museums (id, name, slug)
values
  ('a5120000-0000-4000-8000-000000000010', 'TEST NAMES ROLLBACK', 'test-inventory-names-rollback'),
  ('a5120000-0000-4000-8000-000000000011', 'TEST NAMES OTHER ROLLBACK', 'test-inventory-names-other-rollback');

insert into auth.users (id, email, raw_user_meta_data)
values
  ('a5120000-0000-4000-8000-000000000001', 'inventory-names-marketing@example.invalid', '{}'),
  ('a5120000-0000-4000-8000-000000000002', 'inventory-names-none@example.invalid', '{}');

update public.profiles
set museum_id = 'a5120000-0000-4000-8000-000000000010',
    status = 'active'
where id in ('a5120000-0000-4000-8000-000000000001', 'a5120000-0000-4000-8000-000000000002');

insert into public.employees (museum_id, profile_id, email, first_name, last_name, access_profile, status)
values
  ('a5120000-0000-4000-8000-000000000010', 'a5120000-0000-4000-8000-000000000001', 'inventory-names-marketing@example.invalid', 'Activo', 'Visible', 'contenido_marketing', 'activo'),
  ('a5120000-0000-4000-8000-000000000010', 'a5120000-0000-4000-8000-000000000002', 'inventory-names-none@example.invalid', 'Sin', 'Inventario', null, 'activo'),
  ('a5120000-0000-4000-8000-000000000010', null, 'inventory-names-second@example.invalid', 'Activo', 'Segundo', null, 'activo'),
  ('a5120000-0000-4000-8000-000000000010', null, 'inventory-names-inactive@example.invalid', 'Inactivo', 'Oculto', null, 'inactivo'),
  ('a5120000-0000-4000-8000-000000000010', null, 'inventory-names-ended@example.invalid', 'Terminado', 'Oculto', null, 'terminado'),
  ('a5120000-0000-4000-8000-000000000011', null, 'inventory-names-foreign@example.invalid', 'Museo', 'Ajeno', null, 'activo');

select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'a5120000-0000-4000-8000-000000000001', true);

do $$
declare
  names text[];
begin
  if pg_get_function_identity_arguments('public.inventory_active_employee_names()'::regprocedure) <> '' then
    raise exception 'NAME_FUNCTION_ACCEPTS_PARAMETERS';
  end if;
  if has_function_privilege('anon', 'public.inventory_active_employee_names()', 'execute') then
    raise exception 'ANON_CAN_EXECUTE';
  end if;
  if not has_function_privilege('authenticated', 'public.inventory_active_employee_names()', 'execute') then
    raise exception 'AUTHENTICATED_CANNOT_EXECUTE';
  end if;
  if position('email' in pg_get_functiondef('public.inventory_active_employee_names()'::regprocedure)) > 0
     or position('phone' in pg_get_functiondef('public.inventory_active_employee_names()'::regprocedure)) > 0
     or position('salary' in pg_get_functiondef('public.inventory_active_employee_names()'::regprocedure)) > 0 then
    raise exception 'NAME_FUNCTION_EXPOSES_PRIVATE_FIELDS';
  end if;
  if public.has_permission('inventory.manage') then
    raise exception 'MARKETING_GAINED_MANAGE';
  end if;
  if not public.has_permission('inventory.create') then
    raise exception 'MARKETING_CREATE_MISSING';
  end if;

  select coalesce(array_agg(full_name), '{}') into names from public.inventory_active_employee_names();
  if not ('Activo Visible' = any(names) and 'Activo Segundo' = any(names) and 'Sin Inventario' = any(names)) then
    raise exception 'ACTIVE_NAMES_MISSING';
  end if;
  if 'Inactivo Oculto' = any(names) or 'Terminado Oculto' = any(names) or 'Museo Ajeno' = any(names) then
    raise exception 'FORBIDDEN_NAME_RETURNED';
  end if;
  if exists (select 1 from unnest(names) as returned_name where returned_name like '%@%') then
    raise exception 'EMAIL_RETURNED';
  end if;

  insert into public.user_permissions (museum_id, user_id, permission_id, effect)
  select 'a5120000-0000-4000-8000-000000000010', 'a5120000-0000-4000-8000-000000000001', p.id, 'deny'
  from public.permissions p
  where p.code = 'inventory.create';
  begin
    perform public.inventory_active_employee_names();
    raise exception 'DENY_IGNORED';
  exception when insufficient_privilege or sqlstate '42501' then null;
  end;
  delete from public.user_permissions
  where user_id = 'a5120000-0000-4000-8000-000000000001'
    and museum_id = 'a5120000-0000-4000-8000-000000000010';

  perform set_config('request.jwt.claim.sub', 'a5120000-0000-4000-8000-000000000002', true);
  begin
    perform public.inventory_active_employee_names();
    raise exception 'UNAUTHORIZED_ALLOWED';
  exception when insufficient_privilege or sqlstate '42501' then null;
  end;

  perform set_config('request.jwt.claim.sub', 'a5120000-0000-4000-8000-000000000001', true);
  perform set_config('request.jwt.claim.role', 'service_role', true);
  update public.profiles set status = 'inactive' where id = 'a5120000-0000-4000-8000-000000000001';
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  begin
    perform public.inventory_active_employee_names();
    raise exception 'INACTIVE_ACCOUNT_ALLOWED';
  exception when insufficient_privilege or sqlstate '42501' then null;
  end;
end $$;

create temporary table inventory_active_names_result (passed boolean);
insert into inventory_active_names_result values (true);
select passed from inventory_active_names_result;

rollback;
