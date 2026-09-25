-- Compensation versions. The runner wraps this in a transaction and rolls it back.

do $test$
declare
  admin uuid := '25abccb5-3927-4b1d-b928-098fde77f97c';
  other_admin uuid := '6bed20b8-9bea-4dbf-9dab-0998051d2a71';
  employee_user uuid := 'cc2a33ee-6267-4cb0-8b63-1c5ede309d9e';
  profile_user uuid := 'ca3d0682-662b-4fb5-b859-8e150beb07e6';
  museum uuid;
  target uuid := 'a2600000-0000-4000-8000-000000000001';
  self_employee uuid;
  first_rate numeric;
  row jsonb;
  perm uuid;
  fn record;
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
  if public.has_permission('compensation.read') or public.has_permission('compensation.manage') then raise exception 'ADMIN_HAS_PAY'; end if;

  update public.profiles set museum_id = museum where id = profile_user;
  update public.employees set museum_id = museum, access_profile = 'gerente_administrativo' where profile_id = profile_user;
  perform set_config('request.jwt.claim.sub', profile_user::text, true);
  if not public.has_permission('compensation.read') or not public.has_permission('compensation.manage') then raise exception 'MANAGER_DENIED'; end if;

  insert into public.employees(id, museum_id, first_name, last_name, email, status, access_level)
  values (target, museum, 'Tarifa', 'Ajena', 'comp-target@example.test', 'activo', 'empleado');
  perform public.save_employee_compensation(target, 'hourly', 18, null, null, null, 40, true, 'none', null, null, null, date '2026-09-15');
  perform public.save_employee_compensation(target, 'hourly', 20, null, null, null, 40, true, 'none', null, null, null, date '2027-01-01');
  if (select count(*) from public.employee_compensation where employee_id = target) <> 2 then raise exception 'HISTORY_LOST'; end if;
  select hourly_rate into first_rate from public.employee_compensation where employee_id = target and effective_from = date '2026-09-15';
  if first_rate <> 18 then raise exception 'FIRST_RATE_OVERWRITTEN'; end if;
  row := public.get_employee_compensation(target, date '2026-12-15');
  if (row->>'hourly_rate')::numeric <> 18 then raise exception 'DECEMBER_RATE'; end if;
  row := public.get_employee_compensation(target, date '2027-01-01');
  if (row->>'hourly_rate')::numeric <> 20 then raise exception 'JANUARY_RATE'; end if;
  row := public.get_employee_compensation(target, date '2027-02-01');
  if (row->>'hourly_rate')::numeric <> 20 then raise exception 'FEBRUARY_RATE'; end if;
  begin
    perform public.save_employee_compensation(target, 'hourly', 19, null, null, null, 40, true, 'none', null, null, null, date '2026-09-15');
    raise exception 'DUPLICATE_ALLOWED';
  exception when sqlstate 'P0001' then
    if sqlerrm not like '%COMPENSATION_DATE_EXISTS%' then raise; end if;
  end;
  begin
    update public.employee_compensation set hourly_rate = 99 where employee_id = target and effective_from = date '2026-09-15';
    raise exception 'UPDATE_ALLOWED';
  exception when sqlstate 'P0001' then
    if sqlerrm not like '%COMPENSATION_HISTORY_IMMUTABLE%' then raise; end if;
  end;
  if (select a.user_id from public.audit_logs a where a.action = 'EMPLOYEE_COMPENSATION_CREATED' and a.new_value->>'employee_id' = target::text order by a.created_at desc limit 1) <> profile_user then
    raise exception 'AUDIT_ACTOR';
  end if;

  select e.id into self_employee from public.employees e where e.profile_id = profile_user and e.museum_id = museum limit 1;
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
  values (museum, profile_user, perm, 'deny');
  if public.has_permission('compensation.manage') then raise exception 'DENY_IGNORED'; end if;
  delete from public.user_permissions where user_id = profile_user and permission_id = perm;

  update public.employees set access_profile = 'director_ejecutivo' where profile_id = profile_user;
  if not public.has_permission('compensation.read') or not public.has_permission('compensation.manage') then raise exception 'DIRECTOR_DENIED'; end if;
  perform public.save_employee_compensation(target, 'salary', null, 3000, 'monthly', 'monthly', null, false, 'none', null, null, null, date '2027-06-01');

  update public.employees set access_profile = 'gerente_museografica' where profile_id = profile_user;
  if public.has_permission('compensation.read') then raise exception 'MUSEOGRAFICA_ALLOWED'; end if;
  update public.employees set access_profile = 'tecnico_produccion' where profile_id = profile_user;
  if public.has_permission('compensation.read') then raise exception 'TECH_ALLOWED'; end if;

  perform set_config('request.jwt.claim.sub', employee_user::text, true);
  if public.has_permission('compensation.read') then raise exception 'EMPLOYEE_ALLOWED'; end if;
  begin
    perform public.get_employee_compensation(target, date '2026-12-15');
    raise exception 'EMPLOYEE_READ_ALLOWED';
  exception when insufficient_privilege or sqlstate '42501' then null;
  end;

  perform set_config('request.jwt.claim.sub', other_admin::text, true);
  begin
    perform public.get_employee_compensation(target, date '2026-12-15');
    raise exception 'OTHER_MUSEUM_READ';
  exception when sqlstate 'P0001' or sqlstate '42501' then null;
  end;
  begin
    perform public.save_employee_compensation(target, 'hourly', 1, null, null, null, 40, true, 'none', null, null, null, date '2028-01-01');
    raise exception 'OTHER_MUSEUM_WRITE';
  exception when sqlstate 'P0001' or sqlstate '42501' then null;
  end;
  if (select count(*) from public.employee_compensation where employee_id = target and effective_from = date '2028-01-01') <> 0 then raise exception 'OTHER_MUSEUM_WROTE'; end if;

  raise notice 'EMPLOYEE_COMPENSATION_OK';
end
$test$;
