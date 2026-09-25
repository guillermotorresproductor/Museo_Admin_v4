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
  raise notice 'GEOFENCE_ACCURACY_OK';
end
$test$;
