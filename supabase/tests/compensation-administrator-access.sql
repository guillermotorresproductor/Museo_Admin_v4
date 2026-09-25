-- Administrator compensation access. The runner wraps this in a transaction and rolls it back.

do $test$
declare
  admin uuid := '25abccb5-3927-4b1d-b928-098fde77f97c';
  other_admin uuid := '6bed20b8-9bea-4dbf-9dab-0998051d2a71';
  employee_user uuid := 'cc2a33ee-6267-4cb0-8b63-1c5ede309d9e';
  profile_user uuid := 'ca3d0682-662b-4fb5-b859-8e150beb07e6';
  museum uuid;
  target uuid := 'a2600000-0000-4000-8000-000000000002';
  self_employee uuid;
  perm uuid;
  fn record;
  profile text;
begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='audit_logs' and column_name='actor_user_id')
     and not exists (select 1 from information_schema.columns where table_schema='public' and table_name='audit_logs' and column_name='user_id') then
    alter table public.audit_logs rename column actor_user_id to user_id;
    for fn in
      select p.oid::regprocedure as sig, pg_get_functiondef(p.oid) as def
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.prokind = 'f' and pg_get_functiondef(p.oid) like '%audit_logs%actor_user_id%'
    loop
      execute replace(replace(fn.def, 'audit_logs(museum_id,actor_user_id', 'audit_logs(museum_id,user_id'), 'audit_logs(museum_id, actor_user_id', 'audit_logs(museum_id, user_id');
    end loop;
  end if;
  alter table public.employees disable trigger protect_employee_module_profile;
  perform set_config('request.jwt.claim.sub', admin::text, true);
  museum := public.current_user_museum_id();
  if not public.has_permission('compensation.read') or not public.has_permission('compensation.manage') then
    raise exception 'LEGACY_ADMIN_DENIED';
  end if;

  update public.profiles set museum_id = museum where id = profile_user;
  update public.employees set museum_id = museum, access_profile = 'administrador_general' where profile_id = profile_user;
  perform set_config('request.jwt.claim.sub', profile_user::text, true);
  if not public.has_permission('compensation.read') or not public.has_permission('compensation.manage') then
    raise exception 'ADMINISTRADOR_GENERAL_DENIED';
  end if;

  foreach profile in array array['gerente_administrativo','director_ejecutivo'] loop
    update public.employees set access_profile = profile where profile_id = profile_user;
    if not public.has_permission('compensation.read') or not public.has_permission('compensation.manage') then
      raise exception 'AUTHORIZED_PROFILE_DENIED: %', profile;
    end if;
  end loop;

  foreach profile in array array['gerente_museografica','coordinadora_experiencia','tecnico_produccion','contenido_marketing','mantenimiento'] loop
    update public.employees set access_profile = profile where profile_id = profile_user;
    if public.has_permission('compensation.read') or public.has_permission('compensation.manage') then
      raise exception 'PROFILE_ALLOWED: %', profile;
    end if;
  end loop;

  perform set_config('request.jwt.claim.sub', employee_user::text, true);
  if public.has_permission('compensation.read') or public.has_permission('compensation.manage') then
    raise exception 'ORDINARY_EMPLOYEE_ALLOWED';
  end if;

  perform set_config('request.jwt.claim.sub', admin::text, true);
  insert into public.employees(id, museum_id, first_name, last_name, email, status, access_level)
  values (target, museum, 'Tarifa', 'Ajena', 'comp-admin-target@example.test', 'activo', 'empleado');
  perform public.save_employee_compensation(target, 'hourly', 18, null, null, null, 40, true, 'none', null, null, null, date '2026-09-15');
  select e.id into self_employee from public.employees e where e.profile_id = admin and e.museum_id = museum limit 1;
  if self_employee is not null then
    begin
      perform public.save_employee_compensation(self_employee, 'hourly', 30, null, null, null, 40, true, 'none', null, null, null, date '2026-09-15');
      raise exception 'SELF_EDIT_ALLOWED';
    exception when sqlstate 'P0001' then
      if sqlerrm not like '%SELF_COMPENSATION_FORBIDDEN%' then raise; end if;
    end;
  end if;

  select p.id into perm from public.permissions p where p.code = 'compensation.manage';
  insert into public.user_permissions(museum_id, user_id, permission_id, effect)
  values (museum, admin, perm, 'deny');
  if public.has_permission('compensation.manage') then raise exception 'DENY_IGNORED'; end if;
  begin
    perform public.save_employee_compensation(target, 'hourly', 19, null, null, null, 40, true, 'none', null, null, null, date '2026-10-01');
    raise exception 'DENY_WRITE_ALLOWED';
  exception when sqlstate '42501' then null;
  end;

  perform set_config('request.jwt.claim.sub', other_admin::text, true);
  begin
    perform public.get_employee_compensation(target, date '2026-09-15');
    raise exception 'OTHER_MUSEUM_READ';
  exception when sqlstate 'P0001' or sqlstate '42501' then null;
  end;

  raise notice 'COMPENSATION_ADMIN_ACCESS_OK';
end
$test$;
