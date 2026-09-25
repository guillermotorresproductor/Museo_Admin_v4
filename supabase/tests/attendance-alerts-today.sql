-- Today-only operational alerts. The runner wraps this in a transaction and rolls it back.
-- Staging may lack the production permission patches. These setup blocks install them
-- only inside this transaction and disappear with the rollback.

insert into public.permissions(code, description, sensitivity) values
  ('attendance.alerts.read', 'Consultar y revisar las alertas operativas de asistencia del museo', 'sensitive'),
  ('attendance.overtime.decide', 'Aprobar o rechazar horas extra del museo', 'critical'),
  ('attendance.corrections.decide', 'Aprobar o rechazar correcciones de ponches del museo', 'critical')
on conflict (code) do update set description = excluded.description, sensitivity = excluded.sensitivity;

do $setup$
declare src text; patched text; pos integer; grant_sql text;
begin
  src := pg_get_functiondef('public.has_permission(text)'::regprocedure);
  if position('attendance.alerts.read' in src) = 0 then
    grant_sql := $g$
 if requested_permission = 'attendance.alerts.read'
    and not exists(
      select 1 from public.user_permissions u
      join public.permissions p on p.id = u.permission_id
      where u.user_id = auth.uid() and u.museum_id = public.current_user_museum_id()
        and p.code = 'attendance.alerts.read' and u.effect = 'deny'
        and (u.valid_until is null or u.valid_until > now())
    )
    and exists(select 1 from public.profiles pr where pr.id = auth.uid() and pr.museum_id = public.current_user_museum_id() and pr.status in ('active','activo'))
    and (
      public.current_employee_module_profile() in ('administrador_general','director_ejecutivo','gerente_administrativo')
      or (public.current_employee_module_profile() is null and exists(select 1 from public.profiles pr where pr.id = auth.uid() and lower(pr.role) = 'administrador'))
    ) then
   return true;
 end if;
$g$;
    pos := position(E'\nbegin' in src);
    patched := overlay(src placing E'\nbegin' || grant_sql from pos for 6);
    execute patched;
    src := patched;
  end if;
  if position('attendance.overtime.decide' in src) = 0 then
    grant_sql := $g$
 if requested_permission = 'attendance.overtime.decide'
    and public.current_employee_module_profile() in ('director_ejecutivo','gerente_administrativo') then
   return true;
 end if;
$g$;
    pos := position(E'\nbegin' in src);
    patched := overlay(src placing E'\nbegin' || grant_sql from pos for 6);
    execute patched;
    src := patched;
  end if;
  if position('attendance.corrections.decide' in src) = 0 then
    grant_sql := $g$
 if requested_permission = 'attendance.corrections.decide'
    and public.current_employee_module_profile() in ('director_ejecutivo','gerente_administrativo') then
   return true;
 end if;
$g$;
    pos := position(E'\nbegin' in src);
    patched := overlay(src placing E'\nbegin' || grant_sql from pos for 6);
    execute patched;
  end if;
end
$setup$;


do $test$
declare
  admin uuid := '25abccb5-3927-4b1d-b928-098fde77f97c';
  other_admin uuid := '6bed20b8-9bea-4dbf-9dab-0998051d2a71';
  employee_user uuid := 'cc2a33ee-6267-4cb0-8b63-1c5ede309d9e';
  profile_user uuid := 'ca3d0682-662b-4fb5-b859-8e150beb07e6';
  museum uuid;
  today date;
  yesterday date;
  before_count integer;
  after_count integer;
  listed jsonb;
  snapshot jsonb;
