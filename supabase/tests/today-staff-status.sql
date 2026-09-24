-- Staging-only exercise. The runner wraps this in a transaction and rolls it back.
-- Requires the migration statements to run in the same transaction first.

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
  late_start timestamptz := (day + time '10:00') at time zone 'America/Puerto_Rico';
  late_end timestamptz := (day + time '14:00') at time zone 'America/Puerto_Rico';
  rows jsonb;
  n integer;
  rec jsonb;
  early_minutes integer;
  open_minutes integer;
begin
  alter table public.employees disable trigger protect_employee_module_profile;
  perform set_config('request.jwt.claim.sub', admin::text, true);
  if not public.has_permission('attendance.today.read') then
    raise exception 'ADMIN_DENIED';
  end if;

  update public.employees set access_profile = 'gerente_administrativo' where profile_id = profile_user;
  perform set_config('request.jwt.claim.sub', profile_user::text, true);
  if not public.has_permission('attendance.today.read') then raise exception 'MANAGER_DENIED'; end if;
  update public.employees set access_profile = 'director_ejecutivo' where profile_id = profile_user;
  if not public.has_permission('attendance.today.read') then raise exception 'DIRECTOR_DENIED'; end if;
  update public.employees set access_profile = 'administrador_general' where profile_id = profile_user;
  if not public.has_permission('attendance.today.read') then raise exception 'GENERAL_ADMIN_DENIED'; end if;
  update public.employees set access_profile = 'gerente_museografica' where profile_id = profile_user;
  if public.has_permission('attendance.today.read') then raise exception 'OTHER_PROFILE_ALLOWED'; end if;

  perform set_config('request.jwt.claim.sub', employee_user::text, true);
  if public.has_permission('attendance.today.read') then raise exception 'EMPLOYEE_ALLOWED'; end if;
  begin
    perform public.list_today_staff_status();
    raise exception 'EMPLOYEE_RPC_ALLOWED';
  exception when insufficient_privilege or sqlstate '42501' then null;
  end;

  perform set_config('request.jwt.claim.sub', admin::text, true);

  insert into public.employees(id,museum_id,first_name,last_name,email,status,access_level)
  values
    ('a1000000-0000-4000-8000-000000000001',museum,'Trabaja','Hoy','today-work@example.test','activo','empleado'),
    ('a1000000-0000-4000-8000-000000000002',museum,'Almuerza','Hoy','today-lunch@example.test','activo','empleado'),
    ('a1000000-0000-4000-8000-000000000003',museum,'Regreso','Hoy','today-back@example.test','activo','empleado'),
    ('a1000000-0000-4000-8000-000000000004',museum,'Termino','Hoy','today-out@example.test','activo','empleado'),
    ('a1000000-0000-4000-8000-000000000005',museum,'Sin','Ponche','today-none@example.test','activo','empleado'),
    ('a1000000-0000-4000-8000-000000000006',museum,'Mala','Secuencia','today-bad@example.test','activo','empleado'),
    ('a1000000-0000-4000-8000-000000000007',museum,'Temprano','Hoy','today-early@example.test','activo','empleado'),
    ('a1000000-0000-4000-8000-000000000008',museum,'Tarde','Horario','today-late@example.test','activo','empleado'),
    ('a1000000-0000-4000-8000-000000000009',museum,'Inactivo','Hoy','today-off@example.test','inactivo','empleado');

  insert into public.employee_shifts(id,museum_id,employee_id,starts_at,ends_at,expected_lunch_minutes,status,created_by)
  select id, museum, emp, starts, ends, 60, 'scheduled', admin
  from (values
    ('b1000000-0000-4000-8000-000000000001'::uuid,'a1000000-0000-4000-8000-000000000001'::uuid,start_at,end_at),
    ('b1000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000002',start_at,end_at),
    ('b1000000-0000-4000-8000-000000000003','a1000000-0000-4000-8000-000000000003',start_at,end_at),
    ('b1000000-0000-4000-8000-000000000004','a1000000-0000-4000-8000-000000000004',start_at,end_at),
    ('b1000000-0000-4000-8000-000000000005','a1000000-0000-4000-8000-000000000005',start_at,end_at),
    ('b1000000-0000-4000-8000-000000000006','a1000000-0000-4000-8000-000000000006',start_at,end_at),
    ('b1000000-0000-4000-8000-000000000007','a1000000-0000-4000-8000-000000000007',start_at,end_at),
    ('b1000000-0000-4000-8000-000000000008','a1000000-0000-4000-8000-000000000008',late_start,late_end),
    ('b1000000-0000-4000-8000-000000000009','a1000000-0000-4000-8000-000000000009',start_at,end_at),
    ('b1000000-0000-4000-8000-000000000010','a1000000-0000-4000-8000-000000000005',start_at+interval '1 minute',end_at)
  ) v(id,emp,starts,ends);
  update public.employee_shifts set status='cancelled' where id='b1000000-0000-4000-8000-000000000010';

  insert into public.attendance_attempts(id,museum_id,employee_id,shift_id,actor_user_id,requested_event,result)
  select id, museum, emp, shift, admin, 'clock_in', 'accepted'
  from (values
    ('c1000000-0000-4000-8000-000000000001'::uuid,'a1000000-0000-4000-8000-000000000001'::uuid,'b1000000-0000-4000-8000-000000000001'::uuid),
    ('c1000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000002','b1000000-0000-4000-8000-000000000002'),
    ('c1000000-0000-4000-8000-000000000003','a1000000-0000-4000-8000-000000000002','b1000000-0000-4000-8000-000000000002'),
    ('c1000000-0000-4000-8000-000000000004','a1000000-0000-4000-8000-000000000003','b1000000-0000-4000-8000-000000000003'),
    ('c1000000-0000-4000-8000-000000000005','a1000000-0000-4000-8000-000000000003','b1000000-0000-4000-8000-000000000003'),
    ('c1000000-0000-4000-8000-000000000006','a1000000-0000-4000-8000-000000000003','b1000000-0000-4000-8000-000000000003'),
    ('c1000000-0000-4000-8000-000000000007','a1000000-0000-4000-8000-000000000004','b1000000-0000-4000-8000-000000000004'),
    ('c1000000-0000-4000-8000-000000000008','a1000000-0000-4000-8000-000000000004','b1000000-0000-4000-8000-000000000004'),
    ('c1000000-0000-4000-8000-000000000009','a1000000-0000-4000-8000-000000000004','b1000000-0000-4000-8000-000000000004'),
    ('c1000000-0000-4000-8000-000000000010','a1000000-0000-4000-8000-000000000004','b1000000-0000-4000-8000-000000000004'),
    ('c1000000-0000-4000-8000-000000000011','a1000000-0000-4000-8000-000000000006','b1000000-0000-4000-8000-000000000006'),
    ('c1000000-0000-4000-8000-000000000012','a1000000-0000-4000-8000-000000000007','b1000000-0000-4000-8000-000000000007'),
    ('c1000000-0000-4000-8000-000000000013','a1000000-0000-4000-8000-000000000008','b1000000-0000-4000-8000-000000000008')
  ) v(id,emp,shift);

  insert into public.attendance_events(museum_id,employee_id,shift_id,attempt_id,event_type,occurred_at,classification,settings_version,created_by)
  values
    (museum,'a1000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000001','clock_in',start_at,'on_time',1,admin),
    (museum,'a1000000-0000-4000-8000-000000000002','b1000000-0000-4000-8000-000000000002','c1000000-0000-4000-8000-000000000002','clock_in',start_at,'on_time',1,admin),
    (museum,'a1000000-0000-4000-8000-000000000002','b1000000-0000-4000-8000-000000000002','c1000000-0000-4000-8000-000000000003','lunch_out',start_at+interval '4 hours','standard',1,admin),
    (museum,'a1000000-0000-4000-8000-000000000003','b1000000-0000-4000-8000-000000000003','c1000000-0000-4000-8000-000000000004','clock_in',start_at,'on_time',1,admin),
    (museum,'a1000000-0000-4000-8000-000000000003','b1000000-0000-4000-8000-000000000003','c1000000-0000-4000-8000-000000000005','lunch_out',start_at+interval '4 hours','standard',1,admin),
    (museum,'a1000000-0000-4000-8000-000000000003','b1000000-0000-4000-8000-000000000003','c1000000-0000-4000-8000-000000000006','lunch_in',start_at+interval '5 hours','standard',1,admin),
    (museum,'a1000000-0000-4000-8000-000000000004','b1000000-0000-4000-8000-000000000004','c1000000-0000-4000-8000-000000000007','clock_in',start_at,'on_time',1,admin),
    (museum,'a1000000-0000-4000-8000-000000000004','b1000000-0000-4000-8000-000000000004','c1000000-0000-4000-8000-000000000008','lunch_out',start_at+interval '4 hours','standard',1,admin),
    (museum,'a1000000-0000-4000-8000-000000000004','b1000000-0000-4000-8000-000000000004','c1000000-0000-4000-8000-000000000009','lunch_in',start_at+interval '5 hours','standard',1,admin),
    (museum,'a1000000-0000-4000-8000-000000000004','b1000000-0000-4000-8000-000000000004','c1000000-0000-4000-8000-000000000010','clock_out',end_at,'standard',1,admin),
    (museum,'a1000000-0000-4000-8000-000000000006','b1000000-0000-4000-8000-000000000006','c1000000-0000-4000-8000-000000000011','clock_out',end_at,'standard',1,admin),
    (museum,'a1000000-0000-4000-8000-000000000007','b1000000-0000-4000-8000-000000000007','c1000000-0000-4000-8000-000000000012','clock_in',start_at-interval '10 minutes','on_time',1,admin),
    (museum,'a1000000-0000-4000-8000-000000000008','b1000000-0000-4000-8000-000000000008','c1000000-0000-4000-8000-000000000013','clock_in',late_start-interval '30 minutes','on_time',1,admin);

  rows := public.list_today_staff_status();
  if exists(select 1 from jsonb_array_elements(rows) r where r->>'name' = 'Inactivo Hoy') then raise exception 'INACTIVE_INCLUDED'; end if;
  select count(*) into n from jsonb_array_elements(rows) r where r->>'employee_id' like 'a1000000-%';
  if n <> 8 then raise exception 'ROW_COUNT_%', n; end if;

  select r into rec from jsonb_array_elements(rows) r where r->>'name'='Trabaja Hoy';
  if rec->>'status' <> 'TRABAJANDO' then raise exception 'WORK_STATUS_%', rec->>'status'; end if;
  open_minutes := floor(extract(epoch from (now()-start_at))/60);
  if (rec->>'worked_minutes')::int <> open_minutes then raise exception 'WORK_MINUTES_%_EXPECTED_%', rec->>'worked_minutes', open_minutes; end if;

  select r into rec from jsonb_array_elements(rows) r where r->>'name'='Almuerza Hoy';
  if rec->>'status' <> 'ALMUERZO' or (rec->>'worked_minutes')::int <> 240 then raise exception 'LUNCH_%_%', rec->>'status', rec->>'worked_minutes'; end if;

  select r into rec from jsonb_array_elements(rows) r where r->>'name'='Regreso Hoy';
  if rec->>'status' <> 'TRABAJANDO' then raise exception 'RETURN_STATUS_%', rec->>'status'; end if;
  if (rec->>'worked_minutes')::int <> 240 + floor(extract(epoch from (now()-(start_at+interval '5 hours')))/60) then raise exception 'RETURN_MINUTES_%', rec->>'worked_minutes'; end if;

  select r into rec from jsonb_array_elements(rows) r where r->>'name'='Termino Hoy';
  if rec->>'status' <> 'JORNADA TERMINADA' or (rec->>'worked_minutes')::int <> 480 then raise exception 'DONE_%_%', rec->>'status', rec->>'worked_minutes'; end if;

  select r into rec from jsonb_array_elements(rows) r where r->>'name'='Sin Ponche';
  if rec->>'status' <> 'NO HA PONCHADO' or (rec->>'worked_minutes')::int <> 0 then raise exception 'NONE_%_%', rec->>'status', rec->>'worked_minutes'; end if;

  select r into rec from jsonb_array_elements(rows) r where r->>'name'='Mala Secuencia';
  if rec->>'status' <> 'INCONSISTENCIA' or (rec->>'worked_minutes')::int <> 0 then raise exception 'BAD_%_%', rec->>'status', rec->>'worked_minutes'; end if;

  select r into rec from jsonb_array_elements(rows) r where r->>'name'='Temprano Hoy';
  early_minutes := floor(extract(epoch from (now()-start_at))/60);
  if rec->>'status' <> 'TRABAJANDO' or (rec->>'worked_minutes')::int <> early_minutes then raise exception 'EARLY_%_%', rec->>'status', rec->>'worked_minutes'; end if;

  select r into rec from jsonb_array_elements(rows) r where r->>'name'='Tarde Horario';
  if (rec->>'worked_minutes')::int <> floor(extract(epoch from (now()-late_start))/60) then raise exception 'SHIFT_MINUTES_%', rec->>'worked_minutes'; end if;

  perform set_config('request.jwt.claim.sub', other_admin::text, true);
  rows := public.list_today_staff_status();
  if exists(select 1 from jsonb_array_elements(rows) r where r->>'employee_id' like 'a1000000-%') then raise exception 'MUSEUM_LEAK'; end if;

  raise notice 'TODAY_STAFF_STATUS_OK';
end
$test$;
