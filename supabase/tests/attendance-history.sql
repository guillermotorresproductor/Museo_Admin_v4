-- Staging exercise. The runner applies 202609250005 in the same transaction and rolls it back.

do $bounds$
declare
  s date;
  e date;
begin
  select period_start, period_end into s, e from public.attendance_report_bounds('week', date '2026-09-25');
  if s <> date '2026-09-21' or e <> date '2026-09-27' then raise exception 'CASE_16 % %', s, e; end if;
  select period_start, period_end into s, e from public.attendance_report_bounds('semimonth', date '2026-09-10');
  if s <> date '2026-09-01' or e <> date '2026-09-15' then raise exception 'CASE_17 % %', s, e; end if;
  select period_start, period_end into s, e from public.attendance_report_bounds('semimonth', date '2026-09-25');
  if s <> date '2026-09-16' or e <> date '2026-09-30' then raise exception 'CASE_18 % %', s, e; end if;
  select period_start, period_end into s, e from public.attendance_report_bounds('semimonth', date '2026-09-30');
  if s <> date '2026-09-16' or e <> date '2026-09-30' then raise exception 'CASE_19_SEP % %', s, e; end if;
  select period_start, period_end into s, e from public.attendance_report_bounds('semimonth', date '2026-10-01');
  if s <> date '2026-10-01' or e <> date '2026-10-15' then raise exception 'CASE_19_OCT % %', s, e; end if;
  select period_start, period_end into s, e from public.attendance_report_bounds('semimonth', date '2026-10-16');
  if s <> date '2026-10-16' or e <> date '2026-10-31' then raise exception 'CASE_20 % %', s, e; end if;
  select period_start, period_end into s, e from public.attendance_report_bounds('semimonth', date '2026-02-20');
  if s <> date '2026-02-16' or e <> date '2026-02-28' then raise exception 'CASE_21 % %', s, e; end if;
  select period_start, period_end into s, e from public.attendance_report_bounds('month', date '2026-09-25');
  if s <> date '2026-09-01' or e <> date '2026-09-30' then raise exception 'CASE_22 % %', s, e; end if;
  select period_start, period_end into s, e from public.attendance_report_bounds('day', date '2026-09-25');
  if s <> date '2026-09-25' or e <> date '2026-09-25' then raise exception 'CASE_23 % %', s, e; end if;
end
$bounds$;

do $history$
declare
  actor uuid;
  museum uuid;
  employee uuid;
  other_museum uuid;
  other_employee uuid;
  outsider uuid;
  payload jsonb;
  report jsonb;
  day jsonb;
  perm uuid;
