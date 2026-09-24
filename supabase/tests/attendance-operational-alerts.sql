-- Staging exercise. The runner wraps this in a transaction and rolls it back.

do $test$
declare
  admin uuid := '25abccb5-3927-4b1d-b928-098fde77f97c';
  other_admin uuid := '6bed20b8-9bea-4dbf-9dab-0998051d2a71';
  employee_user uuid := 'cc2a33ee-6267-4cb0-8b63-1c5ede309d9e';
  profile_user uuid := 'ca3d0682-662b-4fb5-b859-8e150beb07e6';
  museum uuid := '00000000-0000-0000-0000-000000000001';
  day date := (now() at time zone 'America/Puerto_Rico')::date;
  start_at timestamptz := (day + time '08:00') at time zone 'America/Puerto_Rico';
  end_at timestamptz := (day + time '17:00') at time zone 'America/Puerto_Rico';
  past_end timestamptz := start_at + interval '4 hours';
  tolerance integer;
  rows jsonb;
  rec jsonb;
  n integer;
  incidents integer;
  approved integer;
begin
  if now() <= past_end then raise exception 'TEST_CLOCK_BEFORE_SHIFT_END'; end if;
  alter table public.employees disable trigger protect_employee_module_profile;
  insert into public.attendance_settings(museum_id, late_tolerance_minutes)
  select museum, 5
  where not exists (select 1 from public.attendance_settings where museum_id = museum);
  select late_tolerance_minutes into tolerance from public.attendance_settings where museum_id = museum;

  perform set_config('request.jwt.claim.sub', admin::text, true);
  if not public.has_permission('attendance.alerts.read') then raise exception 'ADMIN_DENIED'; end if;
  update public.employees set access_profile = 'gerente_administrativo' where profile_id = profile_user;
  perform set_config('request.jwt.claim.sub', profile_user::text, true);
  if not public.has_permission('attendance.alerts.read') then raise exception 'MANAGER_DENIED'; end if;
  update public.employees set access_profile = 'director_ejecutivo' where profile_id = profile_user;
  if not public.has_permission('attendance.alerts.read') then raise exception 'DIRECTOR_DENIED'; end if;
  update public.employees set access_profile = 'gerente_museografica' where profile_id = profile_user;
  if public.has_permission('attendance.alerts.read') then raise exception 'OTHER_PROFILE_ALLOWED'; end if;
  perform set_config('request.jwt.claim.sub', employee_user::text, true);
  if public.has_permission('attendance.alerts.read') then raise exception 'EMPLOYEE_ALLOWED'; end if;
  begin
    perform public.sync_attendance_operational_alerts();
    raise exception 'EMPLOYEE_RPC_ALLOWED';
  exception when insufficient_privilege or sqlstate '42501' then null;
  end;
  perform set_config('request.jwt.claim.sub', admin::text, true);

  insert into public.employees(id,museum_id,first_name,last_name,email,status,access_level)
  values
    ('a2000000-0000-4000-8000-000000000001',museum,'Puntual','Hoy','alert-ok@example.test','activo','empleado'),
    ('a2000000-0000-4000-8000-000000000002',museum,'Tarde','Hoy','alert-late@example.test','activo','empleado'),
    ('a2000000-0000-4000-8000-000000000003',museum,'Sin','Entrada','alert-none@example.test','activo','empleado'),
    ('a2000000-0000-4000-8000-000000000004',museum,'Almuerzo','Corto','alert-lunch-ok@example.test','activo','empleado'),
    ('a2000000-0000-4000-8000-000000000005',museum,'Almuerzo','Largo','alert-lunch-long@example.test','activo','empleado'),
    ('a2000000-0000-4000-8000-000000000006',museum,'Sin','Almuerzo','alert-no-lunch@example.test','activo','empleado'),
    ('a2000000-0000-4000-8000-000000000007',museum,'Salida','Temprana','alert-early@example.test','activo','empleado'),
    ('a2000000-0000-4000-8000-000000000008',museum,'Mala','Secuencia','alert-bad@example.test','activo','empleado'),
    ('a2000000-0000-4000-8000-000000000009',museum,'Margen','Salida','alert-grace@example.test','activo','empleado'),
    ('a2000000-0000-4000-8000-000000000010',museum,'Salida','Olvidada','alert-forgot@example.test','activo','empleado'),
    ('a2000000-0000-4000-8000-000000000011',museum,'Rota','Salida','alert-both@example.test','activo','empleado');

  insert into public.employee_shifts(id,museum_id,employee_id,starts_at,ends_at,expected_lunch_minutes,status,created_by)
  select id, museum, emp, starts, ends, 60, 'scheduled', admin
  from (values
    ('b2000000-0000-4000-8000-000000000001'::uuid,'a2000000-0000-4000-8000-000000000001'::uuid,start_at,end_at),
    ('b2000000-0000-4000-8000-000000000002','a2000000-0000-4000-8000-000000000002',start_at,end_at),
    ('b2000000-0000-4000-8000-000000000003','a2000000-0000-4000-8000-000000000003',start_at,end_at),
    ('b2000000-0000-4000-8000-000000000004','a2000000-0000-4000-8000-000000000004',start_at,end_at),
    ('b2000000-0000-4000-8000-000000000005','a2000000-0000-4000-8000-000000000005',start_at,end_at),
    ('b2000000-0000-4000-8000-000000000006','a2000000-0000-4000-8000-000000000006',start_at,past_end),
    ('b2000000-0000-4000-8000-000000000007','a2000000-0000-4000-8000-000000000007',start_at,end_at),
    ('b2000000-0000-4000-8000-000000000008','a2000000-0000-4000-8000-000000000008',start_at,end_at),
    ('b2000000-0000-4000-8000-000000000009','a2000000-0000-4000-8000-000000000009',start_at,now()-interval '3 minutes'),
    ('b2000000-0000-4000-8000-000000000010','a2000000-0000-4000-8000-000000000010',start_at,now()-interval '6 minutes'),
    ('b2000000-0000-4000-8000-000000000011','a2000000-0000-4000-8000-000000000011',start_at,now()-interval '6 minutes')
  ) v(id,emp,starts,ends);

  insert into public.attendance_attempts(id,museum_id,employee_id,shift_id,actor_user_id,requested_event,result)
  select id, museum, emp, shift, admin, 'clock_in', 'accepted'
  from (values
    ('c2000000-0000-4000-8000-000000000001'::uuid,'a2000000-0000-4000-8000-000000000001'::uuid,'b2000000-0000-4000-8000-000000000001'::uuid),
    ('c2000000-0000-4000-8000-000000000002','a2000000-0000-4000-8000-000000000002','b2000000-0000-4000-8000-000000000002'),
    ('c2000000-0000-4000-8000-000000000004','a2000000-0000-4000-8000-000000000004','b2000000-0000-4000-8000-000000000004'),
    ('c2000000-0000-4000-8000-000000000005','a2000000-0000-4000-8000-000000000004','b2000000-0000-4000-8000-000000000004'),
    ('c2000000-0000-4000-8000-000000000006','a2000000-0000-4000-8000-000000000005','b2000000-0000-4000-8000-000000000005'),
    ('c2000000-0000-4000-8000-000000000007','a2000000-0000-4000-8000-000000000005','b2000000-0000-4000-8000-000000000005'),
    ('c2000000-0000-4000-8000-000000000008','a2000000-0000-4000-8000-000000000006','b2000000-0000-4000-8000-000000000006'),
    ('c2000000-0000-4000-8000-000000000009','a2000000-0000-4000-8000-000000000007','b2000000-0000-4000-8000-000000000007'),
    ('c2000000-0000-4000-8000-000000000010','a2000000-0000-4000-8000-000000000007','b2000000-0000-4000-8000-000000000007'),
    ('c2000000-0000-4000-8000-000000000011','a2000000-0000-4000-8000-000000000008','b2000000-0000-4000-8000-000000000008'),
    ('c2000000-0000-4000-8000-000000000014','a2000000-0000-4000-8000-000000000009','b2000000-0000-4000-8000-000000000009'),
    ('c2000000-0000-4000-8000-000000000015','a2000000-0000-4000-8000-000000000010','b2000000-0000-4000-8000-000000000010'),
    ('c2000000-0000-4000-8000-000000000016','a2000000-0000-4000-8000-000000000011','b2000000-0000-4000-8000-000000000011'),
    ('c2000000-0000-4000-8000-000000000017','a2000000-0000-4000-8000-000000000011','b2000000-0000-4000-8000-000000000011')
  ) v(id,emp,shift);

  insert into public.attendance_events(museum_id,employee_id,shift_id,attempt_id,event_type,occurred_at,classification,settings_version,created_by)
  values
    (museum,'a2000000-0000-4000-8000-000000000001','b2000000-0000-4000-8000-000000000001','c2000000-0000-4000-8000-000000000001','clock_in',start_at+make_interval(mins=>tolerance),'tolerance',1,admin),
    (museum,'a2000000-0000-4000-8000-000000000002','b2000000-0000-4000-8000-000000000002','c2000000-0000-4000-8000-000000000002','clock_in',start_at+make_interval(mins=>tolerance+1),'late',1,admin),
    (museum,'a2000000-0000-4000-8000-000000000004','b2000000-0000-4000-8000-000000000004','c2000000-0000-4000-8000-000000000004','clock_in',start_at,'on_time',1,admin),
    (museum,'a2000000-0000-4000-8000-000000000004','b2000000-0000-4000-8000-000000000004','c2000000-0000-4000-8000-000000000005','lunch_out',now()-interval '20 minutes','standard',1,admin),
    (museum,'a2000000-0000-4000-8000-000000000005','b2000000-0000-4000-8000-000000000005','c2000000-0000-4000-8000-000000000006','clock_in',start_at,'on_time',1,admin),
    (museum,'a2000000-0000-4000-8000-000000000005','b2000000-0000-4000-8000-000000000005','c2000000-0000-4000-8000-000000000007','lunch_out',now()-interval '90 minutes','standard',1,admin),
    (museum,'a2000000-0000-4000-8000-000000000006','b2000000-0000-4000-8000-000000000006','c2000000-0000-4000-8000-000000000008','clock_in',start_at,'on_time',1,admin),
    (museum,'a2000000-0000-4000-8000-000000000007','b2000000-0000-4000-8000-000000000007','c2000000-0000-4000-8000-000000000009','clock_in',start_at,'on_time',1,admin),
    (museum,'a2000000-0000-4000-8000-000000000007','b2000000-0000-4000-8000-000000000007','c2000000-0000-4000-8000-000000000010','clock_out',end_at-interval '30 minutes','standard',1,admin),
    (museum,'a2000000-0000-4000-8000-000000000008','b2000000-0000-4000-8000-000000000008','c2000000-0000-4000-8000-000000000011','clock_out',end_at,'standard',1,admin),
    (museum,'a2000000-0000-4000-8000-000000000009','b2000000-0000-4000-8000-000000000009','c2000000-0000-4000-8000-000000000014','clock_in',start_at,'on_time',1,admin),
    (museum,'a2000000-0000-4000-8000-000000000010','b2000000-0000-4000-8000-000000000010','c2000000-0000-4000-8000-000000000015','clock_in',start_at,'on_time',1,admin),
    (museum,'a2000000-0000-4000-8000-000000000011','b2000000-0000-4000-8000-000000000011','c2000000-0000-4000-8000-000000000016','clock_in',start_at,'on_time',1,admin),
    (museum,'a2000000-0000-4000-8000-000000000011','b2000000-0000-4000-8000-000000000011','c2000000-0000-4000-8000-000000000017','lunch_in',start_at+interval '5 hours','standard',1,admin);

  rows := public.sync_attendance_operational_alerts();
  if exists (select 1 from jsonb_array_elements(rows) r where r->>'name'='Puntual Hoy' and r->>'alert_type'='late') then raise exception 'TOLERANCE_ALERTED'; end if;
  select r into rec from jsonb_array_elements(rows) r where r->>'name'='Tarde Hoy' and r->>'alert_type'='late';
  if rec->>'status' <> 'active' or (rec->'details'->>'late_minutes')::int <> tolerance+1 then raise exception 'LATE_%', rec; end if;
  select r into rec from jsonb_array_elements(rows) r where r->>'name'='Sin Entrada';
  if rec->>'alert_type' <> 'missing_clock_in' or rec->>'status' <> 'active' then raise exception 'MISSING_IN_%', rec; end if;
  if exists (select 1 from jsonb_array_elements(rows) r where r->>'name'='Almuerzo Corto' and r->>'alert_type'='lunch_exceeded') then raise exception 'LUNCH_OK_ALERTED'; end if;
  select r into rec from jsonb_array_elements(rows) r where r->>'name'='Almuerzo Largo' and r->>'alert_type'='lunch_exceeded';
  if rec->>'status' <> 'active' or (rec->'details'->>'exceeded_minutes')::int < 30 then raise exception 'LUNCH_LONG_%', rec; end if;
  if (select count(*) from jsonb_array_elements(rows) r where r->>'name'='Sin Almuerzo' and r->>'alert_type' in ('missing_lunch','missing_clock_out') and r->>'status'='active') <> 2 then raise exception 'TWO_ALERTS'; end if;
  select r into rec from jsonb_array_elements(rows) r where r->>'name'='Salida Temprana' and r->>'alert_type'='early_clock_out';
  if rec->>'status' <> 'active' or (rec->'details'->>'early_minutes')::int <> 30 then raise exception 'EARLY_%', rec; end if;
  if (select count(*) from jsonb_array_elements(rows) r where r->>'name'='Mala Secuencia') <> 1
     or exists (select 1 from jsonb_array_elements(rows) r where r->>'name'='Mala Secuencia' and r->>'alert_type' <> 'inconsistent_sequence') then
    raise exception 'BAD_EXTRA';
  end if;
  if exists (select 1 from jsonb_array_elements(rows) r where r->>'name'='Margen Salida' and r->>'alert_type'='missing_clock_out') then raise exception 'GRACE_TOO_EARLY'; end if;
  select r into rec from jsonb_array_elements(rows) r where r->>'name'='Salida Olvidada' and r->>'alert_type'='missing_clock_out';
  if rec->>'status' <> 'active' then raise exception 'FORGOT_EXIT_%', rec->>'status'; end if;
  if (select count(*) from jsonb_array_elements(rows) r where r->>'name'='Rota Salida' and r->>'alert_type' in ('inconsistent_sequence','missing_clock_out') and r->>'status'='active') <> 2 then raise exception 'BOTH_OBJECTIVE'; end if;
  if exists (select 1 from jsonb_array_elements(rows) r where r->>'name'='Rota Salida' and r->>'alert_type' in ('late','lunch_exceeded','missing_lunch','early_clock_out','missing_clock_in')) then raise exception 'AMBIGUOUS_EXTRA'; end if;

  select count(*) into n from public.attendance_operational_alerts where employee_id::text like 'a2000000-%';
  perform public.sync_attendance_operational_alerts();
  if (select count(*) from public.attendance_operational_alerts where employee_id::text like 'a2000000-%') <> n then raise exception 'DUPLICATE_REFRESH'; end if;

  insert into public.attendance_attempts(id,museum_id,employee_id,shift_id,actor_user_id,requested_event,result)
  values ('c2000000-0000-4000-8000-000000000012',museum,'a2000000-0000-4000-8000-000000000003','b2000000-0000-4000-8000-000000000003',admin,'clock_in','accepted');
  insert into public.attendance_events(museum_id,employee_id,shift_id,attempt_id,event_type,occurred_at,classification,settings_version,created_by)
  values (museum,'a2000000-0000-4000-8000-000000000003','b2000000-0000-4000-8000-000000000003','c2000000-0000-4000-8000-000000000012','clock_in',now(),'late',1,admin);
  rows := public.sync_attendance_operational_alerts();
  select r into rec from jsonb_array_elements(rows) r where r->>'name'='Sin Entrada' and r->>'alert_type'='missing_clock_in';
  if rec->>'status' <> 'auto_resolved' or rec->>'resolution_type' <> 'auto_clock_in' then raise exception 'AUTO_IN_%', rec->>'status'; end if;

  insert into public.attendance_attempts(id,museum_id,employee_id,shift_id,actor_user_id,requested_event,result)
  values ('c2000000-0000-4000-8000-000000000013',museum,'a2000000-0000-4000-8000-000000000005','b2000000-0000-4000-8000-000000000005',admin,'lunch_in','accepted');
  insert into public.attendance_events(museum_id,employee_id,shift_id,attempt_id,event_type,occurred_at,classification,settings_version,created_by)
  values (museum,'a2000000-0000-4000-8000-000000000005','b2000000-0000-4000-8000-000000000005','c2000000-0000-4000-8000-000000000013','lunch_in',now(),'standard',1,admin);
  rows := public.sync_attendance_operational_alerts();
  insert into public.attendance_attempts(id,museum_id,employee_id,shift_id,actor_user_id,requested_event,result)
  values ('c2000000-0000-4000-8000-000000000018',museum,'a2000000-0000-4000-8000-000000000010','b2000000-0000-4000-8000-000000000010',admin,'clock_out','accepted');
  insert into public.attendance_events(museum_id,employee_id,shift_id,attempt_id,event_type,occurred_at,classification,settings_version,created_by)
  values (museum,'a2000000-0000-4000-8000-000000000010','b2000000-0000-4000-8000-000000000010','c2000000-0000-4000-8000-000000000018','clock_out',now(),'overtime_pending',1,admin);
  rows := public.sync_attendance_operational_alerts();
  select r into rec from jsonb_array_elements(rows) r where r->>'name'='Salida Olvidada' and r->>'alert_type'='missing_clock_out';
  if rec->>'status' <> 'auto_resolved' or rec->>'resolution_type' <> 'auto_clock_out' then raise exception 'AUTO_OUT_%', rec->>'status'; end if;
  select r into rec from jsonb_array_elements(rows) r where r->>'name'='Almuerzo Largo' and r->>'alert_type'='lunch_exceeded';
  if rec->>'status' <> 'auto_resolved' then raise exception 'AUTO_LUNCH_%', rec->>'status'; end if;

  select r into rec from jsonb_array_elements(rows) r where r->>'name'='Tarde Hoy' and r->>'alert_type'='late';
  perform public.review_attendance_operational_alert((rec->>'id')::uuid, 'Revisado en prueba');
  if not exists (
    select 1 from public.attendance_operational_alerts
    where id = (rec->>'id')::uuid and status = 'reviewed' and reviewed_by = admin
      and reviewed_at is not null and review_comment = 'Revisado en prueba'
  ) then raise exception 'REVIEW_FAILED'; end if;

  perform set_config('request.jwt.claim.sub', other_admin::text, true);
  rows := public.list_attendance_operational_alerts();
  if exists (select 1 from jsonb_array_elements(rows) r where r->>'employee_id' like 'a2000000-%') then raise exception 'MUSEUM_LEAK'; end if;

  if to_regclass('public.attendance_incidents') is not null then
    execute 'select count(*) from public.attendance_incidents where employee_id::text like ''a2000000-%''' into incidents;
  end if;
  select count(*) into approved from public.attendance_overtime_reviews where employee_id::text like 'a2000000-%' and status='approved';
  if incidents <> 0 or approved <> 0 then raise exception 'SIDE_EFFECT_%_%', incidents, approved; end if;
  raise notice 'ATTENDANCE_ALERTS_OK';
end
$test$;
