-- Staging exercise. The runner wraps this in a transaction and rolls it back.
-- Does not change record_employee_attendance. Creation stays: extra minutes after ends_at,
-- and only when those minutes are greater than overtime_review_threshold_minutes.

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
  clock_out timestamptz := end_at + interval '27 minutes';
  event_id uuid := 'e3000000-0000-4000-8000-000000000001';
  review_id uuid := 'f3000000-0000-4000-8000-000000000001';
  rows jsonb;
  before_entries integer;
  after_entries integer;
  before_events integer;
  after_events integer;
  occurred timestamptz;
begin
  if floor(extract(epoch from (now() - now())) / 60)::int <> 0 then raise exception 'EXACT_END_WOULD_COUNT'; end if;
  if floor(extract(epoch from ((end_at + interval '27 minutes') - end_at)) / 60)::int <> 27 then raise exception 'DETECTED_MINUTES'; end if;

  alter table public.employees disable trigger protect_employee_module_profile;
  perform set_config('request.jwt.claim.sub', admin::text, true);
  if public.has_permission('attendance.overtime.decide') then raise exception 'ADMIN_CAN_DECIDE'; end if;
  update public.employees set access_profile = 'gerente_administrativo' where profile_id = profile_user;
  perform set_config('request.jwt.claim.sub', profile_user::text, true);
  if not public.has_permission('attendance.overtime.decide') then raise exception 'MANAGER_DENIED'; end if;
  update public.employees set access_profile = 'director_ejecutivo' where profile_id = profile_user;
  if not public.has_permission('attendance.overtime.decide') then raise exception 'DIRECTOR_DENIED'; end if;
  update public.employees set access_profile = 'gerente_museografica' where profile_id = profile_user;
  if public.has_permission('attendance.overtime.decide') then raise exception 'MUSEUM_MANAGER_ALLOWED'; end if;
  update public.employees set access_profile = 'administrador_general' where profile_id = profile_user;
  if public.has_permission('attendance.overtime.decide') then raise exception 'GENERAL_ADMIN_ALLOWED'; end if;
  perform set_config('request.jwt.claim.sub', employee_user::text, true);
  if public.has_permission('attendance.overtime.decide') then raise exception 'EMPLOYEE_ALLOWED'; end if;
  perform set_config('request.jwt.claim.sub', profile_user::text, true);
  museum := public.current_user_museum_id();

  insert into public.employees(id,museum_id,first_name,last_name,email,status,access_level)
  values ('a3000000-0000-4000-8000-000000000001',museum,'Ana','Prueba','ot-ana@example.test','activo','empleado');
  insert into public.employee_shifts(id,museum_id,employee_id,starts_at,ends_at,expected_lunch_minutes,status,created_by)
  values
    ('b3000000-0000-4000-8000-000000000001',museum,'a3000000-0000-4000-8000-000000000001',start_at,end_at,60,'scheduled',admin),
    ('b3000000-0000-4000-8000-000000000002',museum,'a3000000-0000-4000-8000-000000000001',start_at+interval '1 day',end_at+interval '1 day',60,'scheduled',admin),
    ('b3000000-0000-4000-8000-000000000003',museum,'a3000000-0000-4000-8000-000000000001',start_at+interval '2 day',end_at+interval '2 day',60,'scheduled',admin),
    ('b3000000-0000-4000-8000-000000000004',museum,'a3000000-0000-4000-8000-000000000001',start_at+interval '3 day',end_at+interval '3 day',60,'scheduled',admin),
    ('b3000000-0000-4000-8000-000000000005',museum,'a3000000-0000-4000-8000-000000000001',start_at+interval '4 day',end_at+interval '4 day',60,'scheduled',admin);
  insert into public.attendance_attempts(id,museum_id,employee_id,shift_id,actor_user_id,requested_event,result)
  select id, museum, 'a3000000-0000-4000-8000-000000000001', shift, admin, 'clock_out', 'accepted'
  from (values
    ('c3000000-0000-4000-8000-000000000001'::uuid,'b3000000-0000-4000-8000-000000000001'::uuid),
    ('c3000000-0000-4000-8000-000000000002','b3000000-0000-4000-8000-000000000002'),
    ('c3000000-0000-4000-8000-000000000003','b3000000-0000-4000-8000-000000000003'),
    ('c3000000-0000-4000-8000-000000000004','b3000000-0000-4000-8000-000000000004'),
    ('c3000000-0000-4000-8000-000000000005','b3000000-0000-4000-8000-000000000005')
  ) v(id,shift);
  insert into public.attendance_events(id,museum_id,employee_id,shift_id,attempt_id,event_type,occurred_at,classification,settings_version,created_by)
  values
    (event_id,museum,'a3000000-0000-4000-8000-000000000001','b3000000-0000-4000-8000-000000000001','c3000000-0000-4000-8000-000000000001','clock_out',clock_out,'overtime_pending',1,admin),
    ('e3000000-0000-4000-8000-000000000002',museum,'a3000000-0000-4000-8000-000000000001','b3000000-0000-4000-8000-000000000002','c3000000-0000-4000-8000-000000000002','clock_out',end_at+interval '1 day 27 minutes','overtime_pending',1,admin),
    ('e3000000-0000-4000-8000-000000000003',museum,'a3000000-0000-4000-8000-000000000001','b3000000-0000-4000-8000-000000000003','c3000000-0000-4000-8000-000000000003','clock_out',end_at+interval '2 day 40 minutes','overtime_pending',1,admin),
    ('e3000000-0000-4000-8000-000000000004',museum,'a3000000-0000-4000-8000-000000000001','b3000000-0000-4000-8000-000000000004','c3000000-0000-4000-8000-000000000004','clock_out',end_at+interval '3 day 10 minutes','overtime_pending',1,admin),
    ('e3000000-0000-4000-8000-000000000005',museum,'a3000000-0000-4000-8000-000000000001','b3000000-0000-4000-8000-000000000005','c3000000-0000-4000-8000-000000000005','clock_out',end_at+interval '4 day 27 minutes','overtime_pending',1,admin);
  insert into public.attendance_overtime_reviews(id,museum_id,employee_id,shift_id,clock_out_event_id,additional_minutes,status)
  values
    (review_id,museum,'a3000000-0000-4000-8000-000000000001','b3000000-0000-4000-8000-000000000001',event_id,27,'pending'),
    ('f3000000-0000-4000-8000-000000000002',museum,'a3000000-0000-4000-8000-000000000001','b3000000-0000-4000-8000-000000000002','e3000000-0000-4000-8000-000000000002',27,'pending'),
    ('f3000000-0000-4000-8000-000000000003',museum,'a3000000-0000-4000-8000-000000000001','b3000000-0000-4000-8000-000000000003','e3000000-0000-4000-8000-000000000003',40,'pending'),
    ('f3000000-0000-4000-8000-000000000004',museum,'a3000000-0000-4000-8000-000000000001','b3000000-0000-4000-8000-000000000004','e3000000-0000-4000-8000-000000000004',10,'pending'),
    ('f3000000-0000-4000-8000-000000000005',museum,'a3000000-0000-4000-8000-000000000001','b3000000-0000-4000-8000-000000000005','e3000000-0000-4000-8000-000000000005',27,'pending');

  select count(*) into before_entries from public.employee_time_entries where employee_id='a3000000-0000-4000-8000-000000000001';
  select count(*) into before_events from public.attendance_events where employee_id='a3000000-0000-4000-8000-000000000001';
  select occurred_at into occurred from public.attendance_events where id=event_id;

  perform set_config('request.jwt.claim.sub', admin::text, true);
  begin
    perform public.decide_overtime_review(review_id,'approve_all',null,'No debe poder');
    raise exception 'ADMIN_DECIDED';
  exception when insufficient_privilege or sqlstate '42501' then null;
  end;
  perform set_config('request.jwt.claim.sub', employee_user::text, true);
  begin
    perform public.list_overtime_reviews();
    raise exception 'EMPLOYEE_LISTED';
  exception when insufficient_privilege or sqlstate '42501' then null;
  end;

  update public.employees set access_profile='gerente_administrativo' where profile_id=profile_user;
  perform set_config('request.jwt.claim.sub', profile_user::text, true);
  rows := public.list_overtime_reviews();
  if (select status from public.attendance_overtime_reviews where id=review_id) <> 'pending' then raise exception 'LIST_WROTE'; end if;
  if not exists (select 1 from jsonb_array_elements(rows->'pending') r where r->>'id'=review_id::text and (r->>'additional_minutes')::int=27 and r->>'status'='pending') then raise exception 'PENDING_MISSING'; end if;

  perform public.decide_overtime_review(review_id,'approve_all',null,'Cubrió el cierre del evento');
  if (select status from public.attendance_overtime_reviews where id=review_id) <> 'approved' then raise exception 'FULL_STATUS'; end if;
  if (select approved_minutes from public.attendance_overtime_reviews where id=review_id) <> 27 then raise exception 'FULL_MINUTES'; end if;
  if (select decided_by from public.attendance_overtime_reviews where id=review_id) <> profile_user then raise exception 'DECIDER'; end if;
  if (select decided_at from public.attendance_overtime_reviews where id=review_id) is null then raise exception 'DECIDED_AT'; end if;
  begin
    perform public.decide_overtime_review(review_id,'reject',null,'Segunda decisión');
    raise exception 'SECOND_DECISION';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'OVERTIME_ALREADY_DECIDED' then raise; end if;
  end;

  update public.employees set access_profile='director_ejecutivo' where profile_id=profile_user;
  perform public.decide_overtime_review('f3000000-0000-4000-8000-000000000002','approve_partial',15,'Solo quince minutos');
  if (select status from public.attendance_overtime_reviews where id='f3000000-0000-4000-8000-000000000002') <> 'partially_approved' then raise exception 'PARTIAL_STATUS'; end if;
  if (select approved_minutes from public.attendance_overtime_reviews where id='f3000000-0000-4000-8000-000000000002') <> 15 then raise exception 'PARTIAL_MINUTES'; end if;
  begin
    perform public.decide_overtime_review('f3000000-0000-4000-8000-000000000005','approve_partial',0,'Cero');
    raise exception 'ZERO_ALLOWED';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.decide_overtime_review('f3000000-0000-4000-8000-000000000005','approve_partial',27,'Igual al total');
    raise exception 'EQUAL_ALLOWED';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.decide_overtime_review('f3000000-0000-4000-8000-000000000003','approve_partial',50,'De más');
    raise exception 'OVER_ALLOWED';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.decide_overtime_review('f3000000-0000-4000-8000-000000000004','reject',null,'   ');
    raise exception 'BLANK_REASON';
  exception when sqlstate '22023' then null;
  end;
  perform public.decide_overtime_review('f3000000-0000-4000-8000-000000000004','reject',null,'No estaba autorizado');
  if (select approved_minutes from public.attendance_overtime_reviews where id='f3000000-0000-4000-8000-000000000004') <> 0 then raise exception 'REJECT_MINUTES'; end if;
  if (select status from public.attendance_overtime_reviews where id='f3000000-0000-4000-8000-000000000004') <> 'rejected' then raise exception 'REJECT_STATUS'; end if;
  if (select status from public.attendance_overtime_reviews where id='f3000000-0000-4000-8000-000000000003') <> 'pending' then raise exception 'FAILED_PARTIAL_WROTE'; end if;
  if (select status from public.attendance_overtime_reviews where id='f3000000-0000-4000-8000-000000000005') <> 'pending' then raise exception 'FAILED_EQUAL_WROTE'; end if;

  rows := public.list_overtime_reviews();
  if not exists (select 1 from jsonb_array_elements(rows->'recent') r where r->>'status'='approved' and (r->>'approved_minutes')::int=27) then raise exception 'RECENT_FULL'; end if;
  if not exists (select 1 from jsonb_array_elements(rows->'recent') r where r->>'status'='partially_approved' and (r->>'approved_minutes')::int=15) then raise exception 'RECENT_PARTIAL'; end if;
  if not exists (select 1 from jsonb_array_elements(rows->'recent') r where r->>'status'='rejected' and (r->>'approved_minutes')::int=0) then raise exception 'RECENT_REJECT'; end if;

  perform set_config('request.jwt.claim.sub', other_admin::text, true);
  begin
    perform public.decide_overtime_review('f3000000-0000-4000-8000-000000000005','reject',null,'Otro museo');
    raise exception 'OTHER_MUSEUM_DECIDED';
  exception when insufficient_privilege or sqlstate '42501' or sqlstate 'P0001' then null;
  end;
  if (select status from public.attendance_overtime_reviews where id='f3000000-0000-4000-8000-000000000005') <> 'pending' then raise exception 'OTHER_MUSEUM_WROTE'; end if;

  select occurred_at into clock_out from public.attendance_events where id=event_id;
  if clock_out <> occurred then raise exception 'CLOCK_OUT_CHANGED'; end if;
  select count(*) into after_events from public.attendance_events where employee_id='a3000000-0000-4000-8000-000000000001';
  select count(*) into after_entries from public.employee_time_entries where employee_id='a3000000-0000-4000-8000-000000000001';
  if after_events <> before_events or after_entries <> before_entries then raise exception 'PUNCH_SIDE_EFFECT'; end if;
  if to_regclass('public.attendance_incidents') is not null then
    execute 'select count(*) from public.attendance_incidents where employee_id=''a3000000-0000-4000-8000-000000000001''' into before_entries;
    if before_entries <> 0 then raise exception 'INCIDENT_CREATED'; end if;
  end if;
  if to_regclass('public.attendance_operational_alerts') is not null then
    execute 'select count(*) from public.attendance_operational_alerts where employee_id=''a3000000-0000-4000-8000-000000000001''' into before_entries;
    if before_entries <> 0 then raise exception 'ALERT_CREATED'; end if;
  end if;
  if floor(extract(epoch from (
      least(start_at + interval '4 hours', end_at) - start_at
      + least(end_at + interval '27 minutes', end_at) - (start_at + interval '5 hours')
    )) / 60)::int <> 480 then raise exception 'REGULAR_HOURS_NOT_CAPPED'; end if;
  if position('extra_minutes>cfg.overtime_review_threshold_minutes' in pg_get_functiondef('public.record_employee_attendance(uuid,uuid,text,jsonb)'::regprocedure)) = 0 then
    raise exception 'CREATION_GUARD_CHANGED';
  end if;
  if position('attendance_events' in pg_get_functiondef('public.decide_overtime_review(uuid,text,integer,text)'::regprocedure)) > 0 then
    raise exception 'DECISION_TOUCHES_EVENTS';
  end if;
  perform set_config('request.jwt.claim.sub', profile_user::text, true);
  update public.employees set access_profile='administrador_general' where profile_id=profile_user;
  begin
    perform public.decide_overtime_review('f3000000-0000-4000-8000-000000000005','approve_all',null,'Administrador general');
    raise exception 'GENERAL_ADMIN_DECIDED';
  exception when insufficient_privilege or sqlstate '42501' then null;
  end;
  update public.employees set access_profile='gerente_museografica' where profile_id=profile_user;
  begin
    perform public.decide_overtime_review('f3000000-0000-4000-8000-000000000005','reject',null,'Gerente museografica');
    raise exception 'MUSEUM_MANAGER_DECIDED';
  exception when insufficient_privilege or sqlstate '42501' then null;
  end;
  if (select status from public.attendance_overtime_reviews where id='f3000000-0000-4000-8000-000000000005') <> 'pending' then raise exception 'UNAUTHORIZED_WROTE'; end if;
  raise notice 'OVERTIME_DECISION_OK';
end
$test$;
