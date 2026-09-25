-- Decision-only checks. Does not insert attendance attempts or events.
-- The runner applies 202609250004 in the same transaction and rolls it back.

do $test$
declare
  radius integer := 40;
  body text := pg_get_functiondef('public.record_employee_attendance(uuid,uuid,text,jsonb)'::regprocedure);
begin
  if public.attendance_geofence_decision(20, '80', radius) is distinct from 'direct_geofence' then
    raise exception 'CASE_1';
  end if;
  if public.attendance_geofence_decision(39, null, radius) is distinct from 'direct_geofence' then
    raise exception 'CASE_2';
  end if;
  if public.attendance_geofence_decision(50, '15', radius) is distinct from 'accuracy_compensated' then
    raise exception 'CASE_3';
  end if;
  if public.attendance_geofence_decision(64.2645, '37.7628', radius) is distinct from 'accuracy_compensated' then
    raise exception 'CASE_4';
  end if;
  if public.attendance_geofence_decision(67, '38.1', radius) is distinct from 'accuracy_compensated' then
    raise exception 'CASE_5';
  end if;
  if public.attendance_geofence_decision(69, '20', radius) is distinct from 'reject' then
    raise exception 'CASE_6';
  end if;
  if public.attendance_geofence_decision(71, '40', radius) is distinct from 'reject' then
    raise exception 'CASE_7';
  end if;
  if public.attendance_geofence_decision(80, '40', radius) is distinct from 'reject' then
    raise exception 'CASE_8';
  end if;
  if public.attendance_geofence_decision(60, '41', radius) is distinct from 'reject' then
    raise exception 'CASE_9';
  end if;
  if public.attendance_geofence_decision(90, '5', radius) is distinct from 'reject' then
    raise exception 'CASE_10';
  end if;
  if public.attendance_geofence_decision(170, '3.8', radius) is distinct from 'reject' then
    raise exception 'CASE_11';
  end if;
  if public.attendance_geofence_decision(50, null, radius) is distinct from 'reject'
     or public.attendance_geofence_decision(50, 'undefined', radius) is distinct from 'reject'
     or public.attendance_geofence_decision(50, 'NaN', radius) is distinct from 'reject'
     or public.attendance_geofence_decision(50, '-5', radius) is distinct from 'reject'
     or public.attendance_geofence_decision(50, '', radius) is distinct from 'reject' then
    raise exception 'CASE_12';
  end if;
  if public.attendance_geofence_decision(22, '6.7', radius) is distinct from 'direct_geofence' then
    raise exception 'ANDROID_INSIDE';
  end if;
  if public.attendance_geofence_decision(40, '100', radius) is distinct from 'direct_geofence' then
    raise exception 'DIRECT_PRIORITY';
  end if;
  if position('attendance_geofence_decision' in body) = 0
     or position('INVALID_EVENT_SEQUENCE' in body) = 0
     or position('overtime_review_threshold_minutes' in body) = 0
     or position('lunch_out' in body) = 0 then
    raise exception 'REGRESSION_BODY';
  end if;
  if position('if not e.attendance_required' in body) = 0
     or position('ATTENDANCE_NOT_REQUIRED' in body) = 0 then
    raise exception 'ATTENDANCE_REQUIRED_GUARD_MISSING';
  end if;
  raise notice 'GEOFENCE_ACCURACY_OK';
end
$test$;

do $required$
declare
  actor uuid;
  museum uuid;
  employee uuid;
  result jsonb;
  attempts_before integer;
  events_before integer;
  entries_before integer;
  reviews_before integer;
  attempts_after integer;
  events_after integer;
  entries_after integer;
  reviews_before_missing boolean;
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'employees' and column_name = 'attendance_required'
  ) then
    alter table public.employees add column attendance_required boolean not null default true;
  end if;
  select e.profile_id, e.museum_id, e.id
    into actor, museum, employee
  from public.employees e
  where e.status = 'activo' and e.profile_id is not null
  limit 1;
  if actor is null then
    raise exception 'ATTENDANCE_REQUIRED_FIXTURE_MISSING';
  end if;
  update public.employees set attendance_required = false where id = employee;
  select count(*) into attempts_before from public.attendance_attempts;
  select count(*) into events_before from public.attendance_events;
  select count(*) into entries_before from public.employee_time_entries;
  select to_regclass('public.attendance_overtime_reviews') is null into reviews_before_missing;
  if not reviews_before_missing then
    select count(*) into reviews_before from public.attendance_overtime_reviews;
  end if;
  result := public.record_employee_attendance(
    actor,
    museum,
    'clock_in',
    '{"method":"geolocation","latitude":0,"longitude":0,"accuracy_meters":"5"}'::jsonb
  );
  if result <> '{"ok":false,"code":"ATTENDANCE_NOT_REQUIRED"}'::jsonb then
    raise exception 'ATTENDANCE_NOT_REQUIRED_RESULT:%', result;
  end if;
  select count(*) into attempts_after from public.attendance_attempts;
  select count(*) into events_after from public.attendance_events;
  select count(*) into entries_after from public.employee_time_entries;
  if attempts_after <> attempts_before or events_after <> events_before or entries_after <> entries_before then
    raise exception 'ATTENDANCE_NOT_REQUIRED_WROTE_ROWS';
  end if;
  if not reviews_before_missing then
    if (select count(*) from public.attendance_overtime_reviews) <> reviews_before then
      raise exception 'ATTENDANCE_NOT_REQUIRED_WROTE_OVERTIME';
    end if;
  end if;
  raise notice 'ATTENDANCE_NOT_REQUIRED_OK';
end
$required$;