begin
  perform set_config('request.jwt.claim.sub', admin::text, true);
  museum := public.current_user_museum_id();
  today := (now() at time zone 'America/Puerto_Rico')::date;
  yesterday := today - 1;
  alter table public.employees disable trigger protect_employee_module_profile;

  if to_regclass('public.attendance_operational_alerts') is null then
    create table public.attendance_operational_alerts (
      id uuid primary key default gen_random_uuid(),
      museum_id uuid not null,
      employee_id uuid not null,
      shift_id uuid not null,
      alert_date date not null,
      alert_type text not null,
      detected_at timestamptz not null default now(),
      status text not null default 'active',
      resolved_at timestamptz,
      resolution_type text,
      details jsonb not null default '{}'::jsonb,
      reviewed_by uuid,
      reviewed_at timestamptz,
      review_comment text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique (shift_id, alert_type)
    );
  end if;

  insert into public.employees(id, museum_id, first_name, last_name, email, status, access_level)
  values
    ('a2500000-0000-4000-8000-000000000001', museum, 'Ayer', 'Activa', 'alert-y-active@example.test', 'activo', 'empleado'),
    ('a2500000-0000-4000-8000-000000000002', museum, 'Hoy', 'Activa', 'alert-t-active@example.test', 'activo', 'empleado'),
    ('a2500000-0000-4000-8000-000000000003', museum, 'Ayer', 'Revisada', 'alert-y-reviewed@example.test', 'activo', 'empleado'),
    ('a2500000-0000-4000-8000-000000000004', museum, 'Ayer', 'Resuelta', 'alert-y-auto@example.test', 'activo', 'empleado');

  insert into public.employee_shifts(id, museum_id, employee_id, starts_at, ends_at, expected_lunch_minutes, status, created_by)
  values
    ('b2500000-0000-4000-8000-000000000001', museum, 'a2500000-0000-4000-8000-000000000001', (yesterday + time '08:00') at time zone 'America/Puerto_Rico', (yesterday + time '17:00') at time zone 'America/Puerto_Rico', 60, 'scheduled', admin),
    ('b2500000-0000-4000-8000-000000000002', museum, 'a2500000-0000-4000-8000-000000000002', (today + time '08:00') at time zone 'America/Puerto_Rico', (today + time '17:00') at time zone 'America/Puerto_Rico', 60, 'scheduled', admin),
    ('b2500000-0000-4000-8000-000000000003', museum, 'a2500000-0000-4000-8000-000000000003', (yesterday + time '08:05') at time zone 'America/Puerto_Rico', (yesterday + time '17:00') at time zone 'America/Puerto_Rico', 60, 'scheduled', admin),
    ('b2500000-0000-4000-8000-000000000004', museum, 'a2500000-0000-4000-8000-000000000004', (yesterday + time '08:10') at time zone 'America/Puerto_Rico', (yesterday + time '17:00') at time zone 'America/Puerto_Rico', 60, 'scheduled', admin),
    ('b2500000-0000-4000-8000-000000000005', museum, 'a2500000-0000-4000-8000-000000000001', (yesterday + time '08:00') at time zone 'America/Puerto_Rico' - interval '2 days', (yesterday + time '17:00') at time zone 'America/Puerto_Rico' - interval '2 days', 0, 'scheduled', admin);

  insert into public.attendance_operational_alerts(id, museum_id, employee_id, shift_id, alert_date, alert_type, status, details)
  values
    ('d2500000-0000-4000-8000-000000000001', museum, 'a2500000-0000-4000-8000-000000000001', 'b2500000-0000-4000-8000-000000000001', yesterday, 'missing_clock_out', 'active', '{"case":"yesterday-active"}'),
    ('d2500000-0000-4000-8000-000000000002', museum, 'a2500000-0000-4000-8000-000000000002', 'b2500000-0000-4000-8000-000000000002', today, 'late', 'active', '{"case":"today-active"}'),
    ('d2500000-0000-4000-8000-000000000003', museum, 'a2500000-0000-4000-8000-000000000003', 'b2500000-0000-4000-8000-000000000003', yesterday, 'late', 'reviewed', '{"case":"yesterday-reviewed"}'),
    ('d2500000-0000-4000-8000-000000000004', museum, 'a2500000-0000-4000-8000-000000000004', 'b2500000-0000-4000-8000-000000000004', yesterday, 'missing_clock_in', 'auto_resolved', '{"case":"yesterday-auto"}');
  update public.attendance_operational_alerts
     set reviewed_by = admin, reviewed_at = now(), review_comment = 'Se revisó ayer', resolution_type = 'manual_review', resolved_at = now()
   where id = 'd2500000-0000-4000-8000-000000000003';
  update public.attendance_operational_alerts
     set resolution_type = 'auto_condition_cleared', resolved_at = now()
   where id = 'd2500000-0000-4000-8000-000000000004';

  select jsonb_agg(to_jsonb(a) order by a.id) into snapshot
  from public.attendance_operational_alerts a
  where a.id::text like 'd2500000-%';
  select count(*) into before_count from public.attendance_operational_alerts where id::text like 'd2500000-%';

  if not public.has_permission('attendance.alerts.read') then raise exception 'ADMIN_CANNOT_READ'; end if;
  if public.has_permission('attendance.corrections.decide') then raise exception 'ADMIN_CAN_DECIDE_CORRECTION'; end if;
  if public.has_permission('attendance.overtime.decide') then raise exception 'ADMIN_CAN_DECIDE_OVERTIME'; end if;

  listed := public.list_attendance_operational_alerts();
  if exists (select 1 from jsonb_array_elements(listed) r where r->>'id' = 'd2500000-0000-4000-8000-000000000001') then raise exception 'YESTERDAY_ACTIVE_LISTED'; end if;
  if exists (select 1 from jsonb_array_elements(listed) r where r->>'alert_date' = yesterday::text and r->>'employee_id' like 'a2500000-%') then raise exception 'YESTERDAY_DATE_LISTED'; end if;
  if not exists (select 1 from jsonb_array_elements(listed) r where r->>'id' = 'd2500000-0000-4000-8000-000000000002' and r->>'alert_date' = today::text and r->>'status' = 'active') then raise exception 'TODAY_MISSING'; end if;
  if exists (select 1 from jsonb_array_elements(listed) r where r->>'id' in ('d2500000-0000-4000-8000-000000000003','d2500000-0000-4000-8000-000000000004')) then raise exception 'YESTERDAY_CLOSED_LISTED'; end if;

  select count(*) into after_count from public.attendance_operational_alerts where id::text like 'd2500000-%';
  if before_count <> after_count or before_count <> 4 then raise exception 'ALERT_ROWS_CHANGED'; end if;
  if snapshot is distinct from (
    select jsonb_agg(to_jsonb(a) order by a.id) from public.attendance_operational_alerts a where a.id::text like 'd2500000-%'
  ) then raise exception 'ALERT_ROW_MUTATED'; end if;
  if (select status from public.attendance_operational_alerts where id = 'd2500000-0000-4000-8000-000000000001') <> 'active' then raise exception 'YESTERDAY_ACTIVE_STATUS'; end if;
  if (select status from public.attendance_operational_alerts where id = 'd2500000-0000-4000-8000-000000000003') <> 'reviewed' then raise exception 'REVIEWED_CHANGED'; end if;
  if (select status from public.attendance_operational_alerts where id = 'd2500000-0000-4000-8000-000000000004') <> 'auto_resolved' then raise exception 'AUTO_CHANGED'; end if;

  perform set_config('request.jwt.claim.sub', other_admin::text, true);
  listed := public.list_attendance_operational_alerts();
  if exists (select 1 from jsonb_array_elements(listed) r where r->>'employee_id' like 'a2500000-%') then raise exception 'MUSEUM_LEAK'; end if;

  perform set_config('request.jwt.claim.sub', employee_user::text, true);
  if public.has_permission('attendance.alerts.read') then raise exception 'EMPLOYEE_CAN_READ'; end if;
  begin
    perform public.list_attendance_operational_alerts();
    raise exception 'EMPLOYEE_LIST_ALLOWED';
  exception when insufficient_privilege or sqlstate '42501' then null;
  end;

  perform set_config('request.jwt.claim.sub', profile_user::text, true);
  update public.profiles set museum_id = museum where id = profile_user;
  update public.employees set museum_id = museum, access_profile = 'gerente_administrativo' where profile_id = profile_user;
  if not public.has_permission('attendance.corrections.decide') then raise exception 'MANAGER_CANNOT_DECIDE'; end if;
  if not public.has_permission('attendance.overtime.decide') then raise exception 'MANAGER_CANNOT_DECIDE_OVERTIME'; end if;

  insert into public.attendance_attempts(id, museum_id, employee_id, shift_id, actor_user_id, requested_event, result)
  values ('c2500000-0000-4000-8000-000000000001', museum, 'a2500000-0000-4000-8000-000000000001', 'b2500000-0000-4000-8000-000000000005', employee_user, 'clock_out', 'accepted');
  insert into public.attendance_events(id, museum_id, employee_id, shift_id, attempt_id, event_type, occurred_at, classification, settings_version, created_by)
  values ('e2500000-0000-4000-8000-000000000001', museum, 'a2500000-0000-4000-8000-000000000001', 'b2500000-0000-4000-8000-000000000005', 'c2500000-0000-4000-8000-000000000001', 'clock_out', (yesterday + time '17:30') at time zone 'America/Puerto_Rico' - interval '2 days', 'overtime_pending', 1, admin);
  insert into public.attendance_correction_requests(museum_id, employee_id, shift_id, requested_event_type, requested_occurred_at, reason, status, requested_by)
  values (museum, 'a2500000-0000-4000-8000-000000000001', 'b2500000-0000-4000-8000-000000000001', 'clock_out', (yesterday + time '17:20') at time zone 'America/Puerto_Rico', 'Salida de ayer pendiente', 'pending', employee_user);
  insert into public.attendance_overtime_reviews(museum_id, employee_id, shift_id, clock_out_event_id, additional_minutes, status)
  values (museum, 'a2500000-0000-4000-8000-000000000001', 'b2500000-0000-4000-8000-000000000005', 'e2500000-0000-4000-8000-000000000001', 30, 'pending');

  listed := public.list_attendance_corrections();
  if not exists (select 1 from jsonb_array_elements(listed->'pending') r where r->>'name' = 'Ayer Activa') then raise exception 'CORRECTION_HIDDEN'; end if;
  listed := public.list_overtime_reviews();
  if not exists (select 1 from jsonb_array_elements(listed->'pending') r where r->>'name' = 'Ayer Activa') then raise exception 'OVERTIME_HIDDEN'; end if;

  raise notice 'ALERTS_TODAY_OK';
end
$test$;