begin
  alter table public.employees disable trigger protect_employee_module_profile;
  alter table public.attendance_overtime_reviews drop constraint if exists attendance_overtime_reviews_status_check;
  alter table public.attendance_overtime_reviews add constraint attendance_overtime_reviews_status_check check (status in ('pending','approved','partially_approved','rejected','cancelled_by_correction'));
  select e.profile_id, e.museum_id, e.id
    into actor, museum, employee
  from public.employees e
  join public.profiles p on p.id = e.profile_id
  where e.status = 'activo' and p.status in ('active','activo')
  order by e.created_at
  limit 1;
  if actor is null then raise exception 'FIXTURE_MISSING'; end if;
  select e.profile_id, e.museum_id, e.id
    into outsider, other_museum, other_employee
  from public.employees e
  where e.status = 'activo' and e.museum_id <> museum and e.profile_id is not null
  limit 1;

  update public.employees set access_profile = 'gerente_administrativo' where id = employee;
  perform set_config('request.jwt.claim.sub', actor::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  insert into public.employee_shifts(id, museum_id, employee_id, starts_at, ends_at, created_by)
  values
    ('b2500000-0000-4000-8000-000000000001', museum, employee, (date '2026-08-03' + time '08:00') at time zone 'America/Puerto_Rico', (date '2026-08-03' + time '17:00') at time zone 'America/Puerto_Rico', actor),
    ('b2500000-0000-4000-8000-000000000002', museum, employee, (date '2026-08-04' + time '08:00') at time zone 'America/Puerto_Rico', (date '2026-08-04' + time '17:00') at time zone 'America/Puerto_Rico', actor),
    ('b2500000-0000-4000-8000-000000000003', museum, employee, (date '2026-08-05' + time '08:00') at time zone 'America/Puerto_Rico', (date '2026-08-05' + time '17:00') at time zone 'America/Puerto_Rico', actor),
    ('b2500000-0000-4000-8000-000000000004', museum, employee, (date '2026-08-06' + time '08:00') at time zone 'America/Puerto_Rico', (date '2026-08-06' + time '17:00') at time zone 'America/Puerto_Rico', actor),
    ('b2500000-0000-4000-8000-000000000005', museum, employee, (date '2026-08-07' + time '08:00') at time zone 'America/Puerto_Rico', (date '2026-08-07' + time '17:00') at time zone 'America/Puerto_Rico', actor),
    ('b2500000-0000-4000-8000-000000000006', museum, employee, (date '2026-08-10' + time '08:00') at time zone 'America/Puerto_Rico', (date '2026-08-10' + time '17:00') at time zone 'America/Puerto_Rico', actor),
    ('b2500000-0000-4000-8000-000000000007', museum, employee, (date '2026-08-11' + time '08:00') at time zone 'America/Puerto_Rico', (date '2026-08-11' + time '17:00') at time zone 'America/Puerto_Rico', actor),
    ('b2500000-0000-4000-8000-000000000008', museum, employee, (date '2026-08-12' + time '08:00') at time zone 'America/Puerto_Rico', (date '2026-08-12' + time '17:00') at time zone 'America/Puerto_Rico', actor),
    ('b2500000-0000-4000-8000-000000000009', museum, employee, (date '2026-08-13' + time '08:00') at time zone 'America/Puerto_Rico', (date '2026-08-13' + time '17:00') at time zone 'America/Puerto_Rico', actor),
    ('b2500000-0000-4000-8000-000000000010', museum, employee, (date '2026-08-14' + time '08:00') at time zone 'America/Puerto_Rico', (date '2026-08-14' + time '17:00') at time zone 'America/Puerto_Rico', actor);

  insert into public.attendance_attempts(id, museum_id, employee_id, shift_id, actor_user_id, requested_event, result)
  select ('c2500000-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid,
         museum, employee,
         ('b2500000-0000-4000-8000-0000000000' || lpad(((n - 1) / 4 + 1)::text, 2, '0'))::uuid,
         actor, 'clock_in', 'accepted'
  from generate_series(1, 40) n
  where ((n - 1) / 4 + 1) in (1,2,4,5,6,7,8,9,10);

  insert into public.attendance_events(id, museum_id, employee_id, shift_id, attempt_id, event_type, occurred_at, classification, settings_version, created_by, supersedes_event_id)
  values
    ('d2500000-0000-4000-8000-000000000001', museum, employee, 'b2500000-0000-4000-8000-000000000001', 'c2500000-0000-4000-8000-000000000001', 'clock_in', (date '2026-08-03' + time '08:00') at time zone 'America/Puerto_Rico', 'on_time', 4, actor, null),
    ('d2500000-0000-4000-8000-000000000002', museum, employee, 'b2500000-0000-4000-8000-000000000001', 'c2500000-0000-4000-8000-000000000002', 'lunch_out', (date '2026-08-03' + time '12:00') at time zone 'America/Puerto_Rico', 'standard', 4, actor, null),
    ('d2500000-0000-4000-8000-000000000003', museum, employee, 'b2500000-0000-4000-8000-000000000001', 'c2500000-0000-4000-8000-000000000003', 'lunch_in', (date '2026-08-03' + time '13:00') at time zone 'America/Puerto_Rico', 'standard', 4, actor, null),
    ('d2500000-0000-4000-8000-000000000004', museum, employee, 'b2500000-0000-4000-8000-000000000001', 'c2500000-0000-4000-8000-000000000004', 'clock_out', (date '2026-08-03' + time '17:00') at time zone 'America/Puerto_Rico', 'standard', 4, actor, null),
    ('d2500000-0000-4000-8000-000000000005', museum, employee, 'b2500000-0000-4000-8000-000000000002', 'c2500000-0000-4000-8000-000000000005', 'clock_in', (date '2026-08-04' + time '08:20') at time zone 'America/Puerto_Rico', 'late', 4, actor, null),
    ('d2500000-0000-4000-8000-000000000006', museum, employee, 'b2500000-0000-4000-8000-000000000002', 'c2500000-0000-4000-8000-000000000006', 'clock_out', (date '2026-08-04' + time '17:00') at time zone 'America/Puerto_Rico', 'standard', 4, actor, null),
    ('d2500000-0000-4000-8000-000000000007', museum, employee, 'b2500000-0000-4000-8000-000000000004', 'c2500000-0000-4000-8000-000000000013', 'clock_in', (date '2026-08-06' + time '08:00') at time zone 'America/Puerto_Rico', 'on_time', 4, actor, null),
    ('d2500000-0000-4000-8000-000000000008', museum, employee, 'b2500000-0000-4000-8000-000000000005', 'c2500000-0000-4000-8000-000000000017', 'clock_in', (date '2026-08-07' + time '08:30') at time zone 'America/Puerto_Rico', 'late', 4, actor, null),
    ('d2500000-0000-4000-8000-000000000009', museum, employee, 'b2500000-0000-4000-8000-000000000005', 'c2500000-0000-4000-8000-000000000018', 'clock_in', (date '2026-08-07' + time '08:00') at time zone 'America/Puerto_Rico', 'on_time', 4, actor, 'd2500000-0000-4000-8000-000000000008'),
    ('d2500000-0000-4000-8000-000000000010', museum, employee, 'b2500000-0000-4000-8000-000000000005', 'c2500000-0000-4000-8000-000000000019', 'clock_out', (date '2026-08-07' + time '17:00') at time zone 'America/Puerto_Rico', 'standard', 4, actor, null);

  insert into public.attendance_events(id, museum_id, employee_id, shift_id, attempt_id, event_type, occurred_at, classification, settings_version, created_by)
  select ('d2500000-0000-4000-8000-0000000001' || lpad(n::text, 2, '0'))::uuid,
         museum, employee,
         ('b2500000-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid,
         ('c2500000-0000-4000-8000-0000000000' || lpad(((n - 1) * 4 + 1)::text, 2, '0'))::uuid,
         'clock_out',
         ((date '2026-08-04' + n) + time '17:30') at time zone 'America/Puerto_Rico',
         'overtime_pending', 4, actor
  from generate_series(6, 10) n;

  insert into public.attendance_overtime_reviews(museum_id, employee_id, shift_id, clock_out_event_id, additional_minutes, status, approved_minutes)
  values
    (museum, employee, 'b2500000-0000-4000-8000-000000000006', 'd2500000-0000-4000-8000-000000000106', 30, 'pending', null),
    (museum, employee, 'b2500000-0000-4000-8000-000000000007', 'd2500000-0000-4000-8000-000000000107', 45, 'approved', 45),
    (museum, employee, 'b2500000-0000-4000-8000-000000000008', 'd2500000-0000-4000-8000-000000000108', 60, 'partially_approved', 20),
    (museum, employee, 'b2500000-0000-4000-8000-000000000009', 'd2500000-0000-4000-8000-000000000109', 30, 'rejected', 0),
    (museum, employee, 'b2500000-0000-4000-8000-000000000010', 'd2500000-0000-4000-8000-000000000110', 30, 'cancelled_by_correction', null);

  if other_employee is not null then
    insert into public.employee_shifts(id, museum_id, employee_id, starts_at, ends_at, created_by)
    values ('b2500000-0000-4000-8000-000000000099', other_museum, other_employee, (date '2026-08-03' + time '08:00') at time zone 'America/Puerto_Rico', (date '2026-08-03' + time '17:00') at time zone 'America/Puerto_Rico', outsider);
  end if;

  report := public.list_attendance_history(date '2026-08-03', date '2026-08-14');
  select value into payload from jsonb_array_elements(report->'employees') value where value->>'employee_id' = employee::text;
  if payload is null then raise exception 'CASE_1_MISSING'; end if;
  select value into day from jsonb_array_elements(payload->'days') value where value->>'shift_date' = '2026-08-03';
  if coalesce((day->>'regular_minutes')::integer, 0) <> 480 then raise exception 'CASE_1 %', day; end if;
  if (day->>'regular_minutes')::integer <> 480 or day->>'status' <> 'COMPLETA' then raise exception 'CASE_1_DAY %', day; end if;
  select value into day from jsonb_array_elements(payload->'days') value where value->>'shift_date' = '2026-08-04';
  if day->>'late' <> 'true' then raise exception 'CASE_2 %', day; end if;
  select value into day from jsonb_array_elements(payload->'days') value where value->>'shift_date' = '2026-08-05';
  if day->>'status' <> 'SIN PONCHAR' then raise exception 'CASE_3 %', day; end if;
  select value into day from jsonb_array_elements(payload->'days') value where value->>'shift_date' = '2026-08-06';
  if day->>'status' <> 'INCOMPLETA' or (day->>'regular_minutes')::integer <> 0 then raise exception 'CASE_4 %', day; end if;
  select value into day from jsonb_array_elements(payload->'days') value where value->>'shift_date' = '2026-08-07';
  if day->>'corrected' <> 'true' or day->>'late' <> 'false' then raise exception 'CASE_5 %', day; end if;
  select value into day from jsonb_array_elements(payload->'days') value where value->>'shift_date' = '2026-08-10';
  if (day->>'approved_overtime_minutes')::integer <> 0 then raise exception 'CASE_6 %', day; end if;
  select value into day from jsonb_array_elements(payload->'days') value where value->>'shift_date' = '2026-08-11';
  if (day->>'approved_overtime_minutes')::integer <> 45 then raise exception 'CASE_7 %', day; end if;
  select value into day from jsonb_array_elements(payload->'days') value where value->>'shift_date' = '2026-08-12';
  if (day->>'approved_overtime_minutes')::integer <> 20 then raise exception 'CASE_8 %', day; end if;
  select value into day from jsonb_array_elements(payload->'days') value where value->>'shift_date' = '2026-08-13';
  if (day->>'approved_overtime_minutes')::integer <> 0 then raise exception 'CASE_9 %', day; end if;
  select value into day from jsonb_array_elements(payload->'days') value where value->>'shift_date' = '2026-08-14';
  if (day->>'approved_overtime_minutes')::integer <> 0 then raise exception 'CASE_10 %', day; end if;
  if other_employee is not null and report::text like '%' || other_employee::text || '%' then
    raise exception 'CASE_11';
  end if;

  update public.employees set access_profile = 'tecnico_produccion' where id = employee;
  begin
    perform public.list_attendance_history(date '2026-08-03', date '2026-08-03');
    raise exception 'CASE_12_ALLOWED';
  exception when insufficient_privilege then null;
  end;

  update public.employees set access_profile = 'administrador_general' where id = employee;
  perform public.list_attendance_history(date '2026-08-03', date '2026-08-03');
  update public.employees set access_profile = 'gerente_administrativo' where id = employee;
  perform public.list_attendance_history(date '2026-08-03', date '2026-08-03');
  update public.employees set access_profile = 'director_ejecutivo' where id = employee;
  perform public.list_attendance_history(date '2026-08-03', date '2026-08-03');
  update public.employees set access_profile = null where id = employee;
  update public.profiles set role = 'administrador' where id = actor;
  perform public.list_attendance_history(date '2026-08-03', date '2026-08-03');

  begin
    perform public.list_attendance_history(date '2026-01-01', date '2027-01-02');
    raise exception 'CASE_24_ALLOWED';
  exception when sqlstate '22023' then null;
  end;

  select id into perm from public.permissions where code = 'attendance.history.read';
  insert into public.user_permissions(user_id, museum_id, permission_id, effect)
  values (actor, museum, perm, 'deny');
  update public.employees set access_profile = 'gerente_administrativo' where id = employee;
  if public.has_permission('attendance.history.read') then raise exception 'DENY_LOST'; end if;
end
$history$;
